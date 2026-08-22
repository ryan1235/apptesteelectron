import {
  ClientTxMessage,
  ServerRxMessage,
  PacketType,
  BinaryHeader,
  AppConfig,
  Participant,
} from '../types/live-room';
import { decodeBinaryPacket, encodeBinaryPacket } from './binaryProtocol';
import { logger } from './logger';

export type OnJsonMessageCallback = (msg: ServerRxMessage) => void;
export type OnBinaryVideoCallback = (header: BinaryHeader) => void;
export type OnBinaryAudioCallback = (packetType: PacketType, payload: ArrayBuffer, senderId?: string) => void;
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
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.config.mockMode) {
      this.initMockConnection();
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.onConnectionStatus?.('connecting');
    logger.info('WS-TX', `Conectando ao WebSocket: ${this.config.wsUrl}`);

    try {
      const url = new URL(this.config.wsUrl);
      if (this.config.jwtToken && this.config.jwtToken.trim().length > 0) {
        url.searchParams.set('token', this.config.jwtToken.trim());
      }

      this.ws = new WebSocket(url.toString());
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        logger.success('WS-RX', `WebSocket conectado com sucesso em ${this.config.wsUrl}`);
        this.onConnectionStatus?.('connected');
        this.startPingLoop();
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const parsed: ServerRxMessage = JSON.parse(event.data);
            logger.info('WS-RX', `[JSON] ${(parsed as any).type || 'evento'}`, parsed);
            this.onJsonMessage?.(parsed);
          } catch (e) {
            logger.error('WS-RX', 'Falha ao processar JSON do WebSocket:', event.data);
          }
        } else if (event.data instanceof ArrayBuffer) {
          const binaryPacket = decodeBinaryPacket(event.data);
          if (!binaryPacket) {
            return;
          }

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

      this.ws.onclose = (ev) => {
        this.stopPingLoop();
        this.onConnectionStatus?.('disconnected');
        logger.warn('WS-RX', `WebSocket desconectado (Código: ${ev.code}, Razão: ${ev.reason || 'Nenhuma'})`);
        if (!this.isExplicitlyClosed) {
          // Schedule auto-reconnect
          this.reconnectTimeoutId = setTimeout(() => {
            logger.info('WS-TX', 'Tentando reconectar WebSocket...');
            this.connect();
          }, 3000);
        }
      };

      this.ws.onerror = (err) => {
        logger.error('WS-RX', 'Erro de conexão WebSocket:', err);
      };
    } catch (e: any) {
      logger.error('WS-RX', 'Exceção ao instanciar WebSocket:', e.message);
      this.initMockConnection();
    }
  }

  private initMockConnection() {
    this.onConnectionStatus?.('mock');
    logger.info('SYSTEM', 'Modo de simulação local / mock ativado');
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
        // Envia pacote binário 50-byte de telemetria/ping (0x03) para manter o WebSocket ativo no proxy sem desconectar
        const packet = encodeBinaryPacket({
          packetType: PacketType.TELEMETRY,
          roomId: this.currentRoomId || '00000000-0000-0000-0000-000000000000',
          timestampUs: performance.now() * 1000,
          sequenceNumber: 0,
        });
        this.ws.send(packet);
      }
    }, 10000);
  }

  private stopPingLoop() {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  public sendJson(message: ClientTxMessage) {
    if (message.type === 'join_room') {
      this.currentRoomId = message.roomId;
    } else if (message.type === 'leave_room') {
      this.currentRoomId = null;
    }

    logger.info('WS-TX', `[JSON] ${(message as any).type}`, message);
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
        ];

        this.onJsonMessage?.({
          type: 'room_state',
          participants: this.mockParticipants,
          activePresenter: null,
        });
        break;

      case 'leave_room':
        this.currentRoomId = null;
        break;

      case 'toggle_mic':
        this.mockParticipants = this.mockParticipants.map((p) =>
          p.id === 'usr-local-id' ? { ...p, micOn: msg.micOn } : p
        );
        this.onJsonMessage?.({
          type: 'mic_updated',
          userId: 'usr-local-id',
          micOn: msg.micOn,
        });
        break;

      case 'user_speaking':
        this.mockParticipants = this.mockParticipants.map((p) =>
          p.id === 'usr-local-id' ? { ...p, isSpeaking: msg.isSpeaking } : p
        );
        this.onJsonMessage?.({
          type: 'speaking_updated',
          userId: 'usr-local-id',
          isSpeaking: msg.isSpeaking,
        });
        break;

      case 'start_screen_share':
        this.mockParticipants = this.mockParticipants.map((p) =>
          p.id === 'usr-local-id' ? { ...p, isScreenSharing: true } : p
        );
        this.onJsonMessage?.({
          type: 'screen_share_started',
          presenterId: 'usr-local-id',
          presenterName: this.config.userName,
          qualityProfile: msg.qualityProfile,
        });
        break;

      case 'stop_screen_share':
        this.mockParticipants = this.mockParticipants.map((p) =>
          p.id === 'usr-local-id' ? { ...p, isScreenSharing: false } : p
        );
        this.onJsonMessage?.({
          type: 'screen_share_stopped',
          presenterId: 'usr-local-id',
        });
        break;
    }
  }

  public disconnect() {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    this.stopPingLoop();
    if (this.ws) {
      logger.info('WS-TX', 'Fechando conexão do WebSocket.');
      this.ws.close();
      this.ws = null;
    }
  }
}
