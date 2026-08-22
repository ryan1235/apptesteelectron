import { PacketType, AppConfig } from '../types/live-room';
import { encodeBinaryPacket, decodeBinaryPacket } from './binaryProtocol';

export type OnAudioPacketCallback = (packet: ArrayBuffer) => void;
export type OnSpeakingChangeCallback = (isSpeaking: boolean) => void;
export type OnVolumeLevelCallback = (level: number) => void; // 0..100 for UI meters

export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSourceNode: MediaStreamAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private isMicMuted: boolean = false;
  private isDeafened: boolean = false;
  private isSpeaking: boolean = false;
  private roomId: string = '';
  private config: AppConfig;

  private onAudioPacket: OnAudioPacketCallback | null = null;
  private onSpeakingChange: OnSpeakingChangeCallback | null = null;
  private onVolumeLevel: OnVolumeLevelCallback | null = null;

  // Remote audio playback queue per user/stream
  private nextPlayTime: number = 0;
  private userVolumes: Map<string, number> = new Map(); // userId -> 0..100
  private screenAudioVolume: number = 100;

  // VAD state & smoothing
  private vadIntervalId: any = null;
  private lastSpeakingTime: number = 0;
  private silenceTimeoutMs: number = 350; // debounce before stopping speaking
  private sequenceNumber: number = 0;

  constructor(config: AppConfig) {
    this.config = config;
  }

  public updateConfig(config: AppConfig) {
    this.config = config;
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

  /**
   * Initializes local microphone capture with Echo Cancellation and VAD
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

      // Constraints with robust Echo Cancellation to prevent audio loopback
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

      // Analyser Node for VAD & UI meter
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 512;
      this.analyserNode.smoothingTimeConstant = 0.4;

      // Gain Node for local mic sensitivity
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = 1.0;

      // ScriptProcessor for PCM Int16 conversion (bufferSize: 2048 samples ~46ms chunk)
      this.scriptProcessorNode = this.audioCtx.createScriptProcessor(2048, 1, 1);

      this.scriptProcessorNode.onaudioprocess = (e) => {
        if (this.isMicMuted || !this.roomId) return;

        const inputBuffer = e.inputBuffer.getChannelData(0);
        const pcmInt16 = this.float32ToInt16(inputBuffer);

        // Packetize into 50-byte binary header with type 0x05 (VOICE_AUDIO_PCM)
        const packet = encodeBinaryPacket({
          packetType: PacketType.VOICE_AUDIO_PCM,
          roomId: this.roomId,
          timestampUs: performance.now() * 1000,
          sequenceNumber: (this.sequenceNumber++) & 0xFFFFFF,
          payload: pcmInt16.buffer,
        });

        this.onAudioPacket?.(packet);
      };

      // Connect nodes: Mic -> Analyser -> Gain -> ScriptProcessor
      // NOTE: We do NOT connect ScriptProcessor to audioCtx.destination to prevent local mic feedback (zero self-echo)
      this.micSourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.scriptProcessorNode);

      // Dummy silence destination to keep ScriptProcessor running
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
      if (!this.analyserNode || this.isMicMuted) {
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
      const volumeLevel = Math.min(100, Math.round(rms * 250));
      this.onVolumeLevel?.(volumeLevel);

      // Threshold based on vadSensitivity (0..100 -> ~0.01 to 0.15)
      const threshold = 0.02 + ((100 - this.config.vadSensitivity) / 100) * 0.08;
      const now = Date.now();

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
   * Receives and plays remote Int16 PCM Audio packets (Voice 0x05 or Screen Audio 0x02)
   */
  public playRemoteAudioChunk(
    packetType: PacketType,
    payload: Uint8Array,
    userId?: string
  ): void {
    if (this.isDeafened || !payload || payload.byteLength === 0) return;

    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 44100 });
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    // Convert Int16 PCM payload to Float32
    const int16Array = new Int16Array(
      payload.buffer,
      payload.byteOffset,
      payload.byteLength / 2
    );
    const float32Array = this.int16ToFloat32(int16Array);

    const isScreenAudio = packetType === PacketType.SCREEN_AUDIO_PCM;
    const isStereo = isScreenAudio && int16Array.length % 2 === 0;
    const numChannels = isStereo ? 2 : 1;
    const numFrames = float32Array.length / numChannels;

    const audioBuffer = this.audioCtx.createBuffer(
      numChannels,
      numFrames,
      this.audioCtx.sampleRate
    );

    if (numChannels === 1) {
      audioBuffer.copyToChannel(float32Array, 0);
    } else {
      // De-interleave stereo
      const left = new Float32Array(numFrames);
      const right = new Float32Array(numFrames);
      for (let i = 0; i < numFrames; i++) {
        left[i] = float32Array[i * 2];
        right[i] = float32Array[i * 2 + 1];
      }
      audioBuffer.copyToChannel(left, 0);
      audioBuffer.copyToChannel(right, 1);
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

    // Audio scheduling with jitter buffer management
    const currentTime = this.audioCtx.currentTime;
    if (this.nextPlayTime < currentTime) {
      this.nextPlayTime = currentTime + 0.01; // small 10ms safety buffer
    }

    sourceNode.start(this.nextPlayTime);
    this.nextPlayTime += audioBuffer.duration;
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
