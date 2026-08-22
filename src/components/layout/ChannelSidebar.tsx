import React, { useState } from 'react';
import {
  Volume2,
  Lock,
  Plus,
  Search,
  Video,
  Monitor,
  MicOff,
  Sparkles,
  RefreshCw,
  Users,
  ChevronDown,
  ChevronRight,
  Layers,
  Radio,
} from 'lucide-react';
import { RoomSummary, Participant, LiveGroup } from '../../types/live-room';
import { UserFooter } from './UserFooter';

interface ChannelSidebarProps {
  rooms: RoomSummary[];
  groups?: LiveGroup[];
  activeRoomId?: string;
  activeRoomParticipants?: Participant[];
  searchQuery: string;
  isSyncing?: boolean;
  onSearchChange: (q: string) => void;
  onSelectRoom: (room: RoomSummary) => void;
  onOpenCreateModal: (groupId?: string) => void;
  onOpenCreateGroupModal?: () => void;
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
  groups = [],
  activeRoomId,
  activeRoomParticipants = [],
  searchQuery = '',
  isSyncing = false,
  onSearchChange = () => {},
  onSelectRoom,
  onOpenCreateModal,
  onOpenCreateGroupModal,
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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const query = (searchQuery || '').toLowerCase();
  const filteredRooms = rooms.filter(
    (r) =>
      (r.title || '').toLowerCase().includes(query) ||
      (r.description || '').toLowerCase().includes(query)
  );

  // Separate Standalone / Public rooms vs Group-linked rooms
  const standaloneRooms = filteredRooms.filter((r) => !r.groupId);
  const groupRooms = filteredRooms.filter((r) => Boolean(r.groupId));

  return (
    <div className="w-60 bg-discord-channelList flex flex-col h-full select-none border-r border-[#1f2023]">
      {/* Header Bar */}
      <div className="h-12 px-4 flex items-center justify-between shadow-sm border-b border-[#1f2023] font-semibold text-discord-textHeader hover:bg-[#35373c]/30 cursor-pointer transition-colors">
        <div className="flex items-center gap-2 truncate">
          <Sparkles size={16} className="text-discord-accent flex-shrink-0" />
          <span className="truncate text-sm font-bold">Discord Live Rooms</span>
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
            placeholder="Buscar salas ou squads..."
            className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded pl-8 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-discord-accent placeholder-discord-textMuted"
          />
        </div>
      </div>

      {/* Channels & Live Rooms Stream */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {/* SECTION 1: SALAS PÚBLICAS / AVULSAS */}
        <div className="space-y-0.5">
          <div
            onClick={() => toggleSection('public')}
            className="flex items-center justify-between px-2 pt-1 pb-1 text-[11px] font-bold text-discord-textMuted tracking-wider uppercase cursor-pointer hover:text-discord-textHeader transition-colors group"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections['public'] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <Radio size={12} className="text-discord-green" />
              <span>Salas Avulsas</span>
              <span className="text-[10px] text-discord-textMuted font-mono">({standaloneRooms.length})</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenCreateModal();
              }}
              className="hover:text-white transition-colors p-0.5 rounded"
              title="Criar Sala Avulsa"
            >
              <Plus size={14} />
            </button>
          </div>

          {!collapsedSections['public'] && (
            <div className="space-y-0.5 pt-0.5">
              {standaloneRooms.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-discord-textMuted italic">
                  Nenhuma sala avulsa criada.
                </div>
              ) : (
                standaloneRooms.map((room) => {
                  const isActive = room.id === activeRoomId;
                  return (
                    <div key={room.id} className="space-y-0.5">
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
                            <span title="Protegida por senha">
                              <Lock size={12} className="text-discord-yellow" />
                            </span>
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

                      {/* Online Members Subtree for Active Room */}
                      {isActive && activeRoomParticipants.length > 0 && (
                        <div className="pl-6 pr-1 py-1 space-y-1">
                          {activeRoomParticipants
                            .filter((p, idx, arr) => arr.findIndex((x) => (x.name || '').toLowerCase() === (p.name || '').toLowerCase() || x.id === p.id) === idx)
                            .map((participant) => (
                              <div
                                key={participant.id}
                                className="flex items-center justify-between py-0.5 px-1.5 rounded hover:bg-[#35373c]/40 text-xs transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div
                                    className={`w-4 h-4 rounded-full overflow-hidden flex-shrink-0 font-bold text-[8px] flex items-center justify-center text-white ${
                                      participant.isSpeaking
                                        ? 'ring-2 ring-discord-green shadow-sm shadow-discord-green'
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
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {participant.isScreenSharing && (
                                    <span title="Compartilhando Tela" className="text-discord-accent">
                                      <Monitor size={10} />
                                    </span>
                                  )}
                                  {!participant.micOn && (
                                    <span title="Microfone Mutado" className="text-discord-red">
                                      <MicOff size={10} />
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
          )}
        </div>

        {/* SECTION 2: SQUADS & GRUPOS PRIVADOS */}
        <div className="space-y-1 pt-1 border-t border-[#1f2023]">
          <div
            onClick={() => toggleSection('squads')}
            className="flex items-center justify-between px-2 pt-2 pb-1 text-[11px] font-bold text-discord-textMuted tracking-wider uppercase cursor-pointer hover:text-discord-textHeader transition-colors"
          >
            <div className="flex items-center gap-1.5">
              {collapsedSections['squads'] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
              <Layers size={12} className="text-discord-accent" />
              <span>Squads & Grupos</span>
              <span className="text-[10px] text-discord-textMuted font-mono">({groups.length})</span>
            </div>
            {onOpenCreateGroupModal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCreateGroupModal();
                }}
                className="hover:text-white transition-colors p-0.5 rounded"
                title="Criar Novo Squad/Grupo"
              >
                <Plus size={14} />
              </button>
            )}
          </div>

          {!collapsedSections['squads'] && (
            <div className="space-y-2 pt-0.5">
              {groups.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-discord-textMuted italic">
                  Nenhum grupo criado ainda.
                </div>
              ) : (
                groups.map((group) => {
                  const roomsInGroup = groupRooms.filter((r) => r.groupId === group.id);
                  const isGroupCollapsed = collapsedSections[`grp-${group.id}`];

                  return (
                    <div key={group.id} className="bg-[#1e1f22]/50 rounded-xl p-1 border border-[#26282c]">
                      {/* Group Mini Header */}
                      <div
                        onClick={() => toggleSection(`grp-${group.id}`)}
                        className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-[#2b2d31]/60 rounded-lg transition-colors group"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isGroupCollapsed ? <ChevronRight size={11} className="text-discord-textMuted" /> : <ChevronDown size={11} className="text-discord-textMuted" />}
                          <div className="w-4 h-4 rounded-md bg-discord-accent/20 flex items-center justify-center text-[9px] font-bold text-discord-accent overflow-hidden flex-shrink-0">
                            {group.avatarUrl ? (
                              <img src={group.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              group.name.substring(0, 1).toUpperCase()
                            )}
                          </div>
                          <span className="text-xs font-bold text-discord-textHeader truncate">
                            {group.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCreateModal(group.id);
                            }}
                            className="text-discord-textMuted hover:text-white p-0.5 rounded hover:bg-[#35373c] transition-colors"
                            title={`Criar sala em ${group.name}`}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Rooms inside this group */}
                      {!isGroupCollapsed && (
                        <div className="space-y-0.5 pt-1 pl-1">
                          {roomsInGroup.length === 0 ? (
                            <div className="px-2 py-1 text-[10px] text-discord-textMuted italic flex items-center justify-between">
                              <span>Sem salas ativas</span>
                              <button
                                onClick={() => onOpenCreateModal(group.id)}
                                className="text-discord-accent hover:underline text-[10px] font-semibold"
                              >
                                + Criar Sala
                              </button>
                            </div>
                          ) : (
                            roomsInGroup.map((room) => {
                              const isActive = room.id === activeRoomId;
                              return (
                                <div key={room.id} className="space-y-0.5">
                                  <div
                                    onClick={() => onSelectRoom(room)}
                                    className={`flex items-center justify-between px-2 py-1 rounded-md cursor-pointer text-xs transition-colors ${
                                      isActive
                                        ? 'bg-[#35373c] text-white font-medium'
                                        : 'text-discord-textMuted hover:bg-[#35373c]/50 hover:text-discord-textNormal'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <Volume2 size={13} className={isActive ? 'text-discord-green animate-pulse' : 'text-discord-textMuted'} />
                                      <span className="truncate text-xs">{room.title}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-discord-textMuted">
                                      {isActive ? activeRoomParticipants.length : room.occupancy}/{room.maxParticipants}
                                    </span>
                                  </div>

                                  {/* Active members */}
                                  {isActive && activeRoomParticipants.length > 0 && (
                                    <div className="pl-5 pr-1 py-0.5 space-y-0.5">
                                      {activeRoomParticipants
                                        .filter((p, idx, arr) => arr.findIndex((x) => (x.name || '').toLowerCase() === (p.name || '').toLowerCase() || x.id === p.id) === idx)
                                        .map((participant) => (
                                          <div
                                            key={participant.id}
                                            className="flex items-center justify-between py-0.5 px-1 rounded text-[11px] text-discord-textHeader"
                                          >
                                            <span className="truncate font-medium">{participant.name}</span>
                                            {!participant.micOn && <MicOff size={9} className="text-discord-red" />}
                                          </div>
                                        ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
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
