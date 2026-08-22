import { AppConfig } from '../types/live-room';

const STORAGE_KEY = 'discord_live_rooms_config_v2';
const CLIENT_USER_ID_KEY = 'discord_live_rooms_client_user_id';

export function getOrCreateClientUserId(): string {
  try {
    let id = localStorage.getItem(CLIENT_USER_ID_KEY);
    if (!id || id.trim().length === 0) {
      const rand = Math.random().toString(36).substring(2, 10);
      id = `usr_app_${rand}`;
      localStorage.setItem(CLIENT_USER_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return `usr_app_${Math.random().toString(36).substring(2, 10)}`;
  }
}

export function normalizeWsUrl(apiUrl: string, wsUrl: string): string {
  let normalized = wsUrl.trim();
  if (apiUrl.startsWith('https://') && normalized.startsWith('ws://')) {
    normalized = 'wss://' + normalized.slice(5);
  }
  return normalized;
}

export function getDefaultConfig(): AppConfig {
  const env = import.meta.env;
  const apiUrl = env.VITE_API_URL || 'https://archpixel.squareweb.app';
  let wsUrl = env.VITE_WS_URL || 'wss://archpixel.squareweb.app/ws/live-room';

  wsUrl = normalizeWsUrl(apiUrl, wsUrl);

  return {
    apiUrl,
    wsUrl,
    jwtToken: env.VITE_JWT_TOKEN || '',
    clientUserId: getOrCreateClientUserId(),
    userName: env.VITE_DEFAULT_USER_NAME || 'Ryan',
    avatarUrl: env.VITE_DEFAULT_AVATAR_URL || '',
    echoCancellation: env.VITE_AUDIO_ECHO_CANCELLATION !== 'false',
    noiseSuppression: env.VITE_AUDIO_NOISE_SUPPRESSION !== 'false',
    rnnoiseSuppression: true,
    autoGainControl: env.VITE_AUDIO_AUTO_GAIN_CONTROL !== 'false',
    autoSensitivity: true,
    inputVolume: 100,
    outputVolume: 100,
    preventScreenAudioLoopback: env.VITE_SCREEN_AUDIO_LOOPBACK_PREVENTION !== 'false',
    vadSensitivity: 40,
    enableInGameOverlay: true,
    overlayPosition: 'top-left',
    mockMode: false,
  };
}

export function loadSavedConfig(): AppConfig {
  const defaults = getDefaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return {
      ...defaults,
      ...parsed,
      clientUserId: parsed.clientUserId || defaults.clientUserId || getOrCreateClientUserId(),
      apiUrl: defaults.apiUrl || parsed.apiUrl,
      wsUrl: normalizeWsUrl(defaults.apiUrl, parsed.wsUrl || defaults.wsUrl),
    };
  } catch (e) {
    console.warn('Failed to load saved config from localStorage, using defaults', e);
    return defaults;
  }
}

export function saveConfig(config: AppConfig): void {
  try {
    const toSave = {
      ...config,
      wsUrl: normalizeWsUrl(config.apiUrl, config.wsUrl),
    };
    if (config.clientUserId) {
      localStorage.setItem(CLIENT_USER_ID_KEY, config.clientUserId);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error('Failed to save config to localStorage', e);
  }
}
