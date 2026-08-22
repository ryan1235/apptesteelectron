import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RoomSummary,
  RoomDetails,
  Participant,
  PresenterInfo,
  TelemetryStats,
  QualityProfile,
  ChatMessage,
  AppConfig,
  PacketType,
  CreateRoomPayload,
  LiveGroup,
  CreateGroupPayload,
  FloatingReaction,
  ServerRxMessage,
  BinaryHeader,
  ScreenAudioMode,
} from './types/live-room';
import { loadSavedConfig, saveConfig } from './config/env';
import { LiveRoomsApiClient } from './services/api';
import { LiveRoomWebSocketClient } from './services/websocket';
import { AudioManager } from './services/audioManager';
import { WebCodecsVideoPipeline } from './services/videoCodecs';
import { ScreenCapturer } from './services/screenCapturer';
import { logger } from './services/logger';
import { soundEffects } from './services/soundEffects';

// Layout Components
import { TitleBar } from './components/layout/TitleBar';
import { ServerSidebar } from './components/layout/ServerSidebar';
import { ChannelSidebar } from './components/layout/ChannelSidebar';

// Room Components
import { RoomLobby } from './components/room/RoomLobby';
import { RoomView } from './components/room/RoomView';
import { ScreenSourceModal } from './components/room/ScreenSourceModal';

// Modals
import { CreateRoomModal } from './components/modals/CreateRoomModal';
import { CreateGroupModal } from './components/modals/CreateGroupModal';
import { PasswordModal } from './components/modals/PasswordModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { LoginModal } from './components/auth/LoginModal';

export const App: React.FC = () => {
  // App Configuration
  const [config, setConfig] = useState<AppConfig>(loadSavedConfig);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(() => {
    return !localStorage.getItem('discord_live_rooms_auth_v1');
  });
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'connecting' | 'disconnected' | 'mock'
  >('disconnected');

  // Rooms, Groups & Navigation State
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [groups, setGroups] = useState<LiveGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isSyncingRooms, setIsSyncingRooms] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<RoomDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>(() => config.clientUserId || 'usr-local-id');

  // Active Call State
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [activePresenter, setActivePresenter] = useState<PresenterInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [activeProfile, setActiveProfile] = useState<QualityProfile>('SMOOTH_60FPS');
  const [telemetry, setTelemetry] = useState<TelemetryStats>({
    fps: 0,
    bitrateKbps: 0,
    latencyMs: 30,
    packetsReceived: 0,
    packetsSent: 0,
    bytesReceived: 0,
    bytesSent: 0,
    audioJitterMs: 5,
    codec: 'H.264 GPU (0xAA)',
  });

  // Chat, Typing and Reactions state
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  // Modal Visibility States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createRoomDefaultGroupId, setCreateRoomDefaultGroupId] = useState<string | undefined>(undefined);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState<boolean>(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [selectedPasswordRoom, setSelectedPasswordRoom] = useState<RoomSummary | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isScreenSourceModalOpen, setIsScreenSourceModalOpen] = useState<boolean>(false);

  // Service Instances (Refs to preserve across renders)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const apiClientRef = useRef<LiveRoomsApiClient>(new LiveRoomsApiClient(config));
  const wsClientRef = useRef<LiveRoomWebSocketClient>(new LiveRoomWebSocketClient(config));
  const audioManagerRef = useRef<AudioManager>(new AudioManager(config));
  const videoCodecsRef = useRef<WebCodecsVideoPipeline>(new WebCodecsVideoPipeline());
  const screenCapturerRef = useRef<ScreenCapturer>(new ScreenCapturer());

  // Stale closure guards
  const activeRoomRef = useRef<RoomDetails | null>(null);
  activeRoomRef.current = activeRoom;
  const currentUserIdRef = useRef<string>(currentUserId);
  currentUserIdRef.current = currentUserId;
  const configRef = useRef<AppConfig>(config);
  configRef.current = config;
  const isScreenSharingRef = useRef<boolean>(isScreenSharing);
  isScreenSharingRef.current = isScreenSharing;
  const localScreenStreamRef = useRef<MediaStream | null>(localScreenStream);
  localScreenStreamRef.current = localScreenStream;
  const activeProfileRef = useRef<QualityProfile>(activeProfile);
  activeProfileRef.current = activeProfile;

  // Initialize Services & Handlers
  useEffect(() => {
    const ws = wsClientRef.current;
    const audio = audioManagerRef.current;
    const video = videoCodecsRef.current;

    // Canvas target for video decoding
    if (canvasRef.current) {
      video.setTargetCanvas(canvasRef.current);
    }

    // Bind Audio Voice Activity & Packet callbacks
    audio.setCallbacks(
      (audioPacket: ArrayBuffer) => {
        if (activeRoomRef.current) {
          ws.sendBinary(audioPacket);
        }
      },
      (speaking: boolean) => {
        setIsSpeaking(speaking);
        if (activeRoomRef.current) {
          ws.sendJson({
            type: 'user_speaking',
            roomId: activeRoomRef.current.id,
            isSpeaking: speaking,
            clientUserId: configRef.current.clientUserId,
          });
        }
      },
      (vol: number) => {
        setMicVolumeLevel(vol);
      }
    );

    // Bind WebCodecs Encoded Video Frame Emitter -> Send via WebSocket
    video.setOnVideoPacket((packet: ArrayBuffer) => {
      if (activeRoomRef.current) {
        ws.sendBinary(packet);
      }
    });

    video.setOnTelemetryUpdate((tStats) => {
      setTelemetry((prev) => ({
        ...prev,
        fps: tStats.fps,
        bitrateKbps: tStats.bitrateKbps,
        codec: tStats.codec,
      }));
    });

    video.setOnRequestKeyframe(() => {
      if (activeRoomRef.current) {
        ws.sendJson({
          type: 'request_keyframe',
          roomId: activeRoomRef.current.id,
        });
      }
    });

    // Bind WebSocket Handlers
    ws.setCallbacks({
      onJsonMessage: (msg: ServerRxMessage) => {
        handleServerRxJson(msg);
      },
      onBinaryVideo: (header: BinaryHeader) => {
        video.handleIncomingVideoPacket(header.payload, header.isKeyframe, header.timestampUs);
      },
      onBinaryAudio: (packetType: PacketType, payload: ArrayBuffer, senderId?: string) => {
        // If local user is presenting/sharing screen, ignore incoming SCREEN_AUDIO_PCM to prevent echo feedback loop
        if (packetType === PacketType.SCREEN_AUDIO_PCM && isScreenSharingRef.current) {
          return;
        }
        audio.playRemoteAudioChunk(packetType, payload, senderId);
      },
      onConnectionStatus: (status) => {
        setConnectionStatus(status);
      },
    });

    // Connect WebSocket
    ws.connect();

    // Fetch rooms and groups
    fetchRooms();

    // Setup periodic polling for lobby updates
    const pollInterval = setInterval(() => {
      if (!activeRoomRef.current) {
        fetchRooms(true);
      }
    }, 10000);

    return () => {
      clearInterval(pollInterval);
      ws.disconnect();
      audio.stop();
      video.destroy();
    };
  }, []);

  // Update canvas target when entering room
  useEffect(() => {
    if (canvasRef.current) {
      videoCodecsRef.current.setTargetCanvas(canvasRef.current);
    }
  }, [activePresenter, isScreenSharing]);

  const fetchRooms = async (silent = false) => {
    if (!silent) setIsSyncingRooms(true);
    try {
      const [roomsList, groupsList] = await Promise.all([
        apiClientRef.current.getLiveRooms(),
        apiClientRef.current.getGroups(),
      ]);
      setRooms(roomsList);
      setGroups(groupsList);
      setAuthError(null);
    } catch (err: any) {
      console.warn('Erro ao sincronizar salas e grupos:', err);
    } finally {
      if (!silent) {
        setTimeout(() => setIsSyncingRooms(false), 300);
      }
    }
  };

  // Handle incoming JSON events from WebSocket
  const handleServerRxJson = useCallback((msg: any) => {
    if (!msg || typeof msg !== 'object') return;

    try {
      switch (msg.type) {
        case 'connected':
          if (msg.userId) setCurrentUserId(msg.userId);
          if (activeRoomRef.current) {
            const currentId = activeRoomRef.current.id;
            const savedPwd = knownRoomPasswords.current.get(currentId);
            logger.info('WS-TX', `Reingressando na sala ${currentId} após reconectar WebSocket...`);
            wsClientRef.current.sendJson({
              type: 'join_room',
              roomId: currentId,
              password: savedPwd,
              clientUserId: configRef.current.clientUserId,
              userName: configRef.current.userName,
              avatarUrl: configRef.current.avatarUrl || null,
            });
          }
          break;

        case 'room_state': {
          const rawParticipants = Array.isArray(msg.participants) ? msg.participants : [];
          const myId = msg.yourUserId || currentUserIdRef.current;

          // Deduplicate participants by clientUserId or normalized name
          const seen = new Set<string>();
          const deduplicatedList: Participant[] = [];

          for (const p of rawParticipants) {
            const pName = p.name || 'Participante';
            const pClientUserId = p.clientUserId || p.userId || p.id;
            const key = pClientUserId ? `id:${pClientUserId}` : `name:${pName.toLowerCase()}`;

            if (seen.has(key)) continue;
            seen.add(key);

            const isLocal =
              p.userId === myId ||
              (p.clientUserId && p.clientUserId === configRef.current.clientUserId) ||
              (pName && pName.toLowerCase() === configRef.current.userName.toLowerCase());

            deduplicatedList.push({
              id: isLocal ? (currentUserIdRef.current || p.userId || p.id) : (p.userId || p.id),
              name: isLocal ? configRef.current.userName : pName,
              avatarUrl: p.avatarUrl || null,
              micOn: isLocal ? !isMicMuted : Boolean(p.micOn),
              isSpeaking: Boolean(p.isSpeaking),
              isScreenSharing: Boolean(p.isSharing || p.isScreenSharing),
              joinedAt: p.joinedAt,
              volume: 100,
            });
          }

          // Ensure local participant is always present exactly once
          const hasSelf = deduplicatedList.some(
            (p) =>
              p.id === currentUserIdRef.current ||
              p.name.toLowerCase() === configRef.current.userName.toLowerCase()
          );
          if (!hasSelf) {
            deduplicatedList.unshift({
              id: currentUserIdRef.current || 'usr-local',
              name: configRef.current.userName || 'Você',
              avatarUrl: configRef.current.avatarUrl || null,
              micOn: !isMicMuted,
              isSpeaking: false,
              isScreenSharing: isScreenSharing,
              volume: 100,
            });
          }

          setParticipants(deduplicatedList);

          if (msg.activeScreenShare || msg.activePresenter) {
            const share = msg.activeScreenShare || msg.activePresenter;
            const pId = share.userId || share.presenterId;
            setActivePresenter({
              userId: pId,
              userName: share.name || share.userName || share.presenterName || 'Apresentador',
              qualityProfile: share.qualityProfile || 'SMOOTH_60FPS',
              startedAt: share.startedAt || new Date().toISOString(),
            });
            if (pId !== currentUserIdRef.current) {
              videoCodecsRef.current.initDecoder(share.codec || 'vp8');
              if (msg.roomId || activeRoomRef.current?.id) {
                wsClientRef.current.sendJson({
                  type: 'request_keyframe',
                  roomId: msg.roomId || activeRoomRef.current?.id,
                });
              }
            }
          } else {
            setActivePresenter(null);
          }
          break;
        }

        case 'user_joined': {
          const userObj = msg.participant || msg.user || msg;
          const newUserId = userObj.userId || userObj.id || msg.userId || 'usr-' + Math.random().toString(36).substring(2, 7);
          const newUserName = userObj.name || msg.userName || 'Participante';
          const newClientUserId = userObj.clientUserId || msg.clientUserId;

          const isLocal =
            newUserId === currentUserIdRef.current ||
            (newClientUserId && newClientUserId === configRef.current.clientUserId) ||
            newUserName.toLowerCase() === configRef.current.userName.toLowerCase();

          const newParticipant: Participant = {
            id: isLocal ? currentUserIdRef.current : newUserId,
            name: isLocal ? configRef.current.userName : newUserName,
            avatarUrl: userObj.avatarUrl || msg.avatarUrl || null,
            micOn: isLocal ? !isMicMuted : Boolean(userObj.micOn),
            isSpeaking: Boolean(userObj.isSpeaking),
            isScreenSharing: Boolean(userObj.isSharing || userObj.isScreenSharing),
            volume: 100,
          };

          setParticipants((prev) => {
            const existingIndex = prev.findIndex(
              (p) =>
                p.id === newParticipant.id ||
                p.name.toLowerCase() === newParticipant.name.toLowerCase()
            );
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = { ...updated[existingIndex], ...newParticipant };
              return updated;
            }
            if (!isLocal) {
              soundEffects.playUserJoined();
            }
            return [...prev, newParticipant];
          });
          break;
        }

        case 'user_left': {
          const leftId = msg.userId || (msg.user && msg.user.id);
          const leftName = msg.userName || (msg.user && msg.user.name);
          const leftClientUserId = msg.clientUserId || (msg.user && msg.user.clientUserId);

          // Don't remove self on stale user_left from a previous socket connection
          const isMeLeft =
            leftId === currentUserIdRef.current ||
            (leftClientUserId && leftClientUserId === configRef.current.clientUserId) ||
            (leftName && leftName.toLowerCase() === configRef.current.userName.toLowerCase());

          if (isMeLeft) {
            break;
          }

          if (leftId || leftName) {
            soundEffects.playUserLeft();
            setParticipants((prev) =>
              prev.filter(
                (p) => p.id !== leftId && (!leftName || p.name.toLowerCase() !== leftName.toLowerCase())
              )
            );
            setActivePresenter((prev) => (prev?.userId === leftId ? null : prev));
          }
          break;
        }

        case 'screen_share_started': {
          const pId = msg.userId || msg.presenterId;
          const pName = msg.name || msg.presenterName || msg.userName || 'Apresentador';
          setActivePresenter({
            userId: pId,
            userName: pName,
            qualityProfile: msg.qualityProfile || 'SMOOTH_60FPS',
            startedAt: new Date().toISOString(),
          });
          setParticipants((prev) =>
            prev.map((p) => (p.id === pId ? { ...p, isScreenSharing: true } : p))
          );
          if (pId !== currentUserIdRef.current) {
            videoCodecsRef.current.initDecoder(msg.codec || 'vp8');
            if (activeRoomRef.current) {
              wsClientRef.current.sendJson({
                type: 'request_keyframe',
                roomId: activeRoomRef.current.id,
              });
            }
          }
          break;
        }

        case 'screen_share_stopped': {
          const presenterId = msg.userId || msg.presenterId;
          setActivePresenter((prev) => (prev?.userId === presenterId ? null : prev));
          setParticipants((prev) =>
            prev.map((p) => (p.id === presenterId ? { ...p, isScreenSharing: false } : p))
          );
          break;
        }

        case 'mic_toggled': {
          const targetId = msg.userId || (msg.user && msg.user.id);
          const targetName = msg.userName || (msg.user && msg.user.name);
          const micOn = Boolean(msg.micOn !== undefined ? msg.micOn : msg.user?.micOn);
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === targetId || (targetName && p.name.toLowerCase() === targetName.toLowerCase())
                ? { ...p, micOn }
                : p
            )
          );
          break;
        }

        case 'speaking_updated': {
          const spkId = msg.userId || (msg.user && msg.user.id);
          const spkName = msg.userName || (msg.user && msg.user.name);
          const isSpeaking = Boolean(msg.isSpeaking !== undefined ? msg.isSpeaking : msg.user?.isSpeaking);
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === spkId || (spkName && p.name.toLowerCase() === spkName.toLowerCase())
                ? { ...p, isSpeaking }
                : p
            )
          );
          break;
        }

        case 'chat_message': {
          const chatMsg: ChatMessage = msg.message || {
            id: msg.id || 'msg-' + Date.now(),
            roomId: msg.roomId || '',
            userId: msg.userId || msg.clientUserId || '',
            userName: msg.userName || msg.name || 'Anônimo',
            avatarUrl: msg.avatarUrl || null,
            content: msg.content || msg.text || '',
            createdAt: msg.createdAt || new Date().toISOString(),
          };

          const isMe =
            chatMsg.userId === (currentUserIdRef.current || configRef.current.clientUserId) ||
            chatMsg.userName.toLowerCase() === configRef.current.userName.toLowerCase();

          if (!isMe) {
            soundEffects.playMessage();
          }

          setMessages((prev) => {
            const isDuplicate = prev.some(
              (m) =>
                m.id === chatMsg.id ||
                (m.content === chatMsg.content &&
                  (m.userName.toLowerCase() === chatMsg.userName.toLowerCase() || m.userId === chatMsg.userId) &&
                  Math.abs(new Date(m.createdAt).getTime() - new Date(chatMsg.createdAt).getTime()) < 4000)
            );
            if (isDuplicate) return prev;
            return [...prev, chatMsg];
          });
          break;
        }

        case 'typing': {
          const sender = msg.userName || 'Alguém';
          if (sender.toLowerCase() === configRef.current.userName.toLowerCase()) break;
          if (msg.isTyping) {
            setTypingUsers((prev) => Array.from(new Set([...prev, sender])));
          } else {
            setTypingUsers((prev) => prev.filter((u) => u.toLowerCase() !== sender.toLowerCase()));
          }
          break;
        }

        case 'reaction': {
          const emoji = msg.emoji;
          if (!emoji) break;
          const newReaction: FloatingReaction = {
            id: 'react-' + Math.random().toString(36).substring(2, 9),
            emoji,
            userName: msg.userName || '',
            xOffset: Math.floor(Math.random() * 50) + 30,
          };
          setReactions((prev) => [...prev, newReaction]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
          }, 3000);
          break;
        }

        case 'request_keyframe':
          videoCodecsRef.current.requestKeyFrame();
          break;

        case 'room_closed':
          alert('A sala foi encerrada pelo anfitrião.');
          leaveRoom();
          break;
      }
    } catch (error) {
      console.error('Erro ao processar mensagem do WebSocket:', error);
    }
  }, [activePresenter, currentUserId, config.userName]);

  // Memory map of known passwords for rooms created or unlocked by the user
  const knownRoomPasswords = useRef<Map<string, string>>(new Map());

  // Join Room workflow
  const handleSelectRoom = async (room: RoomSummary) => {
    const isCreator =
      room.createdBy?.id === currentUserId ||
      room.clientUserId === currentUserId ||
      room.createdBy?.id === 'usr-local' ||
      (room.createdBy?.name && room.createdBy.name.toLowerCase() === config.userName.toLowerCase());

    const rememberedPassword = knownRoomPasswords.current.get(room.id);

    // If user is the creator or already has the password cached, enter directly!
    if (!room.isPasswordProtected || isCreator || rememberedPassword !== undefined) {
      await enterRoom(room.id, rememberedPassword);
      return;
    }

    // Only prompt password for protected rooms when user is a guest
    setSelectedPasswordRoom(room);
    setIsPasswordModalOpen(true);
  };

  const handlePasswordConfirm = async (password: string) => {
    if (!selectedPasswordRoom) return;
    const verifyRes = await apiClientRef.current.verifyPassword(
      selectedPasswordRoom.id,
      password
    );
    if (!verifyRes.valid) {
      throw new Error(verifyRes.error || 'Senha incorreta.');
    }
    knownRoomPasswords.current.set(selectedPasswordRoom.id, password);
    await enterRoom(selectedPasswordRoom.id, password);
  };

  const enterRoom = async (roomId: string, password?: string, preloadedDetails?: RoomDetails) => {
    try {
      // If leaving an existing room, notify server and clean state
      if (activeRoomRef.current && activeRoomRef.current.id !== roomId) {
        soundEffects.playLeave();
        wsClientRef.current.sendJson({
          type: 'leave_room',
          roomId: activeRoomRef.current.id,
          clientUserId: config.clientUserId,
        });
        stopScreenShare();
      }
      setActivePresenter(null);

      let details = preloadedDetails;
      if (!details) {
        try {
          details = await apiClientRef.current.getRoomDetails(roomId, password);
        } catch (e) {
          const found = rooms.find((r) => r.id === roomId);
          details = {
            id: roomId,
            title: found?.title || 'Sala Ao Vivo',
            description: found?.description || '',
            isPasswordProtected: Boolean(found?.isPasswordProtected),
            maxParticipants: found?.maxParticipants || 16,
            occupancy: found?.occupancy || 1,
            groupId: found?.groupId || null,
            customRoomId: found?.customRoomId || null,
            clientUserId: found?.clientUserId || config.clientUserId,
            createdBy: found?.createdBy || { id: 'guest', name: config.userName, avatarUrl: config.avatarUrl || null },
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as RoomDetails;
        }
      }

      setActiveRoom(details);
      setMessages(details.messages || []);

      // Start Audio & Voice Chat
      audioManagerRef.current.setRoomId(roomId);
      audioManagerRef.current.setMuted(isMicMuted);
      if (!isMicMuted) {
        await audioManagerRef.current.startMicrophone().catch(console.warn);
      }

      // Add local participant
      const selfParticipant: Participant = {
        id: currentUserId || 'usr-local',
        name: config.userName || 'Você',
        avatarUrl: config.avatarUrl || null,
        micOn: !isMicMuted,
        isSpeaking: false,
        isScreenSharing: isScreenSharing,
        volume: 100,
      };
      setParticipants((prev) => {
        if (prev.some((p) => p.name === selfParticipant.name || p.id === selfParticipant.id)) {
          return prev;
        }
        return [selfParticipant, ...prev];
      });

      // Play Discord join chime
      soundEffects.playJoin();

      // Join via WebSocket (with clientUserId)
      wsClientRef.current.sendJson({
        type: 'join_room',
        roomId,
        password,
        clientUserId: config.clientUserId,
        userName: config.userName,
        avatarUrl: config.avatarUrl || null,
      });
    } catch (err: any) {
      console.error('Erro ao conectar na sala:', err);
    }
  };

  // Leave room workflow
  const leaveRoom = () => {
    soundEffects.playLeave();

    if (activeRoom) {
      wsClientRef.current.sendJson({
        type: 'leave_room',
        roomId: activeRoom.id,
        clientUserId: config.clientUserId,
      });
    }

    // Stop streams & clean state
    if (isScreenSharing) {
      stopScreenShare();
    }
    setLocalScreenStream(null);
    audioManagerRef.current.stop();
    setActiveRoom(null);
    setParticipants([]);
    setActivePresenter(null);
    setMessages([]);
    setTypingUsers([]);
    setReactions([]);
    fetchRooms();
  };

  // Create room
  const handleCreateRoom = async (payload: CreateRoomPayload) => {
    try {
      const created = await apiClientRef.current.createRoom({
        ...payload,
        clientUserId: config.clientUserId,
      });
      if (payload.password) {
        knownRoomPasswords.current.set(created.id, payload.password);
      }
      await fetchRooms();
      await enterRoom(created.id, payload.password || undefined, created);
    } catch (err: any) {
      alert(`Não foi possível criar a sala no servidor: ${err.message}`);
    }
  };

  // Delete room
  const handleDeleteRoom = async (roomId: string) => {
    if (confirm('Tem certeza que deseja encerrar esta sala?')) {
      await apiClientRef.current.closeRoom(roomId);
      fetchRooms();
    }
  };

  // Create Group
  const handleCreateGroup = async (payload: CreateGroupPayload) => {
    try {
      await apiClientRef.current.createGroup(payload);
      fetchRooms();
    } catch (err: any) {
      alert(`Erro ao criar grupo: ${err.message}`);
    }
  };

  // Delete Group
  const handleDeleteGroup = async (groupId: string) => {
    if (confirm('Tem certeza que deseja excluir este grupo e todas as suas salas?')) {
      await apiClientRef.current.deleteGroup(groupId);
      fetchRooms();
    }
  };

  // Toggle Microphone
  const handleToggleMic = async () => {
    const newMuted = !isMicMuted;
    if (newMuted) {
      soundEffects.playMute();
    } else {
      soundEffects.playUnmute();
    }

    setIsMicMuted(newMuted);
    audioManagerRef.current.setMuted(newMuted);
    if (!newMuted) {
      await audioManagerRef.current.startMicrophone().catch((err) => {
        console.warn('Erro ao ligar microfone:', err);
      });
    }

    if (activeRoom) {
      wsClientRef.current.sendJson({
        type: 'toggle_mic',
        roomId: activeRoom.id,
        micOn: !newMuted,
        clientUserId: config.clientUserId,
      });
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === currentUserId || (p.name && p.name.toLowerCase() === config.userName.toLowerCase())
            ? { ...p, micOn: !newMuted }
            : p
        )
      );
    }
  };

  // Toggle Deafen
  const handleToggleDeafen = () => {
    const newDeafened = !isDeafened;
    if (newDeafened) {
      soundEffects.playMute();
    } else {
      soundEffects.playUnmute();
    }
    setIsDeafened(newDeafened);
    audioManagerRef.current.setDeafened(newDeafened);
  };

  // Toggle Screen Share
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      setIsScreenSourceModalOpen(true);
    }
  };

  const startScreenShare = async (
    sourceId: string,
    profile: QualityProfile = activeProfile,
    audioMode: ScreenAudioMode = 'app_only'
  ) => {
    try {
      const captureResult = await screenCapturerRef.current.startCapture(
        sourceId,
        profile,
        audioMode
      );
      const stream = captureResult.stream;
      setLocalScreenStream(stream);
      setIsScreenSharing(true);
      setActiveProfile(profile);

      if (activeRoom) {
        // Start GPU WebCodecs Encoder
        await videoCodecsRef.current.startEncoding(
          stream,
          activeRoom.id,
          profile
        );

        // Start Stereo Screen Audio Capture & Streaming (only if audio is enabled)
        if (audioMode !== 'none' && (captureResult.hasAudio || stream.getAudioTracks().length > 0)) {
          await audioManagerRef.current.startScreenAudioCapture(stream);
        }

        // Notify room via WebSocket
        wsClientRef.current.sendJson({
          type: 'start_screen_share',
          roomId: activeRoom.id,
          qualityProfile: profile,
          codec: videoCodecsRef.current.getActiveCodec(),
          clientUserId: config.clientUserId,
        });
      }

      // Handle stream end (user stops via system OS bar)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }
    } catch (err: any) {
      alert(`Erro ao iniciar compartilhamento de tela: ${err.message}`);
    }
  };

  const stopScreenShare = () => {
    screenCapturerRef.current.stopCapture();
    videoCodecsRef.current.stopEncoding();
    audioManagerRef.current.stopScreenAudioCapture();
    setLocalScreenStream(null);
    setIsScreenSharing(false);

    if (activeRoom) {
      wsClientRef.current.sendJson({
        type: 'stop_screen_share',
        roomId: activeRoom.id,
        clientUserId: config.clientUserId,
      });
    }
  };

  // Send Chat Message
  const handleSendMessage = (text: string) => {
    if (!activeRoom) return;
    wsClientRef.current.sendJson({
      type: 'chat_message',
      roomId: activeRoom.id,
      text,
      content: text,
      clientUserId: config.clientUserId,
      userName: config.userName,
      avatarUrl: config.avatarUrl || null,
    });
  };

  // Send Emoji Reaction
  const handleSendReaction = (emoji: string) => {
    if (!activeRoom) return;
    const newReaction: FloatingReaction = {
      id: 'react-' + Math.random().toString(36).substring(2, 9),
      emoji,
      userName: config.userName,
      xOffset: Math.floor(Math.random() * 50) + 30,
    };
    setReactions((prev) => [...prev, newReaction]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
    }, 3000);

    wsClientRef.current.sendJson({
      type: 'reaction',
      roomId: activeRoom.id,
      emoji,
      userName: config.userName,
      clientUserId: config.clientUserId,
    });
  };

  // Send Typing state
  const handleTyping = (isTyping: boolean) => {
    if (!activeRoom) return;
    wsClientRef.current.sendJson({
      type: 'typing',
      roomId: activeRoom.id,
      isTyping,
      userName: config.userName,
      clientUserId: config.clientUserId,
    });
  };

  // Save Settings
  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    saveConfig(newConfig);
    apiClientRef.current.updateConfig(newConfig);
    wsClientRef.current.updateConfig(newConfig);
    audioManagerRef.current.updateConfig(newConfig);

    // Reconnect WS if URLs changed
    wsClientRef.current.disconnect();
    wsClientRef.current.connect();
    fetchRooms();
  };

  // Login handler
  const handleLogin = (
    userName: string,
    avatarUrl: string
  ) => {
    const updated: AppConfig = {
      ...config,
      userName,
      avatarUrl,
    };

    localStorage.setItem('discord_live_rooms_auth_v1', 'true');
    handleSaveConfig(updated);
    setIsLoginModalOpen(false);
  };

  const handleGetSources = useCallback(() => {
    return screenCapturerRef.current.getSources();
  }, []);

  // Filter rooms when a group is selected on the left sidebar
  const displayedRooms = selectedGroupId
    ? rooms.filter((r) => r.groupId === selectedGroupId)
    : rooms;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-discord-chat font-sans antialiased text-discord-textNormal">
      {/* 1. Custom Frameless Discord TitleBar */}
      <TitleBar
        connectionStatus={connectionStatus}
        activeRoomTitle={activeRoom?.title}
      />

      {/* 2. Main App Body (Server Sidebar + Channel Sidebar + Stage/Lobby) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Server Sidebar */}
        <ServerSidebar
          activeView={activeRoom ? 'room' : 'lobby'}
          groups={groups}
          selectedGroupId={selectedGroupId}
          onGoToLobby={leaveRoom}
          onSelectGroup={(gId) => setSelectedGroupId(gId)}
          onOpenCreateModal={() => {
            setCreateRoomDefaultGroupId(selectedGroupId || undefined);
            setIsCreateModalOpen(true);
          }}
          onOpenCreateGroupModal={() => setIsCreateGroupModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />

        {/* Channels / Active Users Sidebar */}
        <ChannelSidebar
          rooms={displayedRooms}
          groups={groups}
          activeRoomId={activeRoom?.id}
          activeRoomParticipants={participants}
          searchQuery={searchQuery}
          isSyncing={isSyncingRooms}
          onSearchChange={setSearchQuery}
          onSelectRoom={handleSelectRoom}
          onOpenCreateModal={(gId) => {
            setCreateRoomDefaultGroupId(gId || selectedGroupId || undefined);
            setIsCreateModalOpen(true);
          }}
          onOpenCreateGroupModal={() => setIsCreateGroupModalOpen(true)}
          onRefreshRooms={() => fetchRooms(false)}
          userName={config.userName}
          avatarUrl={config.avatarUrl}
          isMicMuted={isMicMuted}
          isDeafened={isDeafened}
          isSpeaking={isSpeaking}
          onToggleMic={handleToggleMic}
          onToggleDeafen={handleToggleDeafen}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenLogin={() => setIsLoginModalOpen(true)}
        />

        {/* Center Main Stage / Lobby */}
        {activeRoom ? (
          <RoomView
            room={activeRoom}
            participants={participants}
            activePresenter={activePresenter}
            currentUserId={currentUserId}
            telemetry={telemetry}
            canvasRef={canvasRef}
            localStream={localScreenStream}
            isMicMuted={isMicMuted}
            isDeafened={isDeafened}
            isScreenSharing={isScreenSharing}
            activeProfile={activeProfile}
            messages={messages}
            typingUsers={typingUsers}
            reactions={reactions}
            onRequestKeyframe={() => {
              if (activeRoom) {
                wsClientRef.current.sendJson({
                  type: 'request_keyframe',
                  roomId: activeRoom.id,
                });
              }
            }}
            onToggleMic={handleToggleMic}
            onToggleDeafen={handleToggleDeafen}
            onToggleScreenShare={handleToggleScreenShare}
            onChangeProfile={(profile) => {
              setActiveProfile(profile);
              if (isScreenSharing && activeRoom) {
                wsClientRef.current.sendJson({
                  type: 'start_screen_share',
                  roomId: activeRoom.id,
                  qualityProfile: profile,
                  clientUserId: config.clientUserId,
                });
              }
            }}
            onSendMessage={handleSendMessage}
            onSendReaction={handleSendReaction}
            onTyping={handleTyping}
            onLeaveRoom={leaveRoom}
            onSetUserVolume={(userId, vol) => {
              audioManagerRef.current.setUserVolume(userId, vol);
              setParticipants((prev) =>
                prev.map((p) => (p.id === userId ? { ...p, volume: vol } : p))
              );
            }}
          />
        ) : (
          <RoomLobby
            rooms={displayedRooms}
            groups={groups}
            isSyncing={isSyncingRooms}
            onSelectRoom={handleSelectRoom}
            onOpenCreateModal={(gId) => {
              setCreateRoomDefaultGroupId(gId || selectedGroupId || undefined);
              setIsCreateModalOpen(true);
            }}
            onOpenCreateGroupModal={() => setIsCreateGroupModalOpen(true)}
            onDeleteRoom={handleDeleteRoom}
            onDeleteGroup={handleDeleteGroup}
            onRefreshRooms={() => fetchRooms(false)}
            currentUserId={config.clientUserId}
          />
        )}
      </div>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        config={config}
        onLogin={handleLogin}
      />

      <CreateRoomModal
        isOpen={isCreateModalOpen}
        groups={groups}
        defaultGroupId={createRoomDefaultGroupId}
        clientUserId={config.clientUserId}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateRoom}
      />

      <CreateGroupModal
        isOpen={isCreateGroupModalOpen}
        clientUserId={config.clientUserId}
        onClose={() => setIsCreateGroupModalOpen(false)}
        onCreate={handleCreateGroup}
      />

      <PasswordModal
        isOpen={isPasswordModalOpen}
        room={selectedPasswordRoom}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setSelectedPasswordRoom(null);
        }}
        onConfirm={handlePasswordConfirm}
      />

      <ScreenSourceModal
        isOpen={isScreenSourceModalOpen}
        onClose={() => setIsScreenSourceModalOpen(false)}
        onStartShare={startScreenShare}
        getSources={handleGetSources}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        config={config}
        micVolumeLevel={micVolumeLevel}
        audioManager={audioManagerRef.current}
        onClose={() => setIsSettingsModalOpen(false)}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
};

export default App;
