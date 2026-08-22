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
  private frameCounter: number = 0;
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
  private hasReceivedKeyframe: boolean = false;
  private lastKeyframeRequestTime: number = 0;
  private targetCanvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private onTelemetryUpdate: OnTelemetryUpdateCallback | null = null;
  private onRequestKeyframe: (() => void) | null = null;

  // Telemetry metrics
  private framesCountInInterval: number = 0;
  private bytesCountInInterval: number = 0;
  private totalFramesDecoded: number = 0;
  private telemetryIntervalId: any = null;
  private activeCodec: string = 'vp8'; // VP8 standard for universal zero-latency realtime cross-compatibility

  constructor() {
    this.startTelemetryTimer();
  }

  public setOnVideoPacket(cb: OnVideoPacketCallback) {
    this.onVideoPacket = cb;
  }

  public setOnTelemetryUpdate(cb: OnTelemetryUpdateCallback) {
    this.onTelemetryUpdate = cb;
  }

  public setOnRequestKeyframe(cb: () => void) {
    this.onRequestKeyframe = cb;
  }

  public getActiveCodec(): string {
    return this.activeCodec;
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

  private requestKeyframeThrottle() {
    const now = performance.now();
    if (now - this.lastKeyframeRequestTime > 800) {
      this.lastKeyframeRequestTime = now;
      this.onRequestKeyframe?.();
    }
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
    this.frameCounter = 0;
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

    // Try VP8 first for universal hardware/software acceleration without missing SPS/PPS issues
    const vp8Config = {
      codec: 'vp8',
      width: profileConfig.width,
      height: profileConfig.height,
      bitrate: profileConfig.bitrate,
      framerate: profileConfig.fps,
      latencyMode: 'realtime',
      hardwareAcceleration: 'prefer-hardware',
    };

    try {
      const support = await (window as any).VideoEncoder.isConfigSupported(vp8Config);
      if (support.supported) {
        this.activeCodec = 'vp8';
        this.encoder.configure(support.config);
        logger.success('VIDEO-GPU', `VideoEncoder configurado em ${profileConfig.width}x${profileConfig.height} @ ${profileConfig.fps} FPS (${profileConfig.label}) usando VP8`);
      } else {
        // Fallback to VP8 default config
        this.activeCodec = 'vp8';
        this.encoder.configure({
          codec: 'vp8',
          width: profileConfig.width,
          height: profileConfig.height,
          bitrate: profileConfig.bitrate,
          framerate: profileConfig.fps,
          latencyMode: 'realtime',
        });
        logger.info('VIDEO-GPU', `VideoEncoder configurado com VP8 realtime`);
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
                // Emit keyframe on demand OR periodically every 60 frames (1s) so new viewers recover immediately
                const isKey = this.forceNextKeyframe || (this.frameCounter % 60 === 0);
                if (isKey) {
                  this.forceNextKeyframe = false;
                }
                this.frameCounter++;
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
          const isKey = this.forceNextKeyframe || (this.frameCounter % 60 === 0);
          if (isKey) {
            this.forceNextKeyframe = false;
          }
          this.frameCounter++;
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

  public initDecoder(codec: string = this.activeCodec) {
    if (!('VideoDecoder' in window)) {
      console.warn('WebCodecs VideoDecoder não suportado nativamente neste contexto.');
      return;
    }

    this.activeCodec = codec || 'vp8';
    this.hasReceivedKeyframe = false;

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
        const errMsg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
        console.warn('VideoDecoder erro interno:', errMsg);
        this.isDecoderConfigured = false;
        this.hasReceivedKeyframe = false;
        this.requestKeyframeThrottle();
      },
    });

    try {
      this.decoder.configure({
        codec: this.activeCodec,
      });
      this.isDecoderConfigured = true;
      logger.info('VIDEO-GPU', `VideoDecoder configurado com codec ${this.activeCodec}`);
    } catch (e) {
      console.warn(`Falha ao configurar decoder com ${this.activeCodec}, tentando fallback VP8:`, e);
      try {
        this.activeCodec = 'vp8';
        this.decoder.configure({
          codec: 'vp8',
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
    if (!this.decoder || !this.isDecoderConfigured || this.decoder.state !== 'configured') {
      this.initDecoder(this.activeCodec);
    }

    if (!this.decoder || this.decoder.state !== 'configured') {
      return;
    }

    // WebCodecs requires the first decoded frame after configure() to be a keyframe.
    // If we receive delta frames before the first keyframe arrives, ignore delta to prevent decoder crash.
    if (!this.hasReceivedKeyframe) {
      if (!isKeyframe) {
        this.requestKeyframeThrottle();
        return;
      }
      this.hasReceivedKeyframe = true;
    }

    try {
      const cleanData =
        payload.byteOffset === 0 && payload.buffer.byteLength === payload.byteLength
          ? payload
          : payload.slice();

      const chunk = new (window as any).EncodedVideoChunk({
        type: isKeyframe ? 'key' : 'delta',
        timestamp: Math.max(0, Math.floor(timestampUs)),
        data: cleanData,
      });

      this.decoder.decode(chunk);

      this.bytesCountInInterval += payload.byteLength;
      this.framesCountInInterval++;
      this.totalFramesDecoded++;
    } catch (err: any) {
      console.warn('Erro ao decodificar EncodedVideoChunk:', err?.message || err);
      this.hasReceivedKeyframe = false;
      this.requestKeyframeThrottle();
    }
  }

  private renderFrameToCanvas(frame: any) {
    if (!this.targetCanvas) return;
    if (!this.canvasCtx) {
      this.canvasCtx = this.targetCanvas.getContext('2d', { alpha: false, desynchronized: true });
    }
    if (!this.canvasCtx) return;

    const width = frame.displayWidth || frame.codedWidth;
    const height = frame.displayHeight || frame.codedHeight;

    if (width && height && (this.targetCanvas.width !== width || this.targetCanvas.height !== height)) {
      this.targetCanvas.width = width;
      this.targetCanvas.height = height;
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
        codec: this.activeCodec.toUpperCase(),
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
