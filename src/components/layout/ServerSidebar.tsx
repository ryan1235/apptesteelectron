import React from 'react';
import { Radio, Plus, Compass, Settings, ShieldCheck, Flame } from 'lucide-react';

interface ServerSidebarProps {
  activeView: 'lobby' | 'room';
  onGoToLobby: () => void;
  onOpenCreateModal: () => void;
  onOpenSettings: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  activeView,
  onGoToLobby,
  onOpenCreateModal,
  onOpenSettings,
}) => {
  return (
    <div className="w-[72px] bg-discord-sidebar flex flex-col items-center py-3 gap-2 select-none border-r border-[#1f2023] z-20">
      {/* Home / Lobby Icon */}
      <button
        onClick={onGoToLobby}
        className={`relative group w-12 h-12 flex items-center justify-center transition-all duration-200 ${
          activeView === 'lobby'
            ? 'rounded-2xl bg-discord-accent text-white'
            : 'rounded-full bg-discord-channelList text-discord-textNormal hover:rounded-2xl hover:bg-discord-accent hover:text-white'
        }`}
        title="Lobby de Salas Ao Vivo"
      >
        <Radio size={24} />
        {/* Discord left pill indicator */}
        <span
          className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
            activeView === 'lobby' ? 'h-10' : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
          }`}
        />
      </button>

      {/* Separator */}
      <div className="w-8 h-[2px] bg-[#35363c] rounded my-1" />

      {/* Featured Community Server Icon */}
      <button
        className="relative group w-12 h-12 rounded-full bg-[#232428] text-discord-green hover:rounded-2xl hover:bg-discord-green hover:text-white flex items-center justify-center transition-all duration-200"
        title="Hub de Transmissão 60FPS"
      >
        <Flame size={22} />
        <span className="absolute left-0 w-1 bg-white rounded-r h-2 scale-0 group-hover:scale-100 group-hover:h-5 transition-all duration-200" />
      </button>

      {/* Security & Codec Hub */}
      <button
        className="relative group w-12 h-12 rounded-full bg-[#232428] text-[#5865f2] hover:rounded-2xl hover:bg-discord-accent hover:text-white flex items-center justify-center transition-all duration-200"
        title="WebCodecs GPU Relay (0xAA)"
      >
        <ShieldCheck size={22} />
        <span className="absolute left-0 w-1 bg-white rounded-r h-2 scale-0 group-hover:scale-100 group-hover:h-5 transition-all duration-200" />
      </button>

      {/* Add New Room */}
      <button
        onClick={onOpenCreateModal}
        className="w-12 h-12 rounded-full bg-discord-channelList text-discord-green hover:rounded-2xl hover:bg-discord-green hover:text-white flex items-center justify-center transition-all duration-200 group"
        title="Criar Nova Sala Ao Vivo"
      >
        <Plus size={22} />
      </button>

      {/* Explore */}
      <button
        className="w-12 h-12 rounded-full bg-discord-channelList text-discord-textMuted hover:rounded-2xl hover:bg-discord-green hover:text-white flex items-center justify-center transition-all duration-200 group"
        title="Explorar Salas Públicas"
      >
        <Compass size={22} />
      </button>

      {/* Bottom Settings Button */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-full bg-discord-channelList text-discord-textMuted hover:rounded-2xl hover:bg-[#35373c] hover:text-white flex items-center justify-center transition-all duration-200"
          title="Configurações do Servidor & Áudio"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
};
