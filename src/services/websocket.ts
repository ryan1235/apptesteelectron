import {
  AppConfig,
  ClientTxMessage,
  ServerRxMessage,
  PacketType,
  BinaryHeader,
  Participant,
  QualityProfile,
} from '../types/live-room';
import { decodeBinaryPacket } from './binaryProtocol';

export type OnJsonMessageCallback = (msg: ServerRxMessage) => void;
export type OnBinaryVideoCallback = (header: BinaryHeader) => void;
export type OnBinaryAudioCallback = (packetType: PacketType, payload: Uint8Array, userId?: string) => void;
export type OnConnectionStatusCallback = (status: 'connected' | 'connecting' | 'disconnected' | 'mock') => void;

export class LiveRoomWebSocketClient {
  private ws: WebSocket | null = null;
  private config: AppConfig;
  private isExplicitlyClosed: boolean = false;
  private reconnectTimeoutId: any = null;
  private pingIntervalId: any = null;

  private onJsonMessage: OnJsonMessageCallback | null = null;
  private onBinaryVideo: OnBinaryVideoCallback | null = null;
  private onBinaryAudio: OnBinaryAudioCallback | null = null;
  private onConnectionStatus: OnConnectionStatusCallback | null = null;

  // Local simulated room state for mock mode or offline fallback
  private mockParticipants: Participant[] = [];
  private currentRoomId: string | null = null;

  constructor(config: AppConfig) {
    this.config = config;
  }

  public updateConfig(config: AppConfig) {
    this.config = config;
  }

  public setCallbacks(callbacks: {
    onJsonMessage: OnJsonMessageCallback;
    onBinaryVideo: OnBinaryVideoCallback;
    onBinaryAudio: OnBinaryAudioCallback;
    onConnectionStatus: OnConnectionStatusCallback;
  }) {
    this.onJsonMessage = callbacks.onJsonMessage;
    this.onBinaryVideo = callbacks.onBinaryVideo;
    this.onBinaryAudio = callbacks.onBinaryAudio;
    this.onConnectionStatus = callbacks.onConnectionStatus;
  }

  public connect() {
    if (this.config.mockMode) {
      this.initMockConnection();
      return;
    }

    this.isExplicitlyClosed = false;
    this.onConnectionStatus?.('connecting');

    try {
      const url = new URL(this.config.wsUrl);
      if (this.config.jwtToken) {
        url.searchParams.set('token', this.config.jwtToken);
      }

      this.ws = new WebSocket(url.toString());
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.onConnectionStatus?.('connected');
        this.startPingLoop();
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const parsed: ServerRxMessage = JSON.parse(event.data);
            this.onJsonMessage?.(parsed);
          } catch (e) {
            console.error('Failed to parse WebSocket JSON:', e, event.data);
          }
        } else if (event.data instanceof ArrayBuffer) {
          const binaryPacket = decodeBinaryPacket(event.data);
          if (!binaryPacket) return;

          if (binaryPacket.packetType === PacketType.VIDEO_GPU) {
            this.onBinaryVideo?.(binaryPacket);
          } else if (
            binaryPacket.packetType === PacketType.VOICE_AUDIO_PCM ||
            binaryPacket.packetType === PacketType.SCREEN_AUDIO_PCM
          ) {
            this.onBinaryAudio?.(binaryPacket.packetType, binaryPacket.payload);
          }
        }
      };

      this.ws.onclose = () => {
        this.stopPingLoop();
        this.onConnectionStatus?.('disconnected');
        if (!this.isExplicitlyClosed) {
          // Schedule auto-reconnect
          this.reconnectTimeoutId = setTimeout(() => {
            this.connect();
          }, 3000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error, switching to mock simulator fallback if necessary:', err);
      };
    } catch (e) {
      console.warn('WebSocket connection error, starting mock simulator fallback:', e);
      this.initMockConnection();
    }
  }

  private initMockConnection() {
    this.onConnectionStatus?.('mock');
    // Dispatch initial mock connected event
    setTimeout(() => {
      this.onJsonMessage?.({
        type: 'connected',
        userId: 'usr-local-id',
        userName: this.config.userName,
      });
    }, 200);
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingIntervalId = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send ping or telemetry if needed
      }
    }, 15000);
  }

  private stopPingLoop() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  public sendJson(message: ClientTxMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }

    // Mock Mode Handlers for immediate visual testing
    this.handleMockTx(message);
  }

  public sendBinary(data: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  private handleMockTx(msg: ClientTxMessage) {
    switch (msg.type) {
      case 'join_room':
        this.currentRoomId = msg.roomId;
        this.mockParticipants = [
          {
            id: 'usr-local-id',
            name: msg.userName,
            avatarUrl: msg.avatarUrl || null,
            micOn: true,
            isSpeaking: false,
            isScreenSharing: false,
            isHost: true,
          },
          {
            id: 'usr-456',
            name: 'Ana Dev',
            avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
            micOn: true,
            isSpeaking: false,
            isScreenSharing: false,
          },
          {
            id: 'usr-789',
            name: 'Lucas GameDev',
            avatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
            micOn: false,
            isSpeaking: false,
            isScreenSharing: false,
          },
        ];

        this.onJsonMessage?.({
          type: 'room_state',
          participants: this.mockParticipants,
          activePresenter: null,
        });
        break;

      case 'toggle_mic':
        this.onJsonMessage?.({
          type: 'mic_updated',
          userId: 'usr-local-id',
          micOn: msg.micOn,
        });
        break;

      case 'user_speaking':
        this.onJsonMessage?.({
          type: 'speaking_updated',
          userId: 'usr-local-id',
          isSpeaking: msg.isSpeaking,
        });
        break;

      case 'start_screen_share':
        this.onJsonMessage?.({
          type: 'screen_share_started',
          presenterId: 'usr-local-id',
          presenterName: this.config.userName,
          qualityProfile: msg.qualityProfile,
        });
        break;

      case 'stop_screen_share':
        this.onJsonMessage?.({
          type: 'screen_share_stopped',
          presenterId: 'usr-local-id',
        });
        break;

      case 'chat_message':
        this.onJsonMessage?.({
          type: 'chat_message',
          message: {
            id: 'msg-' + Date.now(),
            roomId: msg.roomId,
            userId: 'usr-local-id',
            userName: this.config.userName,
            avatarUrl: this.config.avatarUrl || null,
            content: msg.text,
            createdAt: new Date().toISOString(),
          },
        });
        break;

      case 'leave_room':
        this.currentRoomId = null;
        this.mockParticipants = [];
        break;
    }
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    this.stopPingLoop();
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.onConnectionStatus?.('disconnected');
  }
}
