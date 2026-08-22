import React from 'react';
import {
  Volume2,
  Lock,
  Plus,
  Search,
  Video,
  Mic,
  MicOff,
  Monitor,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { RoomSummary, Participant } from '../../types/live-room';
import { UserFooter } from './UserFooter';

interface ChannelSidebarProps {
  rooms: RoomSummary[];
  activeRoomId?: string;
  activeRoomParticipants?: Participant[];
  searchQuery: string;
  isSyncing?: boolean;
  onSearchChange: (q: string) => void;
  onSelectRoom: (room: RoomSummary) => void;
  onOpenCreateModal: () => void;
  onRefreshRooms?: () => void;
  // User state
  userName: string;
  avatarUrl?: string;
  isMicMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onOpenSettings: () => void;
  onOpenLogin?: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  rooms,
  activeRoomId,
  activeRoomParticipants = [],
  searchQuery = '',
  isSyncing = false,
  onSearchChange = () => {},
  onSelectRoom,
  onOpenCreateModal,
  onRefreshRooms,
  userName,
  avatarUrl,
  isMicMuted,
  isDeafened,
  isSpeaking,
  onToggleMic,
  onToggleDeafen,
  onOpenSettings,
  onOpenLogin,
}) => {
  const query = (searchQuery || '').toLowerCase();
  const filteredRooms = rooms.filter(
    (r) =>
      (r.title || '').toLowerCase().includes(query) ||
      (r.description || '').toLowerCase().includes(query)
  );

  return (
    <div className="w-60 bg-discord-channelList flex flex-col h-full select-none border-r border-[#1f2023]">
      {/* Header Bar */}
      <div className="h-12 px-4 flex items-center justify-between shadow-sm border-b border-[#1f2023] font-semibold text-discord-textHeader hover:bg-[#35373c]/30 cursor-pointer transition-colors">
        <div className="flex items-center gap-2 truncate">
          <Sparkles size={16} className="text-discord-accent flex-shrink-0" />
          <span className="truncate text-sm">Discord Live Rooms</span>
        </div>
      </div>

      {/* Search Input */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2 text-discord-textMuted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar salas..."
            className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded pl-8 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-discord-accent placeholder-discord-textMuted"
          />
        </div>
      </div>

      {/* Channels & Live Rooms List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {/* Category Header with Live Sync and Create */}
        <div className="flex items-center justify-between px-2 pt-2 pb-1 text-[11px] font-bold text-discord-textMuted tracking-wider uppercase">
          <div className="flex items-center gap-1.5">
            <span>Canais Ao Vivo</span>
            <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-pulse" title="Sincronizando em tempo real" />
            <span className="text-[10px] text-discord-accent font-normal">({filteredRooms.length})</span>
          </div>
          <div className="flex items-center gap-1">
            {onRefreshRooms && (
              <button
                onClick={onRefreshRooms}
                className="hover:text-discord-textHeader transition-colors p-0.5 rounded"
                title="Atualizar salas disponíveis"
              >
                <RefreshCw size={12} className={isSyncing ? 'animate-spin text-discord-accent' : ''} />
              </button>
            )}
            <button
              onClick={onOpenCreateModal}
              className="hover:text-discord-textHeader transition-colors p-0.5 rounded"
              title="Criar Sala Ao Vivo"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Room Channels */}
        {filteredRooms.length === 0 ? (
          <div className="text-center py-8 px-2 space-y-2">
            <p className="text-xs text-discord-textMuted">Nenhuma sala criada.</p>
            <button
              onClick={onOpenCreateModal}
              className="px-3 py-1.5 rounded bg-discord-accent/20 hover:bg-discord-accent text-discord-accent hover:text-white text-xs font-semibold transition-all inline-flex items-center gap-1"
            >
              <Plus size={12} />
              <span>Criar Sala</span>
            </button>
          </div>
        ) : (
          filteredRooms.map((room) => {
            const isActive = room.id === activeRoomId;
            return (
              <div key={room.id} className="space-y-0.5">
                {/* Channel Item */}
                <div
                  onClick={() => onSelectRoom(room)}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded-md cursor-pointer text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-[#35373c] text-white font-medium'
                      : 'text-discord-textMuted hover:bg-[#35373c]/50 hover:text-discord-textNormal'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="flex-shrink-0">
                      {room.occupancy > 0 || isActive ? (
                        <Volume2 size={16} className={isActive ? 'text-discord-green animate-pulse' : 'text-discord-green'} />
                      ) : (
                        <Video size={16} className="text-discord-textMuted" />
                      )}
                    </div>
                    <span className="truncate text-xs">{room.title}</span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {room.isPasswordProtected && (
                      <Lock size={12} className="text-discord-yellow" title="Protegida por senha" />
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium ${
                        room.occupancy > 0 || isActive
                          ? 'bg-discord-green/20 text-discord-green'
                          : 'bg-[#1e1f22] text-discord-textMuted'
                      }`}
                    >
                      {isActive ? activeRoomParticipants.length : room.occupancy}/{room.maxParticipants}
                    </span>
                  </div>
                </div>

                {/* Sub-list of Connected Online Users in the Active Channel (Discord Style) */}
                {isActive && activeRoomParticipants.length > 0 && (
                  <div className="pl-6 pr-1 py-1 space-y-1">
                    {activeRoomParticipants
                      .filter((p, idx, arr) => arr.findIndex((x) => (x.name || '').toLowerCase() === (p.name || '').toLowerCase() || x.id === p.id) === idx)
                      .map((participant) => (
                      <div
                        key={participant.id}
                        className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-[#35373c]/40 text-xs transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Avatar with speaking glow */}
                          <div
                            className={`w-5 h-5 rounded-full overflow-hidden flex-shrink-0 font-bold text-[9px] flex items-center justify-center text-white ${
                              participant.isSpeaking && participant.micOn
                                ? 'ring-2 ring-discord-green'
                                : 'bg-discord-accent'
                            }`}
                          >
                            {participant.avatarUrl ? (
                              <img src={participant.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (participant.name || 'U').substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className="text-[11px] text-discord-textHeader truncate font-medium">
                            {participant.name || 'Usuário'}
                          </span>
                        </div>

                        {/* Status Icons: Screen share / Mic */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {participant.isScreenSharing && (
                            <span title="Compartilhando Tela" className="text-discord-accent">
                              <Monitor size={11} />
                            </span>
                          )}
                          {!participant.micOn && (
                            <span title="Microfone Mutado" className="text-discord-red">
                              <MicOff size={11} />
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Discord User Profile Footer */}
      <UserFooter
        userName={userName}
        avatarUrl={avatarUrl}
        isMicMuted={isMicMuted}
        isDeafened={isDeafened}
        isSpeaking={isSpeaking}
        onToggleMic={onToggleMic}
        onToggleDeafen={onToggleDeafen}
        onOpenSettings={onOpenSettings}
        onOpenLogin={onOpenLogin}
      />
    </div>
  );
};
