import { QualityProfile, QUALITY_PROFILES, DesktopSource } from '../types/live-room';

export interface ScreenCaptureResult {
  stream: MediaStream;
  hasAudio: boolean;
  sourceName: string;
}

export class ScreenCapturer {
  private activeStream: MediaStream | null = null;

  /**
   * Fetches available screens and application windows from Electron desktopCapturer.
   */
  public async getSources(): Promise<DesktopSource[]> {
    if (window.electronAPI?.getDesktopSources) {
      return await window.electronAPI.getDesktopSources();
    }

    // Fallback if running outside Electron (mock sources for testing)
    return [
      {
        id: 'screen:0:0',
        name: 'Tela Inteira 1 (Monitor Principal)',
        thumbnailUrl: '',
        appIconUrl: null,
        isScreen: true,
      },
      {
        id: 'window:100:0',
        name: 'Visual Studio Code',
        thumbnailUrl: '',
        appIconUrl: null,
        isScreen: false,
      },
      {
        id: 'window:200:0',
        name: 'Google Chrome',
        thumbnailUrl: '',
        appIconUrl: null,
        isScreen: false,
      }
    ];
  }

  /**
   * Captures the screen/window with the given quality profile constraints.
   */
  public async startCapture(
    sourceId: string,
    profile: QualityProfile = 'SMOOTH_60FPS',
    captureAudio: boolean = true
  ): Promise<ScreenCaptureResult> {
    const config = QUALITY_PROFILES[profile];

    // If running in Electron with desktopCapturer source ID
    if (window.electronAPI && sourceId) {
      const constraints: any = {
        audio: captureAudio
          ? {
              mandatory: {
                chromeMediaSource: 'desktop',
              },
            }
          : false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: config.width,
            maxWidth: config.width,
            minHeight: config.height,
            maxHeight: config.height,
            minFrameRate: config.fps,
            maxFrameRate: config.fps,
          },
        },
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.activeStream = stream;
        const hasAudio = stream.getAudioTracks().length > 0;
        return {
          stream,
          hasAudio,
          sourceName: sourceId.startsWith('screen:') ? 'Tela Inteira' : 'Janela de Aplicativo',
        };
      } catch (err) {
        console.warn('Erro ao capturar via chromeMediaSourceId, tentando getDisplayMedia:', err);
      }
    }

    // Standard Web getDisplayMedia API fallback
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: config.width, max: config.width },
        height: { ideal: config.height, max: config.height },
        frameRate: { ideal: config.fps, max: config.fps },
      },
      audio: captureAudio,
    });

    this.activeStream = displayStream;
    const hasAudio = displayStream.getAudioTracks().length > 0;

    return {
      stream: displayStream,
      hasAudio,
      sourceName: 'Compartilhamento de Tela',
    };
  }

  public stopCapture() {
    if (this.activeStream) {
      this.activeStream.getTracks().forEach((track) => track.stop());
      this.activeStream = null;
    }
  }

  public getActiveStream(): MediaStream | null {
    return this.activeStream;
  }
}
