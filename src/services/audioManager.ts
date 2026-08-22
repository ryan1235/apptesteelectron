import { PacketType, AppConfig } from '../types/live-room';
import { encodeBinaryPacket } from './binaryProtocol';
import { logger } from './logger';

export type OnAudioPacketCallback = (packet: ArrayBuffer) => void;
export type OnSpeakingChangeCallback = (isSpeaking: boolean) => void;
export type OnVolumeLevelCallback = (level: number) => void; // 0..100 for UI meters

interface AudioQueueItem {
  samples: Float32Array;
  offset: number;
}

export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private highPassFilterNode: BiquadFilterNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;

  // Local Loopback Test Node (allows user to hear own voice in settings)
  private testGainNode: GainNode | null = null;
  private isTestingMic: boolean = false;

  private isMicMuted: boolean = false;
  private isDeafened: boolean = false;
  private isSpeaking: boolean = false;
  private roomId: string = '';
  private config: AppConfig;

  private onAudioPacket: OnAudioPacketCallback | null = null;
  private onSpeakingChange: OnSpeakingChangeCallback | null = null;
  private onVolumeLevel: OnVolumeLevelCallback | null = null;

  // Multi-voice & Screen Continuous Mixer Queues (Jitter-free ring buffer)
  private playbackNode: ScriptProcessorNode | null = null;
  private voiceQueues: Map<string, AudioQueueItem[]> = new Map();
  private screenQueueL: AudioQueueItem[] = [];
  private screenQueueR: AudioQueueItem[] = [];
  private userVolumes: Map<string, number> = new Map(); // userId -> 0..100
  private screenAudioVolume: number = 100;

  // VAD state
  private vadIntervalId: any = null;
  private lastSpeakingTime: number = 0;
  private silenceTimeoutMs: number = 300;
  private sequenceNumber: number = 0;

  // Screen Audio Capture state
  private screenAudioStream: MediaStream | null = null;
  private screenAudioSourceNode: MediaStreamAudioSourceNode | null = null;
  private screenScriptProcessorNode: ScriptProcessorNode | null = null;
  private screenAudioSequenceNumber: number = 0;

  constructor(config: AppConfig) {
    this.config = config;
  }

  public updateConfig(config: AppConfig) {
    this.config = config;
    if (this.gainNode) {
      this.gainNode.gain.value = 1.0;
    }
  }

  public setCallbacks(
    onAudioPacket: OnAudioPacketCallback,
    onSpeakingChange: OnSpeakingChangeCallback,
    onVolumeLevel?: OnVolumeLevelCallback
  ) {
    this.onAudioPacket = onAudioPacket;
    this.onSpeakingChange = onSpeakingChange;
    if (onVolumeLevel) this.onVolumeLevel = onVolumeLevel;
  }

  public setRoomId(roomId: string) {
    this.roomId = roomId;
  }

  public setMuted(muted: boolean) {
    this.isMicMuted = muted;
    if (muted && this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange?.(false);
    }
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened;
  }

  public setUserVolume(userId: string, volume: number) {
    this.userVolumes.set(userId, Math.max(0, Math.min(200, volume)));
  }

  public setScreenAudioVolume(volume: number) {
    this.screenAudioVolume = Math.max(0, Math.min(200, volume));
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({
        sampleRate: 48000, // Studio 48kHz PCM standard
        latencyHint: 'interactive',
      });
      this.initContinuousPlaybackPipeline();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  /**
   * Continuous Ring Buffer Playback Mixer:
   * Consistently mixes all incoming voice streams + screen stereo audio smoothly
   * on the hardware audio clock without creating/destroying individual buffer nodes.
   */
  private initContinuousPlaybackPipeline() {
    if (!this.audioCtx || this.playbackNode) return;

    // Buffer size 2048 at 48kHz = ~42.6ms per render callback
    this.playbackNode = this.audioCtx.createScriptProcessor(2048, 0, 2);

    this.playbackNode.onaudioprocess = (e) => {
      const outL = e.outputBuffer.getChannelData(0);
      const outR = e.outputBuffer.getChannelData(1);
      outL.fill(0);
      outR.fill(0);

      if (this.isDeafened) return;

      const len = outL.length;

      // 1. Mix Voice streams per user
      for (const [userId, queue] of this.voiceQueues.entries()) {
        const userVol = (this.userVolumes.get(userId) ?? 100) / 100;
        if (userVol === 0 || queue.length === 0) continue;

        let outIdx = 0;
        while (outIdx < len && queue.length > 0) {
          const item = queue[0];
          const available = item.samples.length - item.offset;
          const toCopy = Math.min(len - outIdx, available);

          for (let i = 0; i < toCopy; i++) {
            const s = item.samples[item.offset + i] * userVol;
            outL[outIdx + i] += s;
            outR[outIdx + i] += s;
          }

          item.offset += toCopy;
          outIdx += toCopy;

          if (item.offset >= item.samples.length) {
            queue.shift();
          }
        }

        // Limit backlog to 8 chunks (~320ms) to avoid drift
        if (queue.length > 8) {
          queue.splice(0, queue.length - 3);
        }
      }

      // 2. Mix Screen Stereo stream
      const screenVol = this.screenAudioVolume / 100;
      if (screenVol > 0 && this.screenQueueL.length > 0) {
        let outIdx = 0;
        while (outIdx < len && this.screenQueueL.length > 0) {
          const itemL = this.screenQueueL[0];
          const itemR = this.screenQueueR[0] || itemL;
          const available = itemL.samples.length - itemL.offset;
          const toCopy = Math.min(len - outIdx, available);

          for (let i = 0; i < toCopy; i++) {
            outL[outIdx + i] += itemL.samples[itemL.offset + i] * screenVol;
            outR[outIdx + i] += itemR.samples[itemR.offset + i] * screenVol;
          }

          itemL.offset += toCopy;
          if (itemR !== itemL) itemR.offset += toCopy;
          outIdx += toCopy;

          if (itemL.offset >= itemL.samples.length) {
            this.screenQueueL.shift();
            this.screenQueueR.shift();
          }
        }

        if (this.screenQueueL.length > 8) {
          this.screenQueueL.splice(0, this.screenQueueL.length - 3);
          this.screenQueueR.splice(0, this.screenQueueR.length - 3);
        }
      }
    };

    this.playbackNode.connect(this.audioCtx.destination);
  }

  /**
   * Initializes local microphone capture with DSP Studio Pipeline:
   * Mic -> High-Pass (85Hz) -> Studio Compressor -> Analyser -> Gain -> ScriptProcessor
   */
  public async startMicrophone(): Promise<void> {
    try {
      const ctx = this.ensureAudioContext();

      if (this.micStream) {
        return; // Already capturing
      }

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: this.config.selectedMicrophoneId ? { exact: this.config.selectedMicrophoneId } : undefined,
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
          channelCount: 1, // Mono voice
        },
        video: false,
      };

      this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.micSourceNode = ctx.createMediaStreamSource(this.micStream);
      logger.success('AUDIO', `Microfone ativado com sucesso (Taxa: ${ctx.sampleRate} Hz, AEC: ${this.config.echoCancellation})`);

      // 1. High-Pass Filter (85Hz) to remove AC, desk rumble, and fan vibrations
      this.highPassFilterNode = ctx.createBiquadFilter();
      this.highPassFilterNode.type = 'highpass';
      this.highPassFilterNode.frequency.value = 85;
      this.highPassFilterNode.Q.value = 0.7;

      // 2. Broadcast Voice Dynamics Compressor (levels quiet whispers and loud screams smoothly)
      this.compressorNode = ctx.createDynamicsCompressor();
      this.compressorNode.threshold.value = -24; // dB
      this.compressorNode.knee.value = 10;
      this.compressorNode.ratio.value = 4;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;

      // 3. Analyser Node for VAD, Oscilloscope & Live UI meters
      this.analyserNode = ctx.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.3;

      // 4. Gain Node for Master Sensitivity
      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = 1.0;

      // 5. ScriptProcessor for direct clean PCM streaming (2048 samples ~42.6ms)
      this.scriptProcessorNode = ctx.createScriptProcessor(2048, 1, 1);

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.roomId || this.isMicMuted || !this.onAudioPacket) return;

        const inputBuffer = audioProcessingEvent.inputBuffer.getChannelData(0);
        const pcmInt16 = this.float32ToInt16(inputBuffer);

        // Packetize into 50-byte binary header with type 0x05 (VOICE_AUDIO_PCM)
        const packet = encodeBinaryPacket({
          packetType: PacketType.VOICE_AUDIO_PCM,
          roomId: this.roomId,
          timestampUs: performance.now() * 1000,
          sequenceNumber: (this.sequenceNumber++) & 0xFFFFFF,
          payload: new Uint8Array(pcmInt16.buffer),
        });

        this.onAudioPacket(packet);
      };

      // Connect DSP chain: Mic -> HighPass -> Compressor -> Analyser -> Gain -> ScriptProcessor
      this.micSourceNode.connect(this.highPassFilterNode);
      this.highPassFilterNode.connect(this.compressorNode);
      this.compressorNode.connect(this.analyserNode);
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessorNode);

      // Dummy silence destination to keep ScriptProcessor running without local echo
      const dummyGain = ctx.createGain();
      dummyGain.gain.value = 0;
      this.scriptProcessorNode.connect(dummyGain);
      dummyGain.connect(ctx.destination);

      this.startVADLoop();
    } catch (err) {
      console.error('Erro ao iniciar microfone:', err);
      throw err;
    }
  }

  /**
   * Voice Activity Detection (VAD) loop calculating RMS volume level
   */
  private startVADLoop() {
    if (this.vadIntervalId) clearInterval(this.vadIntervalId);

    const buffer = new Uint8Array(this.analyserNode?.frequencyBinCount || 256);

    this.vadIntervalId = setInterval(() => {
      if (!this.analyserNode || this.isMicMuted || !this.roomId) {
        if (this.isSpeaking) {
          this.isSpeaking = false;
          this.onSpeakingChange?.(false);
        }
        this.onVolumeLevel?.(0);
        return;
      }

      this.analyserNode.getByteTimeDomainData(buffer);

      // Calculate RMS (Root Mean Square)
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        const val = (buffer[i] - 128) / 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / buffer.length);
      const volumeLevel = Math.min(100, Math.round(rms * 280));
      this.onVolumeLevel?.(volumeLevel);

      // Threshold based on vadSensitivity (0..100 -> ~0.01 to 0.15)
      const threshold = (100 - this.config.vadSensitivity) * 0.001 + 0.008;

      const now = performance.now();
      if (rms > threshold) {
        this.lastSpeakingTime = now;
        if (!this.isSpeaking) {
          this.isSpeaking = true;
          this.onSpeakingChange?.(true);
        }
      } else {
        if (this.isSpeaking && now - this.lastSpeakingTime > this.silenceTimeoutMs) {
          this.isSpeaking = false;
          this.onSpeakingChange?.(false);
        }
      }
    }, 40);
  }

  /**
   * Start Loopback Mic Test Mode (routes mic to user's headphones in settings)
   */
  public async startMicTest(): Promise<void> {
    if (!this.micStream) {
      await this.startMicrophone();
    }
    const ctx = this.ensureAudioContext();
    if (!this.gainNode) return;

    if (!this.testGainNode) {
      this.testGainNode = ctx.createGain();
      this.testGainNode.gain.value = 1.0;
    }

    this.gainNode.connect(this.testGainNode);
    this.testGainNode.connect(ctx.destination);
    this.isTestingMic = true;
    logger.info('AUDIO', 'Teste de microfone (loopback local) iniciado.');
  }

  /**
   * Stop Loopback Mic Test Mode
   */
  public stopMicTest(): void {
    if (this.testGainNode && this.audioCtx) {
      try {
        this.testGainNode.disconnect();
      } catch (e) {}
      this.testGainNode = null;
    }
    this.isTestingMic = false;
    logger.info('AUDIO', 'Teste de microfone finalizado.');
  }

  /**
   * Starts capturing and streaming Stereo PCM (48kHz) audio from a shared screen/application
   */
  public async startScreenAudioCapture(stream: MediaStream): Promise<boolean> {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      logger.info('AUDIO', 'Nenhuma faixa de áudio encontrada no stream de captura de tela.');
      return false;
    }

    const ctx = this.ensureAudioContext();
    this.stopScreenAudioCapture();

    try {
      this.screenAudioStream = new MediaStream([audioTracks[0]]);
      this.screenAudioSourceNode = ctx.createMediaStreamSource(this.screenAudioStream);

      // Stereo ScriptProcessor (bufferSize: 2048, 2 inputs, 2 outputs)
      this.screenScriptProcessorNode = ctx.createScriptProcessor(2048, 2, 2);

      this.screenScriptProcessorNode.onaudioprocess = (e) => {
        if (!this.roomId || !this.onAudioPacket) return;

        const left = e.inputBuffer.getChannelData(0);
        const right = e.inputBuffer.numberOfChannels > 1 ? e.inputBuffer.getChannelData(1) : left;

        // Interleave Stereo L/R Float32
        const interleaved = new Float32Array(left.length * 2);
        for (let i = 0; i < left.length; i++) {
          interleaved[i * 2] = left[i];
          interleaved[i * 2 + 1] = right[i];
        }

        const pcmInt16 = this.float32ToInt16(interleaved);

        // Packetize with PacketType.SCREEN_AUDIO_PCM (0x02)
        const packet = encodeBinaryPacket({
          packetType: PacketType.SCREEN_AUDIO_PCM,
          roomId: this.roomId,
          timestampUs: performance.now() * 1000,
          sequenceNumber: (this.screenAudioSequenceNumber++) & 0xFFFFFF,
          payload: new Uint8Array(pcmInt16.buffer),
        });

        this.onAudioPacket(packet);
      };

      this.screenAudioSourceNode.connect(this.screenScriptProcessorNode);

      // Connect to dummy silence to keep processor active without echoing back locally
      const dummyGain = ctx.createGain();
      dummyGain.gain.value = 0;
      this.screenScriptProcessorNode.connect(dummyGain);
      dummyGain.connect(ctx.destination);

      logger.success('AUDIO', 'Transmissão de áudio da tela (Stereo PCM 48kHz) ativada com sucesso!');
      return true;
    } catch (err) {
      console.warn('Falha ao inicializar captura de áudio da tela:', err);
      return false;
    }
  }

  public stopScreenAudioCapture() {
    if (this.screenScriptProcessorNode) {
      try {
        this.screenScriptProcessorNode.disconnect();
      } catch (e) {}
      this.screenScriptProcessorNode = null;
    }
    if (this.screenAudioSourceNode) {
      try {
        this.screenAudioSourceNode.disconnect();
      } catch (e) {}
      this.screenAudioSourceNode = null;
    }
    this.screenAudioStream = null;
  }

  /**
   * Directly feeds raw PCM chunk from native WASAPI Process Loopback capture
   */
  public pushNativeProcessAudioChunk(chunk: ArrayBuffer) {
    if (!this.roomId || !this.onAudioPacket || !chunk || chunk.byteLength === 0) return;

    const packet = encodeBinaryPacket({
      packetType: PacketType.SCREEN_AUDIO_PCM,
      roomId: this.roomId,
      timestampUs: performance.now() * 1000,
      sequenceNumber: (this.screenAudioSequenceNumber++) & 0xFFFFFF,
      payload: new Uint8Array(chunk),
    });

    this.onAudioPacket(packet);
  }

  /**
   * Queues incoming remote PCM audio packets into continuous jitter-free ring buffer
   */
  public playRemoteAudioChunk(
    packetType: PacketType,
    payload: ArrayBuffer,
    userId: string = '__default__'
  ) {
    if (this.isDeafened) {
      return;
    }

    this.ensureAudioContext();

    const int16Array = new Int16Array(payload);
    const float32Array = this.int16ToFloat32(int16Array);

    if (packetType === PacketType.SCREEN_AUDIO_PCM) {
      // Stereo de-interleave
      const numFrames = Math.floor(float32Array.length / 2);
      if (numFrames <= 0) return;

      const left = new Float32Array(numFrames);
      const right = new Float32Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        left[i] = float32Array[i * 2];
        right[i] = float32Array[i * 2 + 1];
      }

      this.screenQueueL.push({ samples: left, offset: 0 });
      this.screenQueueR.push({ samples: right, offset: 0 });
    } else {
      // Voice Mono
      if (float32Array.length === 0) return;

      let queue = this.voiceQueues.get(userId);
      if (!queue) {
        queue = [];
        this.voiceQueues.set(userId, queue);
      }

      queue.push({ samples: float32Array, offset: 0 });
    }
  }

  /**
   * Helper: Float32 to Int16 PCM conversion
   */
  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const len = float32Array.length;
    const int16 = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }

  /**
   * Helper: Int16 PCM to Float32 conversion
   */
  private int16ToFloat32(int16Array: Int16Array): Float32Array {
    const len = int16Array.length;
    const float32 = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      float32[i] = int16Array[i] / 32768.0;
    }
    return float32;
  }

  /**
   * Cleans up audio resources
   */
  public stop() {
    this.stopMicTest();
    this.stopScreenAudioCapture();

    if (this.vadIntervalId) {
      clearInterval(this.vadIntervalId);
      this.vadIntervalId = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.scriptProcessorNode) {
      try {
        this.scriptProcessorNode.disconnect();
      } catch (e) {}
      this.scriptProcessorNode = null;
    }

    if (this.playbackNode) {
      try {
        this.playbackNode.disconnect();
      } catch (e) {}
      this.playbackNode = null;
    }

    if (this.analyserNode) {
      try {
        this.analyserNode.disconnect();
      } catch (e) {}
      this.analyserNode = null;
    }

    if (this.highPassFilterNode) {
      try {
        this.highPassFilterNode.disconnect();
      } catch (e) {}
      this.highPassFilterNode = null;
    }

    if (this.compressorNode) {
      try {
        this.compressorNode.disconnect();
      } catch (e) {}
      this.compressorNode = null;
    }

    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch (e) {}
      this.gainNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.voiceQueues.clear();
    this.screenQueueL = [];
    this.screenQueueR = [];
    this.isSpeaking = false;
  }
}
