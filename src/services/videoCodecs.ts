import {
  PacketType,
  QualityProfile,
  QUALITY_PROFILES,
} from '../types/live-room';
import { encodeBinaryPacket } from './binaryProtocol';
import { logger } from './logger';

export type OnVideoPacketCallback = (packet: ArrayBuffer) => void;
export type OnTelemetryUpdateCallback = (stats: {
  fps: number;
  bitrateKbps: number;
  framesDecoded: number;
  codec: string;
}) => void;

export class WebCodecsVideoPipeline {
  // Encoder properties
  private encoder: any = null;
  private isEncoding: boolean = false;
  private forceNextKeyframe: boolean = true;
  private currentRoomId: string = '';
  private encodeSequence: number = 0;
  private currentProfile: QualityProfile = 'SMOOTH_60FPS';
  private onVideoPacket: OnVideoPacketCallback | null = null;
  private frameReaderTrack: MediaStreamTrack | null = null;
  private frameProcessor: any = null;
  private frameCaptureLoopId: number | null = null;

  // Decoder properties
  private decoder: any = null;
  private isDecoderConfigured: boolean = false;
  private targetCanvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private onTelemetryUpdate: OnTelemetryUpdateCallback | null = null;

  // Telemetry metrics
  private framesCountInInterval: number = 0;
  private bytesCountInInterval: number = 0;
  private totalFramesDecoded: number = 0;
  private telemetryIntervalId: any = null;
  private activeCodec: string = 'avc1.42002a'; // H.264 Baseline/Main

  constructor() {
    this.startTelemetryTimer();
  }

  public setOnVideoPacket(cb: OnVideoPacketCallback) {
    this.onVideoPacket = cb;
  }

  public setOnTelemetryUpdate(cb: OnTelemetryUpdateCallback) {
    this.onTelemetryUpdate = cb;
  }

  public setTargetCanvas(canvas: HTMLCanvasElement | null) {
    this.targetCanvas = canvas;
    if (canvas) {
      this.canvasCtx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    } else {
      this.canvasCtx = null;
    }
  }

  public requestKeyFrame() {
    this.forceNextKeyframe = true;
  }

  // ==========================================
  // ENCODER (Transmitter)
  // ==========================================

  public async startEncoding(
    stream: MediaStream,
    roomId: string,
    profile: QualityProfile = 'SMOOTH_60FPS'
  ): Promise<void> {
    if (!('VideoEncoder' in window)) {
      console.warn('WebCodecs VideoEncoder não suportado nativamente neste navegador/contexto.');
      return;
    }

    this.currentRoomId = roomId;
    this.currentProfile = profile;
    this.forceNextKeyframe = true;
    this.isEncoding = true;

    const profileConfig = QUALITY_PROFILES[profile];
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('Nenhuma faixa de vídeo encontrada no stream.');
    }
    this.frameReaderTrack = videoTrack;

    // Initialize VideoEncoder
    this.encoder = new (window as any).VideoEncoder({
      output: (chunk: any, _metadata: any) => {
        const chunkData = new Uint8Array(chunk.byteLength);
        chunk.copyTo(chunkData);

        // Update telemetry for presenter
        this.bytesCountInInterval += chunk.byteLength;
        this.framesCountInInterval++;
        this.totalFramesDecoded++;

        const packet = encodeBinaryPacket({
          packetType: PacketType.VIDEO_GPU,
          roomId: this.currentRoomId,
          isKeyframe: chunk.type === 'key',
          timestampUs: chunk.timestamp,
          sequenceNumber: (this.encodeSequence++) & 0xFFFFFF,
          payload: chunkData.buffer,
        });

        this.onVideoPacket?.(packet);
      },
      error: (err: any) => {
        console.error('Erro no VideoEncoder WebCodecs:', err);
      },
    });

    const encoderConfig = {
      codec: this.activeCodec,
      width: profileConfig.width,
      height: profileConfig.height,
      bitrate: profileConfig.bitrate,
      framerate: profileConfig.fps,
      latencyMode: 'realtime',
      hardwareAcceleration: 'prefer-hardware',
      avc: { format: 'annexb' },
    };

    // Check if configuration is supported
    try {
      const support = await (window as any).VideoEncoder.isConfigSupported(encoderConfig);
      if (support.supported) {
        this.encoder.configure(support.config);
        logger.success('VIDEO-GPU', `VideoEncoder configurado em ${profileConfig.width}x${profileConfig.height} @ ${profileConfig.fps} FPS (${profileConfig.label}) usando ${this.activeCodec}`);
      } else {
        // Fallback to VP8 if H.264 hardware config is rejected
        this.activeCodec = 'vp8';
        this.encoder.configure({
          codec: 'vp8',
          width: profileConfig.width,
          height: profileConfig.height,
          bitrate: profileConfig.bitrate,
          framerate: profileConfig.fps,
          latencyMode: 'realtime',
        });
        logger.info('VIDEO-GPU', `VideoEncoder configurado com fallback VP8 em ${profileConfig.width}x${profileConfig.height}`);
      }
    } catch (e) {
      console.warn('Fallback para VP8:', e);
      this.activeCodec = 'vp8';
      this.encoder.configure({
        codec: 'vp8',
        width: profileConfig.width,
        height: profileConfig.height,
        bitrate: profileConfig.bitrate,
        framerate: profileConfig.fps,
        latencyMode: 'realtime',
      });
      logger.info('VIDEO-GPU', 'VideoEncoder configurado com fallback VP8');
    }

    // Capture frames: Use MediaStreamTrackProcessor if available, else canvas/video element loop
    if ('MediaStreamTrackProcessor' in window) {
      try {
        this.frameProcessor = new (window as any).MediaStreamTrackProcessor({ track: videoTrack });
        const reader = this.frameProcessor.readable.getReader();

        const processFrames = async () => {
          while (this.isEncoding) {
            try {
              const { done, value: frame } = await reader.read();
              if (done || !frame) break;

              if (this.encoder && this.encoder.state === 'configured') {
                const isKey = this.forceNextKeyframe;
                this.forceNextKeyframe = false;
                this.encoder.encode(frame, { keyFrame: isKey });
              }
              frame.close();
            } catch (err) {
              console.warn('Frame read error:', err);
              break;
            }
          }
        };
        processFrames();
        return;
      } catch (err) {
        console.warn('TrackProcessor failed, using video element frame pump:', err);
      }
    }

    // Fallback: Video element capture loop
    this.startVideoElementCaptureLoop(videoTrack, profileConfig.fps);
  }

  private startVideoElementCaptureLoop(track: MediaStreamTrack, fps: number) {
    const video = document.createElement('video');
    video.srcObject = new MediaStream([track]);
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});

    const intervalMs = Math.max(10, Math.floor(1000 / fps));

    const pump = () => {
      if (!this.isEncoding) {
        video.srcObject = null;
        return;
      }

      if (video.videoWidth > 0 && video.videoHeight > 0 && this.encoder?.state === 'configured') {
        try {
          const frame = new (window as any).VideoFrame(video, {
            timestamp: performance.now() * 1000,
          });
          const isKey = this.forceNextKeyframe;
          this.forceNextKeyframe = false;
          this.encoder.encode(frame, { keyFrame: isKey });
          frame.close();
        } catch (e) {
          // ignore transient frame capture errors
        }
      }

      this.frameCaptureLoopId = window.setTimeout(pump, intervalMs);
    };

    video.onloadedmetadata = () => {
      pump();
    };
  }

  public stopEncoding() {
    this.isEncoding = false;
    if (this.frameCaptureLoopId) {
      clearTimeout(this.frameCaptureLoopId);
      this.frameCaptureLoopId = null;
    }
    if (this.encoder) {
      try {
        if (this.encoder.state === 'configured') {
          this.encoder.flush().catch(() => {});
        }
        this.encoder.close();
      } catch (e) {}
      this.encoder = null;
    }
  }

  // ==========================================
  // DECODER (Receiver & Canvas GPU Renderer)
  // ==========================================

  public initDecoder() {
    if (!('VideoDecoder' in window)) {
      console.warn('WebCodecs VideoDecoder não suportado nativamente neste contexto.');
      return;
    }

    if (this.decoder) {
      try {
        this.decoder.close();
      } catch (e) {}
      this.decoder = null;
    }

    this.decoder = new (window as any).VideoDecoder({
      output: (frame: any) => {
        this.renderFrameToCanvas(frame);
        frame.close();
      },
      error: (err: any) => {
        console.error('Erro no VideoDecoder WebCodecs:', err);
      },
    });

    try {
      this.decoder.configure({
        codec: this.activeCodec,
        hardwareAcceleration: 'prefer-hardware',
        optimizeForLatency: true,
      });
      this.isDecoderConfigured = true;
    } catch (e) {
      console.warn('Falha ao configurar decoder H.264, tentando VP8:', e);
      try {
        this.activeCodec = 'vp8';
        this.decoder.configure({
          codec: 'vp8',
          optimizeForLatency: true,
        });
        this.isDecoderConfigured = true;
      } catch (e2) {
        console.error('Decoder configuration error:', e2);
      }
    }
  }

  public handleIncomingVideoPacket(
    payload: Uint8Array,
    isKeyframe: boolean,
    timestampUs: number
  ) {
    if (!this.decoder || !this.isDecoderConfigured) {
      this.initDecoder();
    }

    if (!this.decoder || this.decoder.state !== 'configured') {
      return;
    }

    try {
      const chunk = new (window as any).EncodedVideoChunk({
        type: isKeyframe ? 'key' : 'delta',
        timestamp: timestampUs,
        data: payload,
      });

      this.decoder.decode(chunk);

      this.bytesCountInInterval += payload.byteLength;
      this.framesCountInInterval++;
      this.totalFramesDecoded++;
    } catch (err) {
      console.warn('Erro ao decodificar EncodedVideoChunk:', err);
    }
  }

  private renderFrameToCanvas(frame: any) {
    if (!this.targetCanvas || !this.canvasCtx) return;

    if (this.targetCanvas.width !== frame.displayWidth || this.targetCanvas.height !== frame.displayHeight) {
      this.targetCanvas.width = frame.displayWidth;
      this.targetCanvas.height = frame.displayHeight;
    }

    this.canvasCtx.drawImage(frame, 0, 0, this.targetCanvas.width, this.targetCanvas.height);
  }

  private startTelemetryTimer() {
    this.telemetryIntervalId = setInterval(() => {
      const fps = this.framesCountInInterval;
      const bitrateKbps = Math.round((this.bytesCountInInterval * 8) / 1000);

      this.framesCountInInterval = 0;
      this.bytesCountInInterval = 0;

      this.onTelemetryUpdate?.({
        fps,
        bitrateKbps,
        framesDecoded: this.totalFramesDecoded,
        codec: this.activeCodec,
      });
    }, 1000);
  }

  public destroy() {
    this.stopEncoding();
    if (this.telemetryIntervalId) {
      clearInterval(this.telemetryIntervalId);
    }
    if (this.decoder) {
      try {
        this.decoder.close();
      } catch (e) {}
      this.decoder = null;
    }
  }
}
