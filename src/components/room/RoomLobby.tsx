import React, { useState } from 'react';
import {
  Volume2,
  Lock,
  Plus,
  Users,
  Sparkles,
  Search,
  Radio,
  Trash2,
  Shield,
  Monitor,
  UserCheck,
  RefreshCw,
  Layers,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  Hash,
} from 'lucide-react';
import { RoomSummary, LiveGroup } from '../../types/live-room';

interface RoomLobbyProps {
  rooms: RoomSummary[];
  groups?: LiveGroup[];
  isSyncing?: boolean;
  onSelectRoom: (room: RoomSummary) => void;
  onOpenCreateModal: (groupId?: string) => void;
  onOpenCreateGroupModal: () => void;
  onDeleteRoom: (roomId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onJoinGroup?: (groupId: string) => void;
  onRefreshRooms?: () => void;
  currentUserId: string;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  rooms,
  groups = [],
  isSyncing = false,
  onSelectRoom,
  onOpenCreateModal,
  onOpenCreateGroupModal,
  onDeleteRoom,
  onDeleteGroup,
  onJoinGroup,
  onRefreshRooms,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'rooms' | 'groups'>('rooms');
  const [search, setSearch] = useState('');

  const filteredRooms = rooms.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.description?.toLowerCase().includes(search.toLowerCase()) ||
      g.customGroupId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 bg-discord-chat flex flex-col h-full overflow-y-auto select-none">
      {/* Hero Banner Header */}
      <div className="p-8 pb-6 bg-gradient-to-r from-discord-sidebar via-[#232428] to-[#1e1f22] border-b border-[#1f2023] relative overflow-hidden">
        <div className="max-w-5xl relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-discord-accent/20 border border-discord-accent/40 text-discord-accent text-xs font-semibold">
            <Sparkles size={14} />
            <span>WebCodecs GPU 60 FPS • Grupos & Salas Ao Vivo</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Lobby & Comunidades Ao Vivo
          </h1>

          <p className="text-sm text-discord-textMuted max-w-2xl leading-relaxed">
            Navegue pelas salas abertas ou junte-se aos Grupos/Squads com histórico de membros e canais de áudio de estúdio dedicados.
          </p>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onOpenCreateModal()}
              className="px-5 py-2.5 rounded-xl bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2 group cursor-pointer"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform" />
              <span>Criar Sala Ao Vivo</span>
            </button>

            <button
              onClick={onOpenCreateGroupModal}
              className="px-4 py-2.5 rounded-xl bg-[#2b2d31] hover:bg-[#35373c] text-discord-textHeader text-xs font-bold transition-all border border-[#3f4147] flex items-center gap-2 shadow-sm"
            >
              <Layers size={15} className="text-discord-accent" />
              <span>Criar Novo Grupo</span>
            </button>

            {onRefreshRooms && (
              <button
                onClick={onRefreshRooms}
                className="px-4 py-2.5 rounded-xl bg-[#1e1f22] hover:bg-[#2b2d31] text-discord-textMuted hover:text-white text-xs font-semibold transition-all border border-[#2b2d31] flex items-center gap-2"
                title="Atualizar lista"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin text-discord-accent' : ''} />
                <span>Atualizar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs & Search Bar */}
      <div className="px-8 pt-6 pb-2 max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#1f2023]">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-[#1e1f22] p-1 rounded-xl border border-[#2b2d31]">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'rooms'
                ? 'bg-discord-accent text-white shadow-sm'
                : 'text-discord-textMuted hover:text-white'
            }`}
          >
            <Radio size={15} />
            <span>Todas as Salas ({rooms.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'groups'
                ? 'bg-discord-accent text-white shadow-sm'
                : 'text-discord-textMuted hover:text-white'
            }`}
          >
            <Layers size={15} />
            <span>Grupos & Squads ({groups.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-2.5 text-discord-textMuted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'rooms' ? 'Buscar salas por título...' : 'Buscar grupos...'}
            className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded-xl pl-9 pr-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted shadow-inner"
          />
        </div>
      </div>

      {/* Main Tab Content Grid */}
      <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* TAB 1: TODAS AS SALAS */}
        {activeTab === 'rooms' && (
          <div>
            {filteredRooms.length === 0 ? (
              <div className="p-16 text-center bg-[#2b2d31]/30 rounded-2xl border border-dashed border-[#3f4147] space-y-4 max-w-xl mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-[#1e1f22] flex items-center justify-center mx-auto text-discord-accent shadow-inner">
                  <Volume2 size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-discord-textHeader">
                    Nenhuma sala ativa no momento
                  </h3>
                  <p className="text-xs text-discord-textMuted leading-relaxed">
                    Crie uma nova sala para começar a transmitir tela em 60 FPS ou conversar por voz!
                  </p>
                </div>
                <button
                  onClick={() => onOpenCreateModal()}
                  className="px-5 py-2.5 rounded-xl bg-discord-accent text-white text-xs font-bold hover:bg-discord-accentHover transition-all shadow-lg inline-flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>Criar Primeira Sala</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRooms.map((room) => {
                  const isCreator =
                    room.createdBy?.id === currentUserId ||
                    room.clientUserId === currentUserId ||
                    (room.createdBy?.name && room.createdBy.name.toLowerCase() === currentUserId.toLowerCase());

                  return (
                    <div
                      key={room.id}
                      className="bg-[#2b2d31]/80 hover:bg-[#313338] border border-discord-border/60 hover:border-discord-accent/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-md group"
                    >
                      <div className="space-y-3">
                        {/* Header: Title & Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-bold text-discord-textHeader text-sm group-hover:text-white transition-colors line-clamp-1">
                            {room.title}
                          </h3>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {room.isPasswordProtected && (
                              <span
                                className="p-1 rounded-md bg-discord-yellow/15 text-discord-yellow"
                                title="Protegida por Senha"
                              >
                                <Lock size={13} />
                              </span>
                            )}
                            <span
                              className={`text-[11px] px-2.5 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 ${
                                room.occupancy > 0
                                  ? 'bg-discord-green/20 text-discord-green'
                                  : 'bg-[#1e1f22] text-discord-textMuted'
                              }`}
                            >
                              <Users size={11} />
                              <span>
                                {room.occupancy}/{room.maxParticipants}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-discord-textMuted line-clamp-2 leading-relaxed">
                          {room.description || 'Sala ao vivo com aceleração GPU e voz sem ruído.'}
                        </p>

                        {/* Custom Room ID Badge */}
                        {room.customRoomId && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#1e1f22] text-[10px] text-discord-accent font-mono">
                            <Hash size={10} />
                            <span>{room.customRoomId}</span>
                          </div>
                        )}

                        {/* Online Status Chip */}
                        <div className="flex items-center gap-2 text-[11px] text-discord-textMuted bg-[#1e1f22]/70 px-3 py-1.5 rounded-xl">
                          <div className={`w-2 h-2 rounded-full ${room.occupancy > 0 ? 'bg-discord-green animate-pulse' : 'bg-gray-500'}`} />
                          <span>{room.occupancy > 0 ? `${room.occupancy} pessoa(s) ao vivo` : 'Ninguém na call'}</span>
                        </div>
                      </div>

                      {/* Footer Info & Actions */}
                      <div className="pt-4 mt-4 border-t border-discord-border/40 flex items-center justify-between">
                        {/* Creator Info */}
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-discord-accent text-white flex items-center justify-center text-[10px] font-bold overflow-hidden flex-shrink-0">
                            {room.createdBy?.avatarUrl ? (
                              <img src={room.createdBy.avatarUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (room.createdBy?.name || 'U').substring(0, 2).toUpperCase()
                            )}
                          </div>
                          <span className="text-[11px] text-discord-textMuted truncate font-medium">
                            {room.createdBy?.name || 'Criador'}
                          </span>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-2">
                          {isCreator && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteRoom(room.id);
                              }}
                              className="p-1.5 rounded-lg text-discord-textMuted hover:text-discord-red hover:bg-discord-red/10 transition-colors"
                              title="Encerrar Sala"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}

                          <button
                            onClick={() => onSelectRoom(room)}
                            className="px-4 py-1.5 rounded-xl bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-bold transition-all shadow-md"
                          >
                            Entrar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GRUPOS & SERVIDORES (LIVE GROUPS) */}
        {activeTab === 'groups' && (
          <div>
            {filteredGroups.length === 0 ? (
              <div className="p-16 text-center bg-[#2b2d31]/30 rounded-2xl border border-dashed border-[#3f4147] space-y-4 max-w-xl mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-[#1e1f22] flex items-center justify-center mx-auto text-discord-accent shadow-inner">
                  <Layers size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-discord-textHeader">
                    Nenhum Grupo Criado
                  </h3>
                  <p className="text-xs text-discord-textMuted leading-relaxed">
                    Crie um Grupo/Squad para organizar suas salas ao vivo em canais de voz dedicados!
                  </p>
                </div>
                <button
                  onClick={onOpenCreateGroupModal}
                  className="px-5 py-2.5 rounded-xl bg-discord-accent text-white text-xs font-bold hover:bg-discord-accentHover transition-all shadow-lg inline-flex items-center gap-2"
                >
                  <Plus size={16} />
                  <span>Criar Primeiro Grupo</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredGroups.map((group) => {
                  const isOwner = group.clientUserId === currentUserId;
                  const groupRooms = rooms.filter((r) => r.groupId === group.id);

                  return (
                    <div
                      key={group.id}
                      className="bg-[#2b2d31]/80 hover:bg-[#313338] border border-discord-border/60 hover:border-discord-accent/50 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-md space-y-4"
                    >
                      {/* Top Group Info */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-2xl bg-discord-accent text-white flex items-center justify-center font-extrabold text-base overflow-hidden shadow-md flex-shrink-0">
                              {group.avatarUrl ? (
                                <img src={group.avatarUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                group.name.substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-discord-textHeader text-base truncate">
                                  {group.name}
                                </h3>
                                {group.isPasswordProtected && (
                                  <Lock size={13} className="text-discord-yellow flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-discord-textMuted line-clamp-1 mt-0.5">
                                {group.description || 'Grupo e servidor de salas ao vivo.'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {isOwner && onDeleteGroup && (
                              <button
                                onClick={() => onDeleteGroup(group.id)}
                                className="p-1.5 rounded-lg text-discord-textMuted hover:text-discord-red hover:bg-discord-red/10 transition-colors"
                                title="Encerrar Grupo"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Group Meta Info Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
                          {group.customGroupId && (
                            <span className="px-2 py-0.5 rounded-md bg-[#1e1f22] text-discord-accent font-mono">
                              #{group.customGroupId}
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 rounded-full bg-discord-green/15 text-discord-green flex items-center gap-1 font-bold">
                            <Volume2 size={12} />
                            <span>{groupRooms.length} salas ativas</span>
                          </span>
                        </div>
                      </div>

                      {/* Group Rooms List (Inside the Card) */}
                      <div className="p-3 bg-[#1e1f22]/70 rounded-xl border border-[#2b2d31] space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-discord-textMuted">
                          <span>Salas deste Grupo:</span>
                          <button
                            onClick={() => onOpenCreateModal(group.id)}
                            className="text-discord-accent hover:underline flex items-center gap-1"
                          >
                            <Plus size={12} />
                            <span>Criar Sala no Grupo</span>
                          </button>
                        </div>

                        {groupRooms.length === 0 ? (
                          <div className="text-center py-3 text-[11px] text-discord-textMuted">
                            Nenhuma sala aberta neste grupo.
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {groupRooms.map((gr) => (
                              <div
                                key={gr.id}
                                onClick={() => onSelectRoom(gr)}
                                className="flex items-center justify-between p-2 rounded-lg bg-[#2b2d31] hover:bg-discord-accent/20 border border-transparent hover:border-discord-accent/40 cursor-pointer transition-colors text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Volume2 size={14} className="text-discord-green flex-shrink-0" />
                                  <span className="font-semibold text-discord-textNormal truncate">
                                    {gr.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-discord-textMuted">
                                  <span>{gr.occupancy}/{gr.maxParticipants}</span>
                                  <ChevronRight size={14} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
