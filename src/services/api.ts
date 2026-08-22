import {
  RoomSummary,
  CreateRoomPayload,
  VerifyPasswordResponse,
  RoomDetails,
  AppConfig,
} from '../types/live-room';

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
    if (this.config.jwtToken && this.config.jwtToken.trim().length > 0) {
      headers['Authorization'] = `Bearer ${this.config.jwtToken.trim()}`;
    }
    if (password) {
      headers['x-room-password'] = password;
    }
    return headers;
  }

  /**
   * 1. Listar Salas Ao Vivo (Totalmente Aberto / Sem JWT)
   * GET /live-rooms
   */
  public async getLiveRooms(): Promise<RoomSummary[]> {
    try {
      const res = await fetch(`${this.config.apiUrl}/live-rooms`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        throw new Error(`Erro ao listar salas: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (err: any) {
      console.warn('Erro ao obter salas ao vivo:', err.message);
      return [];
    }
  }

  /**
   * 2. Criar Nova Sala
   * POST /live-rooms
   */
  public async createRoom(payload: CreateRoomPayload): Promise<RoomDetails> {
    const body: Record<string, any> = {
      title: payload.title.trim(),
      description: payload.description ? payload.description.trim() : undefined,
      maxParticipants: payload.maxParticipants || 16,
      authorName: this.config.userName || 'Visitante',
    };

    if (payload.password && payload.password.trim().length > 0) {
      body.password = payload.password.trim();
    }

    const res = await fetch(`${this.config.apiUrl}/live-rooms`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ao criar sala no servidor (${res.status})`);
    }

    return {
      ...data,
      messages: data.messages || [],
    };
  }

  /**
   * 3. Verificar Senha da Sala
   * POST /live-rooms/:id/verify-password
   */
  public async verifyPassword(roomId: string, password: string): Promise<VerifyPasswordResponse> {
    const res = await fetch(`${this.config.apiUrl}/live-rooms/${roomId}/verify-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ password: password.trim() }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { valid: false, error: data.error || 'Senha incorreta.' };
    }
    return data;
  }

  /**
   * 4. Detalhes da Sala
   * GET /live-rooms/:id
   */
  public async getRoomDetails(roomId: string, password?: string): Promise<RoomDetails> {
    const res = await fetch(`${this.config.apiUrl}/live-rooms/${roomId}`, {
      method: 'GET',
      headers: this.getHeaders(password),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ao carregar detalhes da sala: ${res.status}`);
    }

    return data;
  }

  /**
   * 5. Encerrar Sala
   * DELETE /live-rooms/:id
   */
  public async closeRoom(roomId: string): Promise<void> {
    const res = await fetch(`${this.config.apiUrl}/live-rooms/${roomId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro ao encerrar sala: ${res.status}`);
    }
  }
}
