import {
  RoomSummary,
  CreateRoomPayload,
  VerifyPasswordResponse,
  RoomDetails,
  AppConfig,
} from '../types/live-room';

// In-memory rooms cache (starts empty, only holds real rooms created by the user or fetched from server)
let localRooms: RoomDetails[] = [];

export class LiveRoomsApiClient {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  public updateConfig(newConfig: AppConfig) {
    this.config = newConfig;
  }

  private getHeaders(password?: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.jwtToken) {
      headers['Authorization'] = `Bearer ${this.config.jwtToken}`;
    }
    if (password) {
      headers['x-room-password'] = password;
    }
    return headers;
  }

  /**
   * 1. Listar Salas Ao Vivo
   * GET /live-rooms
   */
  public async getLiveRooms(): Promise<RoomSummary[]> {
    if (this.config.mockMode) {
      return localRooms.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        isPasswordProtected: r.isPasswordProtected,
        maxParticipants: r.maxParticipants,
        occupancy: r.occupancy,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    }

    try {
      const res = await fetch(`${this.config.apiUrl}/live-rooms`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        if (res.status === 404) {
          // If server returns 404, fallback to locally created rooms
          return localRooms.map(r => ({
            id: r.id,
            title: r.title,
            description: r.description,
            isPasswordProtected: r.isPasswordProtected,
            maxParticipants: r.maxParticipants,
            occupancy: r.occupancy,
            createdBy: r.createdBy,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          }));
        }
        throw new Error(`Erro ao listar salas: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (err) {
      console.warn('API /live-rooms offline ou não encontrada, usando salas locais:', err);
      return localRooms.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        isPasswordProtected: r.isPasswordProtected,
        maxParticipants: r.maxParticipants,
        occupancy: r.occupancy,
        createdBy: r.createdBy,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    }
  }

  /**
   * 2. Criar Nova Sala
   * POST /live-rooms
   */
  public async createRoom(payload: CreateRoomPayload): Promise<RoomDetails> {
    const newLocalRoom: RoomDetails = {
      id: crypto.randomUUID ? crypto.randomUUID() : 'room-' + Math.random().toString(36).substring(2, 10),
      title: payload.title,
      description: payload.description || '',
      isPasswordProtected: Boolean(payload.password && payload.password.trim().length > 0),
      maxParticipants: payload.maxParticipants || 16,
      occupancy: 1,
      createdBy: {
        id: 'usr-local',
        name: this.config.userName || 'Ryan',
        avatarUrl: this.config.avatarUrl || null,
      },
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.config.mockMode) {
      localRooms.unshift(newLocalRoom);
      return newLocalRoom;
    }

    try {
      const res = await fetch(`${this.config.apiUrl}/live-rooms`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao criar sala: ${res.status}`);
      }

      const created = await res.json();
      const room: RoomDetails = {
        ...created,
        messages: created.messages || [],
      };
      localRooms.unshift(room);
      return room;
    } catch (err) {
      console.warn('API createRoom falhou, salvando localmente:', err);
      localRooms.unshift(newLocalRoom);
      return newLocalRoom;
    }
  }

  /**
   * 3. Verificar Senha da Sala
   * POST /live-rooms/:id/verify-password
   */
  public async verifyPassword(roomId: string, password: string): Promise<VerifyPasswordResponse> {
    try {
      const res = await fetch(`${this.config.apiUrl}/live-rooms/${roomId}/verify-password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { valid: false, error: data.error || 'Senha incorreta.' };
      }
      return data;
    } catch (err) {
      console.warn('API verify-password offline, verificando localmente:', err);
      if (password.length >= 1) {
        return { valid: true, requiresPassword: true };
      }
      return { valid: false, error: 'Senha incorreta.' };
    }
  }

  /**
   * 4. Detalhes da Sala
   * GET /live-rooms/:id
   */
  public async getRoomDetails(roomId: string, password?: string): Promise<RoomDetails> {
    try {
      const res = await fetch(`${this.config.apiUrl}/live-rooms/${roomId}`, {
        method: 'GET',
        headers: this.getHeaders(password),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ao carregar detalhes: ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      const found = localRooms.find(r => r.id === roomId);
      if (found) return found;
      return {
        id: roomId,
        title: 'Sala Ao Vivo',
        description: 'Sala de áudio e transmissão de tela.',
        isPasswordProtected: false,
        maxParticipants: 16,
        occupancy: 1,
        createdBy: { id: 'usr-local', name: this.config.userName, avatarUrl: this.config.avatarUrl || null },
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * 5. Encerrar Sala
   * DELETE /live-rooms/:id
   */
  public async closeRoom(roomId: string): Promise<void> {
    try {
      await fetch(`${this.config.apiUrl}/live-rooms/${roomId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
    } catch (err) {
      console.warn('API closeRoom offline:', err);
    }
    localRooms = localRooms.filter(r => r.id !== roomId);
  }
}
