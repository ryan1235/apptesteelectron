// ==========================================
// Tipos REST API & Live Rooms
// ==========================================

export interface UserSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface LiveGroupMember {
  id: string;
  clientUserId: string;
  userName: string;
  avatarUrl?: string | null;
  role?: string;
  joinedAt: string;
}

export interface LiveGroup {
  id: string;
  name: string;
  description?: string;
  customGroupId?: string;
  isPasswordProtected: boolean;
  avatarUrl?: string | null;
  clientUserId: string;
  roomsCount?: number;
  membersCount?: number;
  rooms?: RoomSummary[];
  members?: LiveGroupMember[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupPayload {
  name: string;
  description?: string;
  password?: string | null;
  customGroupId?: string;
  avatarUrl?: string | null;
  clientUserId?: string;
}

export interface RoomSummary {
  id: string;
  title: string;
  description: string;
  isPasswordProtected: boolean;
  maxParticipants: number;
  occupancy: number;
  groupId?: string | null;
  customRoomId?: string | null;
  clientUserId?: string | null;
  createdBy: UserSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomPayload {
  title: string;
  description?: string;
  password?: string | null;
  maxParticipants?: number;
  groupId?: string | null;
  customRoomId?: string | null;
  clientUserId?: string;
  authorName?: string;
}

export interface VerifyPasswordPayload {
  password: string;
}

export interface VerifyPasswordResponse {
  valid: boolean;
  requiresPassword?: boolean;
  error?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  clientUserId?: string;
  userName: string;
  avatarUrl: string | null;
  content: string;
  createdAt: string;
}

export interface RoomDetails {
  id: string;
  title: string;
  description: string;
  isPasswordProtected: boolean;
  maxParticipants: number;
  occupancy: number;
  groupId?: string | null;
  customRoomId?: string | null;
  clientUserId?: string | null;
  createdBy: UserSummary;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export type QualityProfile = 'SMOOTH_60FPS' | 'BALANCED_HD' | 'TEXT_CRISP' | 'LOW_BANDWIDTH';

export interface QualityProfileConfig {
  name: QualityProfile;
  label: string;
  description: string;
  width: number;
  height: number;
  fps: number;
  bitrate: number; // in bps
}

export const QUALITY_PROFILES: Record<QualityProfile, QualityProfileConfig> = {
  SMOOTH_60FPS: {
    name: 'SMOOTH_60FPS',
    label: '60 FPS Fluído (1080p @ 60fps)',
    description: 'Excelente para jogos e animações de alta taxa de quadros (~4 Mbps)',
    width: 1920,
    height: 1080,
    fps: 60,
    bitrate: 4_000_000,
  },
  BALANCED_HD: {
    name: 'BALANCED_HD',
    label: 'HD Equilibrado (1080p @ 30fps)',
    description: 'Ideal para a maioria das transmissões (~2.5 Mbps)',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: 2_500_000,
  },
  TEXT_CRISP: {
    name: 'TEXT_CRISP',
    label: 'Texto Nítido (1440p / 1080p @ 15fps)',
    description: 'Foco total em nitidez de código e fontes sem compressão agressiva (~1.8 Mbps)',
    width: 2560,
    height: 1440,
    fps: 15,
    bitrate: 1_800_000,
  },
  LOW_BANDWIDTH: {
    name: 'LOW_BANDWIDTH',
    label: 'Economia de Dados (720p @ 30fps)',
    description: 'Para conexões lentas ou instáveis (~1 Mbps)',
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: 1_000_000,
  },
};

export interface DesktopSource {
  id: string;
  name: string;
  display_id?: string;
  thumbnailUrl?: string;
  appIconUrl?: string | null;
  isScreen?: boolean;
}

export type ScreenAudioMode = 'app_only' | 'desktop_loopback' | 'none';

// ==========================================
// Tipos de Participantes & Estado em Tempo Real
// ==========================================

export interface Participant {
  id: string;
  name: string;
  avatarUrl: string | null;
  micOn: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  isHost?: boolean;
  joinedAt?: string;
  volume?: number; // 0 to 100 for local playback volume
}

export interface PresenterInfo {
  userId: string;
  userName: string;
  qualityProfile: QualityProfile;
  startedAt: string;
}

// ==========================================
// Protocolo WebSocket TX & RX
// ==========================================

export interface FloatingReaction {
  id: string;
  emoji: string;
  userName: string;
  xOffset: number; // 0 to 100% position on screen
}

export type ClientTxMessage =
  | { type: 'join_room'; roomId: string; password?: string; userName: string; avatarUrl?: string | null; micOn?: boolean; clientUserId?: string }
  | { type: 'toggle_mic'; roomId: string; micOn: boolean; clientUserId?: string }
  | { type: 'user_speaking'; roomId: string; isSpeaking: boolean; clientUserId?: string }
  | { type: 'start_screen_share'; roomId: string; qualityProfile: QualityProfile; codec?: string; clientUserId?: string }
  | { type: 'stop_screen_share'; roomId: string; clientUserId?: string }
  | { type: 'request_keyframe'; roomId: string }
  | { type: 'chat_message'; roomId: string; text?: string; content?: string; clientUserId?: string; userName?: string; avatarUrl?: string | null }
  | { type: 'typing'; roomId: string; isTyping: boolean; userName?: string; clientUserId?: string }
  | { type: 'reaction'; roomId: string; emoji: string; userName?: string; clientUserId?: string }
  | { type: 'leave_room'; roomId: string; clientUserId?: string };

export type ServerRxMessage =
  | { type: 'connected'; userId?: string; userName?: string; clientUserId?: string }
  | { type: 'room_state'; roomId?: string; title?: string; isPasswordProtected?: boolean; maxParticipants?: number; room?: Partial<RoomDetails>; participants?: Participant[]; activePresenter?: PresenterInfo | null; activeScreenShare?: any; yourUserId?: string; yourClientUserId?: string; messages?: ChatMessage[] }
  | { type: 'user_joined'; user?: any; participant?: any; userId?: string; userName?: string; clientUserId?: string; avatarUrl?: string | null; micOn?: boolean; isSpeaking?: boolean; isSharing?: boolean; isScreenSharing?: boolean }
  | { type: 'user_left'; userId?: string; userName?: string; clientUserId?: string; user?: any }
  | { type: 'screen_share_started'; presenterId?: string; userId?: string; name?: string; presenterName?: string; userName?: string; qualityProfile?: QualityProfile; codec?: string }
  | { type: 'screen_share_stopped'; presenterId?: string; userId?: string }
  | { type: 'mic_updated'; userId?: string; userName?: string; micOn?: boolean; user?: any }
  | { type: 'mic_toggled'; userId?: string; userName?: string; micOn?: boolean; user?: any }
  | { type: 'speaking_updated'; userId?: string; userName?: string; isSpeaking?: boolean; user?: any }
  | { type: 'chat_message'; message?: ChatMessage; id?: string; roomId?: string; userId?: string; clientUserId?: string; userName?: string; name?: string; avatarUrl?: string | null; content?: string; text?: string; createdAt?: string }
  | { type: 'typing'; userId?: string; clientUserId?: string; userName?: string; isTyping?: boolean }
  | { type: 'reaction'; emoji?: string; userName?: string; userId?: string; clientUserId?: string }
  | { type: 'request_keyframe'; roomId?: string; requestedBy?: string }
  | { type: 'room_closed'; roomId: string; reason?: string }
  | { type: 'error'; error?: string; message?: string }
  | { type: 'auth_required'; error?: string };

// ==========================================
// Protocolo Binário (50 Bytes Header)
// ==========================================

export const BINARY_MAGIC_BYTE = 0xAA;
export const HEADER_SIZE = 50;

export enum PacketType {
  VIDEO_GPU = 0x01,          // Frame de Vídeo (WebCodecs GPU Chunk)
  SCREEN_AUDIO_PCM = 0x02,   // Áudio de Compartilhamento de Tela (PCM Stereo)
  TELEMETRY_PING = 0x03,     // Telemetria / Ping
  CONTROL = 0x04,            // Controle
  VOICE_AUDIO_PCM = 0x05,    // Áudio de Microfone / Voice Chat (PCM 44.1kHz / 48kHz)
}

export interface BinaryHeader {
  magic: number;             // 0xAA (Uint8)
  packetType: PacketType;    // Uint8
  roomId: string;            // 36 Bytes ASCII
  isKeyframe: boolean;       // Uint8: 1 = Keyframe, 0 = Delta
  timestampUs: number;       // Float64 (microssegundos)
  sequenceNumber: number;    // 3 Bytes (0..16777215)
  payload: Uint8Array;       // Raw data
}

// ==========================================
// Configurações e Telemetria
// ==========================================

export interface AppConfig {
  apiUrl: string;
  wsUrl: string;
  jwtToken: string;
  clientUserId: string;
  userName: string;
  avatarUrl: string;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  preventScreenAudioLoopback: boolean;
  vadSensitivity: number; // 0 to 100
  selectedMicrophoneId?: string;
  selectedSpeakerId?: string;
  mockMode: boolean;
}

export interface TelemetryStats {
  fps: number;
  bitrateKbps: number;
  latencyMs: number;
  packetsReceived: number;
  packetsSent: number;
  bytesReceived: number;
  bytesSent: number;
  audioJitterMs: number;
  codec: string;
}
