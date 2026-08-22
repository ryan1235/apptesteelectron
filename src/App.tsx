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
} from './types/live-room';
import { loadSavedConfig, saveConfig } from './config/env';
import { LiveRoomsApiClient } from './services/api';
import { LiveRoomWebSocketClient } from './services/websocket';
import { AudioManager } from './services/audioManager';
import { WebCodecsVideoPipeline } from './services/videoCodecs';
import { ScreenCapturer } from './services/screenCapturer';

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

  // Rooms & Navigation State
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [isSyncingRooms, setIsSyncingRooms] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<RoomDetails | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string>('usr-local-id');

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

  // Modal Visibility States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
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

  // Initialize Services & Handlers
  useEffect(() => {
    const ws = wsClientRef.current;
    const audio = audioManagerRef.current;
    const video = videoCodecsRef.current;

    // Canvas target for video decoding
    if (canvasRef.current) {
      video.setTargetCanvas(canvasRef.current);
    }

    // Video callbacks
    video.setOnVideoPacket((packet) => {
      ws.sendBinary(packet);
    });

    video.setOnTelemetryUpdate((stats) => {
      setTelemetry((prev) => ({
        ...prev,
        fps: stats.fps,
        bitrateKbps: stats.bitrateKbps,
        codec: stats.codec,
      }));
    });

    // Audio callbacks
    audio.setCallbacks(
      (packet) => {
        ws.sendBinary(packet);
      },
      (speaking) => {
        setIsSpeaking(speaking);
        if (activeRoomRef.current) {
          ws.sendJson({
            type: 'user_speaking',
            roomId: activeRoomRef.current.id,
            isSpeaking: speaking,
          });
          setParticipants((prev) =>
            prev.map((p) =>
              p.id === currentUserIdRef.current || (p.name && p.name.toLowerCase() === configRef.current.userName.toLowerCase())
                ? { ...p, isSpeaking: speaking }
                : p
            )
          );
        }
      },
      (level) => {
        setMicVolumeLevel(level);
      }
    );

    // WebSocket callbacks
    ws.setCallbacks({
      onConnectionStatus: (status) => {
        setConnectionStatus(status);
      },
      onJsonMessage: (msg) => {
        handleServerRxJson(msg);
      },
      onBinaryVideo: (header) => {
        video.handleIncomingVideoPacket(
          header.payload,
          header.isKeyframe,
          header.timestampUs
        );
      },
      onBinaryAudio: (packetType, payload, senderId) => {
        audio.playRemoteAudioChunk(packetType, payload, senderId);
      },
    });

    // Connect WebSocket
    ws.connect();

    // Fetch initial rooms list
    fetchRooms();

    // Real-time live room synchronization interval (every 2.5s)
    const syncInterval = setInterval(() => {
      fetchRooms(true);
    }, 2500);

    return () => {
      clearInterval(syncInterval);
      ws.disconnect();
      audio.stop();
      video.destroy();
      screenCapturerRef.current.stopCapture();
    };
  }, []);

  // Update canvas target whenever canvasRef changes
  useEffect(() => {
    if (canvasRef.current) {
      videoCodecsRef.current.setTargetCanvas(canvasRef.current);
    }
  }, [activePresenter, isScreenSharing]);

  const fetchRooms = async (silent = false) => {
    if (!silent) setIsSyncingRooms(true);
    try {
      const list = await apiClientRef.current.getLiveRooms();
      setRooms(list);
      setAuthError(null);
    } catch (err: any) {
      if (err.message?.includes('Token') || err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        setAuthError('Token JWT inválido ou ausente. Faça login com sua conta para sincronizar as salas.');
      } else {
        console.warn('Erro ao sincronizar salas:', err);
      }
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
              userName: configRef.current.userName,
              avatarUrl: configRef.current.avatarUrl || null,
            });
          }
          break;

        case 'room_state':
          if (msg.yourUserId) {
            setCurrentUserId(msg.yourUserId);
          }
          if (Array.isArray(msg.participants)) {
            setParticipants(
              msg.participants.map((p: any) => {
                const isMe =
                  p.userId === msg.yourUserId ||
                  p.id === msg.yourUserId ||
                  (p.name && p.name.toLowerCase() === configRef.current.userName.toLowerCase());

                return {
                  id: p.userId || p.id || 'usr-' + Math.random().toString(36).substring(2, 7),
                  name: p.name || p.userName || 'Participante',
                  avatarUrl: p.avatarUrl || null,
                  micOn: isMe ? !isMicMuted : Boolean(p.micOn),
                  isSpeaking: Boolean(p.isSpeaking),
                  isScreenSharing: Boolean(p.isSharing || p.isScreenSharing || p.isPresenter),
                  isHost: Boolean(p.isHost),
                  volume: p.volume ?? 100,
                };
              })
            );
          }
          if (msg.activeScreenShare) {
            setActivePresenter({
              userId: msg.activeScreenShare.userId || msg.activeScreenShare.presenterId,
              userName: msg.activeScreenShare.name || msg.activeScreenShare.presenterName || 'Apresentador',
              qualityProfile: msg.activeScreenShare.qualityProfile || 'SMOOTH_60FPS',
              startedAt: msg.activeScreenShare.startedAt || new Date().toISOString(),
            });
          } else if (msg.activePresenter !== undefined) {
            setActivePresenter(msg.activePresenter);
          }
          break;

        case 'user_joined': {
          const userObj = msg.participant || msg.user || msg;
          const newUserId = userObj.userId || userObj.id || msg.userId || 'usr-' + Math.random().toString(36).substring(2, 7);
          const newUserName = userObj.name || msg.userName || 'Participante';
          const newParticipant: Participant = {
            id: newUserId,
            name: newUserName,
            avatarUrl: userObj.avatarUrl || msg.avatarUrl || null,
            micOn: Boolean(userObj.micOn),
            isSpeaking: Boolean(userObj.isSpeaking),
            isScreenSharing: Boolean(userObj.isSharing || userObj.isScreenSharing),
            volume: 100,
          };

          setParticipants((prev) => {
            const existingIndex = prev.findIndex(
              (p) => p.id === newUserId || (p.name && p.name.toLowerCase() === newUserName.toLowerCase())
            );
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = { ...updated[existingIndex], ...newParticipant };
              return updated;
            }
            return [...prev, newParticipant];
          });
          break;
        }

        case 'user_left': {
          const leftId = msg.userId || (msg.user && msg.user.id);
          const leftName = msg.userName || (msg.user && msg.user.name);
          if (leftId || leftName) {
            setParticipants((prev) =>
              prev.filter(
                (p) => p.id !== leftId && (!leftName || p.name.toLowerCase() !== leftName.toLowerCase())
              )
            );
          }
          if (activePresenter?.userId === leftId) {
            setActivePresenter(null);
          }
          break;
        }

        case 'screen_share_started': {
          const presenterId = msg.userId || msg.presenterId || 'presenter';
          setActivePresenter({
            userId: presenterId,
            userName: msg.name || msg.presenterName || 'Apresentador',
            qualityProfile: msg.qualityProfile || 'SMOOTH_60FPS',
            startedAt: new Date().toISOString(),
          });
          setParticipants((prev) =>
            prev.map((p) => (p.id === presenterId ? { ...p, isScreenSharing: true } : p))
          );
          break;
        }

        case 'screen_share_stopped': {
          const presenterId = msg.userId || msg.presenterId;
          if (!presenterId || activePresenter?.userId === presenterId) {
            setActivePresenter(null);
          }
          setParticipants((prev) =>
            prev.map((p) => (p.id === presenterId ? { ...p, isScreenSharing: false } : p))
          );
          break;
        }

        case 'mic_updated': {
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
            userId: msg.userId || '',
            userName: msg.userName || msg.name || 'Anônimo',
            avatarUrl: msg.avatarUrl || null,
            content: msg.content || msg.text || '',
            createdAt: msg.createdAt || new Date().toISOString(),
          };
          setMessages((prev) => [...prev, chatMsg]);
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

      // Join via WebSocket
      wsClientRef.current.sendJson({
        type: 'join_room',
        roomId,
        password,
        userName: config.userName,
        avatarUrl: config.avatarUrl || null,
      });

      // Synchronize mic state to server
      wsClientRef.current.sendJson({
        type: 'toggle_mic',
        roomId,
        micOn: !isMicMuted,
      });
    } catch (err: any) {
      console.error('Erro ao conectar na sala:', err);
    }
  };

  // Leave room workflow
  const leaveRoom = () => {
    if (activeRoom) {
      wsClientRef.current.sendJson({
        type: 'leave_room',
        roomId: activeRoom.id,
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
    fetchRooms();
  };

  // Create room
  const handleCreateRoom = async (payload: CreateRoomPayload) => {
    try {
      const created = await apiClientRef.current.createRoom(payload);
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

  // Toggle Microphone
  const handleToggleMic = async () => {
    const newMuted = !isMicMuted;
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
    setIsDeafened(newDeafened);
    audioManagerRef.current.setDeafened(newDeafened);
  };

  // Screen Sharing workflow
  const handleToggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      setIsScreenSourceModalOpen(true);
    }
  };

  const startScreenShare = async (
    sourceId: string,
    profile: QualityProfile,
    captureAudio: boolean
  ) => {
    if (!activeRoom) return;

    try {
      const result = await screenCapturerRef.current.startCapture(
        sourceId,
        profile,
        captureAudio
      );

      setLocalScreenStream(result.stream);
      setIsScreenSharing(true);
      setActiveProfile(profile);

      // WebCodecs GPU encoding
      await videoCodecsRef.current.startEncoding(result.stream, activeRoom.id, profile);

      // Notify WebSocket server
      wsClientRef.current.sendJson({
        type: 'start_screen_share',
        roomId: activeRoom.id,
        qualityProfile: profile,
      });

      // Handle stream end (user stops via native OS bar)
      result.stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err: any) {
      console.error('Erro ao iniciar compartilhamento de tela:', err);
      alert('Não foi possível iniciar o compartilhamento de tela.');
    }
  };

  const stopScreenShare = () => {
    screenCapturerRef.current.stopCapture();
    videoCodecsRef.current.stopEncoding();
    setLocalScreenStream(null);
    setIsScreenSharing(false);

    if (activeRoom) {
      wsClientRef.current.sendJson({
        type: 'stop_screen_share',
        roomId: activeRoom.id,
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
          onGoToLobby={leaveRoom}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />

        {/* Channel Sidebar (Rooms List & User Footer) */}
        <ChannelSidebar
          rooms={rooms}
          activeRoomId={activeRoom?.id}
          activeRoomParticipants={participants}
          searchQuery={searchQuery}
          isSyncing={isSyncingRooms}
          onSearchChange={setSearchQuery}
          onSelectRoom={handleSelectRoom}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
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
                });
              }
            }}
            onSendMessage={handleSendMessage}
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
            rooms={rooms}
            isSyncing={isSyncingRooms}
            onSelectRoom={handleSelectRoom}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onDeleteRoom={handleDeleteRoom}
            onRefreshRooms={() => fetchRooms(false)}
            currentUserId={currentUserId}
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
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateRoom}
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
