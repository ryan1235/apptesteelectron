/// <reference types="vite/client" />

export interface DesktopSource {
  id: string;
  name: string;
  display_id?: string;
  thumbnailUrl: string;
  appIconUrl: string | null;
  isScreen: boolean;
}

export interface ElectronAPI {
  getDesktopSources: () => Promise<DesktopSource[]>;
  startProcessAudioCapture: (sourceId: string) => Promise<boolean>;
  stopProcessAudioCapture: () => Promise<boolean>;
  onNativeProcessAudio: (callback: (chunk: ArrayBuffer) => void) => () => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  isMaximized: () => Promise<boolean>;
  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
