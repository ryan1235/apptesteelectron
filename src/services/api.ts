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
   * Autenticação via Email & Senha (POST /auth/login)
   */
  public async login(email: string, password: string): Promise<{ token: string; user?: any }> {
    const res = await fetch(`${this.config.apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Erro no login: ${res.status}`);
    }

    const token = data.token || data.accessToken || data.jwt || (data.user && data.user.token);
    if (!token) {
      throw new Error('Servidor não retornou um token JWT válido.');
    }

    return { token, user: data.user };
  }

  /**
   * Registro de nova conta (POST /auth/register)
   */
  public async register(name: string, email: string, password: string): Promise<{ message: string; user?: any }> {
    const res = await fetch(`${this.config.apiUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Erro no registro: ${res.status}`);
    }

    return data;
  }

  /**
   * 1. Listar Salas Ao Vivo
   * GET /live-rooms
   */
  public async getLiveRooms(): Promise<RoomSummary[]> {
    try {
      const res = await fetch(`${this.config.apiUrl}/live-rooms`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 401) {
          console.warn('⚠️ Token JWT inválido ou não fornecido para /live-rooms:', errorData.error || '401 Unauthorized');
        }
        throw new Error(errorData.error || `Erro ao listar salas: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (err: any) {
      // Re-throw if it's an auth error or log for UI toast
      throw err;
    }
  }

  /**
   * 2. Criar Nova Sala
   * POST /live-rooms
   */
  public async createRoom(payload: CreateRoomPayload): Promise<RoomDetails> {
    const res = await fetch(`${this.config.apiUrl}/live-rooms`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        title: payload.title,
        description: payload.description || undefined,
        password: payload.password || undefined,
        maxParticipants: payload.maxParticipants || 16,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ao criar sala no servidor (${res.status}): ${res.statusText}`);
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
      body: JSON.stringify({ password }),
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
