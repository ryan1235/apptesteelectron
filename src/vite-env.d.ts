/// <reference types="vite/client" />

import { OverlayState } from './types/live-room';

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

  // In-Game Overlay
  updateOverlayState: (state: OverlayState) => void;
  onOverlayStateUpdated: (callback: (state: OverlayState) => void) => () => void;
  setOverlayIgnoreMouse: (ignore: boolean) => void;
  toggleOverlay: () => void;
  sendOverlayVideoFrame: (frameData: string) => void;
  onOverlayVideoFrame: (callback: (frameData: string) => void) => () => void;
  saveOverlayConfig: (configUpdate: Partial<OverlayState>) => void;
  onOverlayConfigSaved: (callback: (configUpdate: Partial<OverlayState>) => void) => () => void;

  // Global Shortcuts
  onGlobalToggleMic: (callback: () => void) => () => void;
  onGlobalToggleDeafen: (callback: () => void) => () => void;
  onGlobalToggleOverlay: (callback: () => void) => () => void;
  onGlobalToggleScreen: (callback: () => void) => () => void;

  // Game Activity
  onGameActivityDetected: (callback: (activity: string | null) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
