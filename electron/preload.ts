import { contextBridge, ipcRenderer } from 'electron';

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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
