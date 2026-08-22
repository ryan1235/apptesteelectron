import { app, BrowserWindow, ipcMain, desktopCapturer } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let activeProcessCapture: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Enable desktop loopback audio capture, autoplay and suppress DXGI/WGC internal logs
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch(
  'disable-features',
  'WebRtcAllowWgcScreenCapturer,WebRtcAllowWgcWindowCapturer,AllowWgcScreenCapturer,AllowWgcWindowCapturer'
);

function getProcessAudioCaptureExePath(): string {
  // 1. Packaged app: process.resourcesPath/ProcessAudioCapture.exe
  const packagedPath = path.join(process.resourcesPath, 'ProcessAudioCapture.exe');
  if (fs.existsSync(packagedPath)) return packagedPath;

  // 2. dist-electron/ProcessAudioCapture.exe
  const distPath = path.join(__dirname, 'ProcessAudioCapture.exe');
  if (fs.existsSync(distPath)) return distPath;

  // 3. native/ProcessAudioCapture.exe
  const nativePath = path.join(__dirname, '../native/ProcessAudioCapture.exe');
  if (fs.existsSync(nativePath)) return nativePath;

  return 'native/ProcessAudioCapture.exe';
}

function stopProcessAudioCapture() {
  if (activeProcessCapture) {
    try {
      activeProcessCapture.kill('SIGKILL');
    } catch (e) {}
    activeProcessCapture = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false, // Discord custom frameless titlebar
    backgroundColor: '#1e1f22',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  if (isDev) {
    const devUrl = 'http://127.0.0.1:5173';
    mainWindow.loadURL(devUrl).catch(() => {
      mainWindow?.loadURL('http://localhost:5173').catch(console.error);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    stopProcessAudioCapture();
    mainWindow = null;
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-state-changed', { isMaximized: false });
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopProcessAudioCapture();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler for desktopCapturer sources (screens & windows)
ipcMain.handle('get-desktop-sources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 480, height: 270 },
      fetchWindowIcons: true,
    });

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      display_id: source.display_id,
      thumbnailUrl: source.thumbnail && !source.thumbnail.isEmpty() ? source.thumbnail.toDataURL() : '',
      appIconUrl: source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : null,
      isScreen: source.id.startsWith('screen:'),
    }));
  } catch (error) {
    console.error('Error fetching desktop capturer sources:', error);
    return [];
  }
});

// Native WASAPI Process Audio Capture handlers
ipcMain.handle('start-process-audio-capture', async (_event, sourceId: string) => {
  stopProcessAudioCapture();

  try {
    const exePath = getProcessAudioCaptureExePath();
    let args: string[] = [];

    if (sourceId && sourceId.startsWith('window:')) {
      const parts = sourceId.split(':');
      const hwnd = parts[1];
      args = ['--hwnd', hwnd];
    } else {
      console.warn('[WASAPI-AUDIO] Process audio capture is only applicable to application windows');
      return false;
    }

    console.log(`[WASAPI-AUDIO] Spawning ${exePath} with args:`, args);
    activeProcessCapture = spawn(exePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    activeProcessCapture.stdout?.on('data', (chunk: Buffer) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          'native-process-audio-chunk',
          chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)
        );
      }
    });

    activeProcessCapture.stderr?.on('data', (errData: Buffer) => {
      console.log('[WASAPI-AUDIO]', errData.toString().trim());
    });

    activeProcessCapture.on('close', (code) => {
      console.log('[WASAPI-AUDIO] Process exited with code', code);
      activeProcessCapture = null;
    });

    return true;
  } catch (err) {
    console.error('[WASAPI-AUDIO] Failed to start process audio capture:', err);
    return false;
  }
});

ipcMain.handle('stop-process-audio-capture', async () => {
  stopProcessAudioCapture();
  return true;
});

// Window control IPC handlers
ipcMain.on('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on('window-close', () => {
  stopProcessAudioCapture();
  mainWindow?.close();
});

ipcMain.handle('is-window-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});
