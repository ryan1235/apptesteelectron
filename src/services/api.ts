import {
  RoomSummary,
  CreateRoomPayload,
  VerifyPasswordResponse,
  RoomDetails,
  AppConfig,
  LiveGroup,
  CreateGroupPayload,
  LiveGroupMember,
} from '../types/live-room';
import { logger } from './logger';

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

  // ==========================================
  // 1. SALAS AO VIVO (/live-rooms)
  // ==========================================

  /**
   * Listar Salas Ao Vivo
   * GET /live-rooms
   */
  public async getLiveRooms(groupId?: string, clientUserId?: string): Promise<RoomSummary[]> {
    try {
      const url = new URL(`${this.config.apiUrl}/live-rooms`);
      if (groupId) {
        url.searchParams.set('groupId', groupId);
      }
      if (clientUserId) {
        url.searchParams.set('clientUserId', clientUserId);
      }

      const res = await fetch(url.toString(), {
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
      logger.warn('API', `Erro ao obter salas: ${err.message}`);
      return [];
    }
  }

  /**
   * Criar Nova Sala Ao Vivo
   * POST /live-rooms
   */
  public async createRoom(payload: CreateRoomPayload): Promise<RoomDetails> {
    const body: Record<string, any> = {
      title: payload.title.trim(),
      description: payload.description ? payload.description.trim() : undefined,
      maxParticipants: payload.maxParticipants || 16,
      authorName: payload.authorName || this.config.userName || 'Visitante',
      clientUserId: payload.clientUserId || this.config.clientUserId,
      groupId: payload.groupId || undefined,
      customRoomId: payload.customRoomId ? payload.customRoomId.trim() : undefined,
    };

    if (payload.password && payload.password.trim().length > 0) {
      body.password = payload.password.trim();
    }

    logger.info('API', `Criando sala: ${body.title}`, body);

    const res = await fetch(`${this.config.apiUrl}/live-rooms`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ao criar sala no servidor (${res.status})`);
    }

    logger.success('API', `Sala criada com sucesso: ${data.id}`);
    return {
      ...data,
      messages: data.messages || [],
    };
  }

  /**
   * Verificar Senha da Sala
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
   * Detalhes da Sala
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
   * Encerrar Sala
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
    logger.info('API', `Sala ${roomId} encerrada.`);
  }

  // ==========================================
  // 2. GRUPOS DE SALAS (/live-groups)
  // ==========================================

  /**
   * Listar Grupos de Salas
   * GET /live-groups
   */
  public async getGroups(params?: { clientUserId?: string; customGroupId?: string }): Promise<LiveGroup[]> {
    try {
      const url = new URL(`${this.config.apiUrl}/live-groups`);
      if (params?.clientUserId) {
        url.searchParams.set('clientUserId', params.clientUserId);
      }
      if (params?.customGroupId) {
        url.searchParams.set('customGroupId', params.customGroupId);
      }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        throw new Error(`Erro ao listar grupos: ${res.status}`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
      return [];
    } catch (err: any) {
      logger.warn('API', `Erro ao obter grupos: ${err.message}`);
      return [];
    }
  }

  /**
   * Criar Novo Grupo de Salas
   * POST /live-groups
   */
  public async createGroup(payload: CreateGroupPayload): Promise<LiveGroup> {
    const body: Record<string, any> = {
      name: payload.name.trim(),
      description: payload.description ? payload.description.trim() : undefined,
      customGroupId: payload.customGroupId ? payload.customGroupId.trim() : undefined,
      avatarUrl: payload.avatarUrl || undefined,
      clientUserId: payload.clientUserId || this.config.clientUserId,
    };

    if (payload.password && payload.password.trim().length > 0) {
      body.password = payload.password.trim();
    }

    logger.info('API', `Criando grupo: ${body.name}`, body);

    const res = await fetch(`${this.config.apiUrl}/live-groups`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ao criar grupo (${res.status})`);
    }

    logger.success('API', `Grupo criado com sucesso: ${data.id}`);
    return data;
  }

  /**
   * Obter Detalhes do Grupo (+ Salas + Membros)
   * GET /live-groups/:id
   */
  public async getGroupDetails(groupId: string): Promise<LiveGroup> {
    const res = await fetch(`${this.config.apiUrl}/live-groups/${groupId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ao carregar detalhes do grupo: ${res.status}`);
    }

    return data;
  }

  /**
   * Criar Sala Diretamente Dentro de um Grupo
   * POST /live-groups/:id/rooms
   */
  public async createRoomInGroup(groupId: string, payload: CreateRoomPayload): Promise<RoomDetails> {
    const body: Record<string, any> = {
      title: payload.title.trim(),
      description: payload.description ? payload.description.trim() : undefined,
      maxParticipants: payload.maxParticipants || 16,
      authorName: payload.authorName || this.config.userName || 'Visitante',
      clientUserId: payload.clientUserId || this.config.clientUserId,
      customRoomId: payload.customRoomId ? payload.customRoomId.trim() : undefined,
    };

    if (payload.password && payload.password.trim().length > 0) {
      body.password = payload.password.trim();
    }

    const res = await fetch(`${this.config.apiUrl}/live-groups/${groupId}/rooms`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ao criar sala no grupo (${res.status})`);
    }

    return {
      ...data,
      messages: data.messages || [],
    };
  }

  /**
   * Entrar em um Grupo (Registrar como Membro)
   * POST /live-groups/:id/join
   */
  public async joinGroup(groupId: string): Promise<{ success: boolean; member?: LiveGroupMember }> {
    const res = await fetch(`${this.config.apiUrl}/live-groups/${groupId}/join`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        clientUserId: this.config.clientUserId,
        userName: this.config.userName,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Erro ao ingressar no grupo (${res.status})`);
    }
    return { success: true, member: data.member };
  }

  /**
   * Validar Senha do Grupo
   * POST /live-groups/:id/verify-password
   */
  public async verifyGroupPassword(groupId: string, password: string): Promise<{ valid: boolean; error?: string }> {
    const res = await fetch(`${this.config.apiUrl}/live-groups/${groupId}/verify-password`, {
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
   * Excluir Grupo
   * DELETE /live-groups/:id
   */
  public async deleteGroup(groupId: string): Promise<void> {
    const res = await fetch(`${this.config.apiUrl}/live-groups/${groupId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Erro ao deletar grupo: ${res.status}`);
    }
    logger.info('API', `Grupo ${groupId} encerrado.`);
  }
}
