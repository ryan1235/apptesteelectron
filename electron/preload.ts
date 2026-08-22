import { contextBridge, ipcRenderer } from 'electron';

export interface OverlayParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
  isSpeaking: boolean;
  micOn: boolean;
  isDeafened?: boolean;
  activity?: string;
}

export interface OverlayRecentMessage {
  id: string;
  userName: string;
  content: string;
  avatarUrl?: string | null;
  timestamp: number;
}

export interface OverlayState {
  activeRoomTitle?: string;
  participants: OverlayParticipant[];
  recentMessages: OverlayRecentMessage[];
  isLocked: boolean;
  detectedGame?: string;
  myMicOn: boolean;
  myDeafened: boolean;
}

export interface DesktopSource {
  id: string;
  name: string;
  display_id?: string;
  thumbnailUrl: string;
  appIconUrl: string | null;
  isScreen: boolean;
}

const electronAPI = {
  getDesktopSources: (): Promise<DesktopSource[]> => {
    return ipcRenderer.invoke('get-desktop-sources');
  },
  startProcessAudioCapture: (sourceId: string): Promise<boolean> => {
    return ipcRenderer.invoke('start-process-audio-capture', sourceId);
  },
  stopProcessAudioCapture: (): Promise<boolean> => {
    return ipcRenderer.invoke('stop-process-audio-capture');
  },
  onNativeProcessAudio: (callback: (chunk: ArrayBuffer) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: ArrayBuffer) => callback(chunk);
    ipcRenderer.on('native-process-audio-chunk', handler);
    return () => {
      ipcRenderer.removeListener('native-process-audio-chunk', handler);
    };
  },
  minimizeWindow: () => {
    ipcRenderer.send('window-minimize');
  },
  maximizeWindow: () => {
    ipcRenderer.send('window-maximize');
  },
  closeWindow: () => {
    ipcRenderer.send('window-close');
  },
  isMaximized: (): Promise<boolean> => {
    return ipcRenderer.invoke('is-window-maximized');
  },
  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: { isMaximized: boolean }) => callback(state);
    ipcRenderer.on('window-state-changed', handler);
    return () => {
      ipcRenderer.removeListener('window-state-changed', handler);
    };
  },

  // In-Game Overlay IPC
  updateOverlayState: (state: OverlayState) => {
    ipcRenderer.send('update-overlay-state', state);
  },
  onOverlayStateUpdated: (callback: (state: OverlayState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: OverlayState) => callback(state);
    ipcRenderer.on('overlay-state-updated', handler);
    return () => {
      ipcRenderer.removeListener('overlay-state-updated', handler);
    };
  },
  setOverlayIgnoreMouse: (ignore: boolean) => {
    ipcRenderer.send('set-overlay-ignore-mouse', ignore);
  },
  toggleOverlay: () => {
    ipcRenderer.send('toggle-overlay-window');
  },

  // Global Shortcuts Listeners
  onGlobalToggleMic: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('global-toggle-mic', handler);
    return () => {
      ipcRenderer.removeListener('global-toggle-mic', handler);
    };
  },
  onGlobalToggleDeafen: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('global-toggle-deafen', handler);
    return () => {
      ipcRenderer.removeListener('global-toggle-deafen', handler);
    };
  },
  onGlobalToggleOverlay: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('global-toggle-overlay', handler);
    return () => {
      ipcRenderer.removeListener('global-toggle-overlay', handler);
    };
  },
  onGlobalToggleScreen: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('global-toggle-screen', handler);
    return () => {
      ipcRenderer.removeListener('global-toggle-screen', handler);
    };
  },

  // Game Activity (Rich Presence) Listener
  onGameActivityDetected: (callback: (activity: string | null) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, activity: string | null) => callback(activity);
    ipcRenderer.on('game-activity-detected', handler);
    return () => {
      ipcRenderer.removeListener('game-activity-detected', handler);
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
