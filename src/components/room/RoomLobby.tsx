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
} from 'lucide-react';
import { RoomSummary } from '../../types/live-room';

interface RoomLobbyProps {
  rooms: RoomSummary[];
  isSyncing?: boolean;
  onSelectRoom: (room: RoomSummary) => void;
  onOpenCreateModal: () => void;
  onDeleteRoom: (roomId: string) => void;
  onRefreshRooms?: () => void;
  currentUserId: string;
}

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  rooms,
  isSyncing = false,
  onSelectRoom,
  onOpenCreateModal,
  onDeleteRoom,
  onRefreshRooms,
  currentUserId,
}) => {
  const [search, setSearch] = useState('');

  const filtered = rooms.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 bg-discord-chat flex flex-col h-full overflow-y-auto select-none">
      {/* Hero Banner Header */}
      <div className="p-8 pb-6 bg-gradient-to-r from-discord-sidebar via-[#232428] to-[#1e1f22] border-b border-[#1f2023] relative overflow-hidden">
        <div className="max-w-4xl relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-discord-accent/20 border border-discord-accent/40 text-discord-accent text-xs font-semibold">
            <Sparkles size={14} />
            <span>WebCodecs GPU • Protocolo Binário 0xAA (~30ms)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Lobby de Salas Ao Vivo
          </h1>

          <p className="text-sm text-discord-textMuted max-w-2xl leading-relaxed">
            Transmita sua tela em até 60 FPS com aceleração GPU, converse por voz com baixa latência e compartilhe áudio do sistema com isolamento anti-eco.
          </p>

          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenCreateModal}
              className="px-5 py-2.5 rounded-lg bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-bold transition-all shadow-lg flex items-center gap-2 group cursor-pointer"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform" />
              <span>Criar Nova Sala</span>
            </button>

            {onRefreshRooms && (
              <button
                onClick={onRefreshRooms}
                className="px-4 py-2.5 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-discord-textNormal text-xs font-semibold transition-all border border-[#3f4147] flex items-center gap-2"
                title="Atualizar salas disponíveis"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin text-discord-accent' : ''} />
                <span>Atualizar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* Search & Stats Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Radio className="text-discord-green" size={20} />
            <h2 className="text-base font-bold text-discord-textHeader">
              Salas Ativas no Servidor ({filtered.length})
            </h2>
            <div className="flex items-center gap-1.5 text-[11px] text-discord-green bg-discord-green/10 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-ping" />
              <span>Ao Vivo</span>
            </div>
          </div>

          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-2.5 text-discord-textMuted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou descrição..."
              className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded-lg pl-9 pr-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
            />
          </div>
        </div>

        {/* Room Cards Grid */}
        {filtered.length === 0 ? (
          <div className="p-16 text-center bg-[#2b2d31]/40 rounded-2xl border border-dashed border-[#3f4147] space-y-4 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#1e1f22] flex items-center justify-center mx-auto text-discord-accent shadow-inner">
              <Volume2 size={32} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-discord-textHeader">
                Nenhuma sala ativa no momento
              </h3>
              <p className="text-xs text-discord-textMuted leading-relaxed">
                O servidor está online e pronto. Crie uma nova sala para começar a transmitir tela ou conversar por voz!
              </p>
            </div>
            <button
              onClick={onOpenCreateModal}
              className="px-5 py-2.5 rounded-xl bg-discord-accent text-white text-xs font-bold hover:bg-discord-accentHover transition-all shadow-lg inline-flex items-center gap-2"
            >
              <Plus size={16} />
              <span>Criar Primeira Sala</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((room) => {
              const isCreator =
                room.createdBy?.id === currentUserId ||
                room.createdBy?.id === 'usr-local' ||
                (room.createdBy?.name && room.createdBy.name.toLowerCase() === currentUserId.toLowerCase());

              return (
                <div
                  key={room.id}
                  className="bg-[#2b2d31] hover:bg-[#313338] border border-discord-border/60 hover:border-discord-accent/50 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 shadow-md group"
                >
                  <div className="space-y-3">
                    {/* Header: Title & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-discord-textHeader text-sm group-hover:text-white transition-colors line-clamp-1">
                        {room.title}
                      </h3>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {room.isPasswordProtected && (
                          <span
                            className="p-1 rounded bg-discord-yellow/15 text-discord-yellow"
                            title="Protegida por Senha"
                          >
                            <Lock size={13} />
                          </span>
                        )}
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold flex items-center gap-1 ${
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
                      {room.description || 'Sala ao vivo de áudio e transmissão de tela.'}
                    </p>

                    {/* Online Status Chip */}
                    <div className="flex items-center gap-1.5 text-[11px] text-discord-textMuted bg-[#1e1f22]/70 px-2.5 py-1 rounded-lg">
                      <div className={`w-2 h-2 rounded-full ${room.occupancy > 0 ? 'bg-discord-green animate-pulse' : 'bg-gray-500'}`} />
                      <span>{room.occupancy > 0 ? `${room.occupancy} pessoa(s) na call agora` : 'Ninguém na call no momento'}</span>
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
                          className="p-1.5 rounded text-discord-textMuted hover:text-discord-red hover:bg-discord-red/10 transition-colors"
                          title="Encerrar Sala (DELETE /live-rooms/:id)"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}

                      <button
                        onClick={() => onSelectRoom(room)}
                        className="px-4 py-1.5 rounded-lg bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-semibold transition-colors shadow"
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
    </div>
  );
};
