import { PacketType, AppConfig } from '../types/live-room';
import { encodeBinaryPacket, decodeBinaryPacket } from './binaryProtocol';
import { logger } from './logger';

export type OnAudioPacketCallback = (packet: ArrayBuffer) => void;
export type OnSpeakingChangeCallback = (isSpeaking: boolean) => void;
export type OnVolumeLevelCallback = (level: number) => void; // 0..100 for UI meters

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

  // Remote audio playback queues per user/stream (Multi-Voice Mixer)
  private userPlayTimes: Map<string, number> = new Map();
  private userVolumes: Map<string, number> = new Map(); // userId -> 0..100
  private screenAudioVolume: number = 100;

  // VAD & Noise Gate DSP state
  private vadIntervalId: any = null;
  private lastSpeakingTime: number = 0;
  private silenceTimeoutMs: number = 300; // debounce before stopping speaking
  private sequenceNumber: number = 0;
  private noiseGateGain: number = 1.0; // Dynamic envelope for smooth gate transitions

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
      // Input gain multiplier if needed
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

  /**
   * Initializes local microphone capture with DSP Studio Pipeline:
   * Mic -> High-Pass (85Hz) -> Studio Compressor -> Analyser -> Gain -> Noise Gate ScriptProcessor
   */
  public async startMicrophone(): Promise<void> {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        this.audioCtx = new AudioCtxClass({
          sampleRate: 44100, // Standard 44.1kHz PCM voice rate
          latencyHint: 'interactive',
        });
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Constraints with robust Echo Cancellation, Noise Suppression & AGC
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
      this.micSourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      logger.success('AUDIO', `Microfone ativado com sucesso (Taxa: ${this.audioCtx.sampleRate} Hz, AEC: ${this.config.echoCancellation})`);

      // 1. High-Pass Filter (85Hz) to remove AC, desk rumble, and fan vibrations
      this.highPassFilterNode = this.audioCtx.createBiquadFilter();
      this.highPassFilterNode.type = 'highpass';
      this.highPassFilterNode.frequency.value = 85;
      this.highPassFilterNode.Q.value = 0.7;

      // 2. Broadcast Voice Dynamics Compressor (levels quiet whispers and loud screams smoothly)
      this.compressorNode = this.audioCtx.createDynamicsCompressor();
      this.compressorNode.threshold.value = -24; // dB
      this.compressorNode.knee.value = 10;
      this.compressorNode.ratio.value = 4;
      this.compressorNode.attack.value = 0.003;
      this.compressorNode.release.value = 0.25;

      // 3. Analyser Node for VAD, Oscilloscope & Live UI meters
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.3;

      // 4. Gain Node for Master Sensitivity
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;

      // 5. ScriptProcessor for Noise Gate + PCM Int16 conversion (bufferSize: 2048 samples ~46ms chunk)
      this.scriptProcessorNode = this.audioCtx.createScriptProcessor(2048, 1, 1);

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.roomId || this.isMicMuted) return;

        const inputBuffer = audioProcessingEvent.inputBuffer.getChannelData(0);

        // Calculate chunk RMS for Noise Gate threshold
        let sum = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
          sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / inputBuffer.length);

        // Noise gate cutoff threshold based on VAD sensitivity (5..95)
        // Sensitivity 50 -> threshold ~0.02
        const threshold = (100 - this.config.vadSensitivity) * 0.0006 + 0.005;

        // Apply smooth envelope to prevent clicking on gate open/close
        const targetGate = rms > threshold ? 1.0 : 0.0;
        this.noiseGateGain += (targetGate - this.noiseGateGain) * 0.35;

        // Apply gate attenuation
        const processedBuffer = new Float32Array(inputBuffer.length);
        for (let i = 0; i < inputBuffer.length; i++) {
          processedBuffer[i] = inputBuffer[i] * this.noiseGateGain;
        }

        const pcmInt16 = this.float32ToInt16(processedBuffer);

        // Packetize into 50-byte binary header with type 0x05 (VOICE_AUDIO_PCM)
        const packet = encodeBinaryPacket({
          packetType: PacketType.VOICE_AUDIO_PCM,
          roomId: this.roomId,
          timestampUs: performance.now() * 1000,
          sequenceNumber: (this.sequenceNumber++) & 0xFFFFFF,
          payload: new Uint8Array(pcmInt16.buffer),
        });

        this.onAudioPacket?.(packet);
      };

      // Connect DSP chain: Mic -> HighPass -> Compressor -> Analyser -> Gain -> ScriptProcessor
      this.micSourceNode.connect(this.highPassFilterNode);
      this.highPassFilterNode.connect(this.compressorNode);
      this.compressorNode.connect(this.analyserNode);
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessorNode);

      // Dummy silence destination to keep ScriptProcessor running without local echo
      const dummyGain = this.audioCtx.createGain();
      dummyGain.gain.value = 0;
      this.scriptProcessorNode.connect(dummyGain);
      dummyGain.connect(this.audioCtx.destination);

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
    if (!this.audioCtx || !this.gainNode) return;

    if (!this.testGainNode) {
      this.testGainNode = this.audioCtx.createGain();
      this.testGainNode.gain.value = 1.0;
    }

    this.gainNode.connect(this.testGainNode);
    this.testGainNode.connect(this.audioCtx.destination);
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
   * Starts capturing and streaming Stereo PCM (44.1kHz) audio from a shared screen/application
   */
  public async startScreenAudioCapture(stream: MediaStream): Promise<boolean> {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      logger.info('AUDIO', 'Nenhuma faixa de áudio encontrada no stream de captura de tela.');
      return false;
    }

    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({
        sampleRate: 44100,
        latencyHint: 'interactive',
      });
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.stopScreenAudioCapture();

    try {
      this.screenAudioStream = new MediaStream([audioTracks[0]]);
      this.screenAudioSourceNode = this.audioCtx.createMediaStreamSource(this.screenAudioStream);

      // Stereo ScriptProcessor (bufferSize: 2048, 2 inputs, 2 outputs)
      this.screenScriptProcessorNode = this.audioCtx.createScriptProcessor(2048, 2, 2);

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
      const dummyGain = this.audioCtx.createGain();
      dummyGain.gain.value = 0;
      this.screenScriptProcessorNode.connect(dummyGain);
      dummyGain.connect(this.audioCtx.destination);

      logger.success('AUDIO', 'Transmissão de áudio da tela (Stereo PCM 44.1kHz) ativada com sucesso!');
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
   * Decodes incoming remote PCM audio packets with multi-voice mixer and adaptive jitter buffer
   */
  public playRemoteAudioChunk(
    packetType: PacketType,
    payload: ArrayBuffer,
    userId?: string
  ) {
    if (this.isDeafened || !this.audioCtx || this.audioCtx.state !== 'running') {
      return;
    }

    const int16Array = new Int16Array(payload);
    const float32Array = this.int16ToFloat32(int16Array);

    const isScreenAudio = packetType === PacketType.SCREEN_AUDIO_PCM;
    const numChannels = isScreenAudio ? 2 : 1;
    const numFrames = isScreenAudio ? float32Array.length / 2 : float32Array.length;

    if (numFrames <= 0) return;

    const audioBuffer = this.audioCtx.createBuffer(
      numChannels,
      numFrames,
      this.audioCtx.sampleRate
    );

    if (numChannels === 1) {
      audioBuffer.copyToChannel(float32Array as any, 0);
    } else {
      // De-interleave stereo
      const left = new Float32Array(numFrames);
      const right = new Float32Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        left[i] = float32Array[i * 2];
        right[i] = float32Array[i * 2 + 1];
      }
      audioBuffer.copyToChannel(left as any, 0);
      audioBuffer.copyToChannel(right as any, 1);
    }

    // Create BufferSourceNode
    const sourceNode = this.audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;

    // Apply User / Screen Volume Gain
    const userVolumeMultiplier = userId ? (this.userVolumes.get(userId) ?? 100) / 100 : 1.0;
    const screenMultiplier = isScreenAudio ? this.screenAudioVolume / 100 : 1.0;

    const gainNode = this.audioCtx.createGain();
    gainNode.gain.value = userVolumeMultiplier * screenMultiplier;

    sourceNode.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    // Audio scheduling with jitter buffer management per user/source
    const streamKey = userId || (isScreenAudio ? '__screen__' : '__main__');
    const currentTime = this.audioCtx.currentTime;
    let streamNextTime = this.userPlayTimes.get(streamKey) ?? 0;

    if (streamNextTime < currentTime) {
      streamNextTime = currentTime + 0.015; // 15ms adaptive jitter safety buffer
    }

    sourceNode.start(streamNextTime);
    this.userPlayTimes.set(streamKey, streamNextTime + audioBuffer.duration);
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
      this.scriptProcessorNode.disconnect();
      this.scriptProcessorNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.highPassFilterNode) {
      this.highPassFilterNode.disconnect();
      this.highPassFilterNode = null;
    }

    if (this.compressorNode) {
      this.compressorNode.disconnect();
      this.compressorNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.isSpeaking = false;
  }
}
