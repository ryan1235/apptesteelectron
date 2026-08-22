import { app, BrowserWindow, ipcMain, desktopCapturer, globalShortcut, screen } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, exec, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let activeProcessCapture: ChildProcess | null = null;
let gameScanInterval: any = null;
let lastDetectedGame: string | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Enable desktop loopback audio capture, autoplay, background window capture without throttling
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('log-level', '3');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch(
  'disable-features',
  'CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,ThrottleDisplayableMojoStreams,WebRtcAllowWgcScreenCapturer,WebRtcAllowWgcWindowCapturer,AllowWgcScreenCapturer,AllowWgcWindowCapturer'
);

function getProcessAudioCaptureExePath(): string {
  const packagedPath = path.join(process.resourcesPath, 'ProcessAudioCapture.exe');
  if (fs.existsSync(packagedPath)) return packagedPath;

  const distPath = path.join(__dirname, 'ProcessAudioCapture.exe');
  if (fs.existsSync(distPath)) return distPath;

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

// Database of top games for automatic activity detection (only actual games)
const KNOWN_GAMES: Record<string, string> = {
  'valorant.exe': 'VALORANT',
  'valorant-win64-shipping.exe': 'VALORANT',
  'cs2.exe': 'Counter-Strike 2',
  'csgo.exe': 'Counter-Strike 2',
  'gta5.exe': 'Grand Theft Auto V',
  'gta_sa.exe': 'GTA San Andreas',
  'fivem.exe': 'GTA V (FiveM)',
  'fivem_b2699_gtaprocess.exe': 'GTA V (FiveM)',
  'leagueclientux.exe': 'League of Legends',
  'league of legends.exe': 'League of Legends',
  'fortniteclient-win64-shipping.exe': 'Fortnite',
  'robloxplayerbeta.exe': 'Roblox',
  'javaw.exe': 'Minecraft',
  'minecraft.exe': 'Minecraft',
  'bedrock_server.exe': 'Minecraft Bedrock',
  'overwatch.exe': 'Overwatch 2',
  'r5apex.exe': 'Apex Legends',
  'rocketleague.exe': 'Rocket League',
  'dota2.exe': 'Dota 2',
  'genshinimpact.exe': 'Genshin Impact',
  'honkaistarrail.exe': 'Honkai: Star Rail',
  'cyberpunk2077.exe': 'Cyberpunk 2077',
  'cod.exe': 'Call of Duty: Warzone',
  'rainbowsix.exe': 'Rainbow Six Siege',
  'pubg.exe': 'PUBG',
  'tslgame.exe': 'PUBG',
  'fc24.exe': 'EA FC 24',
  'fc25.exe': 'EA FC 25',
  'rimworldwin64.exe': 'RimWorld',
  'rimworldwin.exe': 'RimWorld',
  'rimworld.exe': 'RimWorld',
  'foxhole.exe': 'Foxhole',
  'war-win64-shipping.exe': 'Foxhole',
  'war.exe': 'Foxhole',
};

function startGameScan() {
  if (process.platform !== 'win32') return;

  const scan = () => {
    exec('tasklist /FO CSV /NH', { windowsHide: true }, (err, stdout) => {
      if (err || !stdout) return;

      const lines = stdout.toLowerCase().split('\n');
      let foundGame: string | null = null;

      for (const line of lines) {
        const match = line.match(/^"([^"]+)"/);
        if (match) {
          const procName = match[1];
          if (KNOWN_GAMES[procName]) {
            foundGame = KNOWN_GAMES[procName];
            break;
          }
        }
      }

      if (foundGame !== lastDetectedGame) {
        lastDetectedGame = foundGame;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('game-activity-detected', foundGame);
        }
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('game-activity-detected', foundGame);
          // Only show overlay when game is running AND in a voice room AND main window is not focused
          if (foundGame && lastOverlayState?.activeRoomTitle && !mainWindow?.isFocused()) {
            overlayWindow.showInactive();
          } else if (!foundGame && !manualOverlayToggle && overlayWindow.isVisible()) {
            overlayWindow.hide();
          }
        }
      }
    });
  };

  scan();
  gameScanInterval = setInterval(scan, 4000);
}

let lastOverlayState: any = null;
let manualOverlayToggle: boolean = false;

function createOverlayWindow() {
  if (overlayWindow) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  overlayWindow = new BrowserWindow({
    width: width || 1920,
    height: height || 1080,
    x: 0,
    y: 0,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    show: false, // strictly hidden until an actual game is active
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Keep overlay window above fullscreen games
  overlayWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Default: pass mouse clicks through directly to the game
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

  const overlayUrl = isDev
    ? 'http://127.0.0.1:5173/?overlay=true'
    : `file://${path.join(__dirname, '../dist/index.html')}?overlay=true`;

  overlayWindow.loadURL(overlayUrl).catch(() => {
    if (isDev) {
      overlayWindow?.loadURL('http://localhost:5173/?overlay=true').catch(console.error);
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    frame: false,
    backgroundColor: '#1e1f22',
    show: true,
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

  // When Discord main app is focused, hide the overlay
  mainWindow.on('focus', () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && !manualOverlayToggle) {
      overlayWindow.hide();
    }
  });

  // When Discord main app is blurred (user alt-tabs into game), show overlay if game is active
  mainWindow.on('blur', () => {
    if (overlayWindow && !overlayWindow.isDestroyed() && lastDetectedGame && lastOverlayState?.activeRoomTitle) {
      overlayWindow.showInactive();
    }
  });

  mainWindow.on('closed', () => {
    stopProcessAudioCapture();
    if (gameScanInterval) clearInterval(gameScanInterval);
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }
    mainWindow = null;
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-state-changed', { isMaximized: false });
  });
}

function registerGlobalHotkeys() {
  try {
    // 1. Toggle Mute (Ctrl + Shift + M)
    globalShortcut.register('CommandOrControl+Shift+M', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('global-toggle-mic');
      }
    });

    // 2. Toggle Deafen (Ctrl + Shift + D)
    globalShortcut.register('CommandOrControl+Shift+D', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('global-toggle-deafen');
      }
    });

    // 3. Toggle In-Game Overlay (Ctrl + Shift + O)
    globalShortcut.register('CommandOrControl+Shift+O', () => {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        if (overlayWindow.isVisible()) {
          overlayWindow.hide();
        } else {
          overlayWindow.showInactive();
        }
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('global-toggle-overlay');
      }
    });

    // 4. Toggle Screen Share (Ctrl + Shift + S)
    globalShortcut.register('CommandOrControl+Shift+S', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('global-toggle-screen');
      }
    });

    console.log('[GLOBAL-HOTKEYS] Registered Ctrl+Shift+M (Mute), Ctrl+Shift+D (Deafen), Ctrl+Shift+O (Overlay), Ctrl+Shift+S (Screen)');
  } catch (err) {
    console.warn('[GLOBAL-HOTKEYS] Failed to register some shortcuts:', err);
  }
}

app.whenReady().then(() => {
  createWindow();
  createOverlayWindow();
  registerGlobalHotkeys();
  startGameScan();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createOverlayWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (gameScanInterval) clearInterval(gameScanInterval);
  stopProcessAudioCapture();
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

// In-Game Overlay IPC Handlers
ipcMain.on('update-overlay-state', (_event, state) => {
  lastOverlayState = state;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay-state-updated', state);

    // Only show overlay when in a room AND a game is actively detected
    const shouldShow = Boolean(state.activeRoomTitle && lastDetectedGame);
    if (shouldShow && !overlayWindow.isVisible()) {
      overlayWindow.showInactive();
    } else if (!shouldShow && !manualOverlayToggle && overlayWindow.isVisible()) {
      overlayWindow.hide();
    }
  }
});

ipcMain.on('set-overlay-ignore-mouse', (_event, ignore: boolean) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('toggle-overlay-window', () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isVisible()) {
      manualOverlayToggle = false;
      overlayWindow.hide();
    } else {
      manualOverlayToggle = true;
      overlayWindow.showInactive();
    }
  }
});

ipcMain.on('overlay-video-frame', (_event, frameData: string) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('overlay-video-frame', frameData);
  }
});

ipcMain.on('save-overlay-config', (_event, configUpdate: any) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('overlay-config-saved', configUpdate);
  }
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
  if (gameScanInterval) clearInterval(gameScanInterval);
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
  }
  mainWindow?.close();
});

ipcMain.handle('is-window-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});
