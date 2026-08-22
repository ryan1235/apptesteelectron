import React from 'react';
import { Radio, Plus, Settings, Layers, Flame } from 'lucide-react';
import { LiveGroup } from '../../types/live-room';

interface ServerSidebarProps {
  activeView: 'lobby' | 'room';
  groups?: LiveGroup[];
  selectedGroupId?: string | null;
  onGoToLobby: () => void;
  onSelectGroup?: (groupId: string | null) => void;
  onOpenCreateModal: () => void;
  onOpenCreateGroupModal?: () => void;
  onOpenSettings: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  activeView,
  groups = [],
  selectedGroupId = null,
  onGoToLobby,
  onSelectGroup,
  onOpenCreateModal,
  onOpenCreateGroupModal,
  onOpenSettings,
}) => {
  return (
    <div className="w-[72px] bg-discord-sidebar flex flex-col items-center py-3 gap-2 select-none border-r border-[#1f2023] z-20 overflow-y-auto">
      {/* Home / General Lobby Icon */}
      <button
        onClick={() => {
          if (onSelectGroup) onSelectGroup(null);
          onGoToLobby();
        }}
        className={`relative group w-12 h-12 flex items-center justify-center transition-all duration-200 ${
          activeView === 'lobby' && selectedGroupId === null
            ? 'rounded-2xl bg-discord-accent text-white shadow-lg shadow-discord-accent/20'
            : 'rounded-full bg-discord-channelList text-discord-textNormal hover:rounded-2xl hover:bg-discord-accent hover:text-white'
        }`}
        title="Lobby Geral de Salas"
      >
        <Radio size={22} />
        {/* Discord left pill indicator */}
        <span
          className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
            activeView === 'lobby' && selectedGroupId === null
              ? 'h-10'
              : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
          }`}
        />
      </button>

      {/* Separator */}
      <div className="w-8 h-[2px] bg-[#35363c] rounded my-1" />

      {/* Dynamic LiveGroup Discord Servers */}
      {groups.map((group) => {
        const isSelected = selectedGroupId === group.id;

        return (
          <button
            key={group.id}
            onClick={() => {
              if (onSelectGroup) onSelectGroup(group.id);
              onGoToLobby();
            }}
            className={`relative group w-12 h-12 flex items-center justify-center font-bold text-xs transition-all duration-200 overflow-hidden ${
              isSelected
                ? 'rounded-2xl bg-discord-accent text-white ring-2 ring-discord-accent ring-offset-2 ring-offset-discord-sidebar shadow-md'
                : 'rounded-full bg-[#232428] text-discord-textNormal hover:rounded-2xl hover:bg-discord-accent hover:text-white'
            }`}
            title={`Grupo: ${group.name}`}
          >
            {group.avatarUrl ? (
              <img src={group.avatarUrl} alt={group.name} className="w-full h-full object-cover" />
            ) : (
              group.name.substring(0, 2).toUpperCase()
            )}

            {/* Discord Active Pill */}
            <span
              className={`absolute left-0 w-1 bg-white rounded-r transition-all duration-200 ${
                isSelected ? 'h-10' : 'h-2 scale-0 group-hover:scale-100 group-hover:h-5'
              }`}
            />
          </button>
        );
      })}

      {/* Add New Group Button */}
      {onOpenCreateGroupModal && (
        <button
          onClick={onOpenCreateGroupModal}
          className="w-12 h-12 rounded-full bg-discord-channelList text-discord-green hover:rounded-2xl hover:bg-discord-green hover:text-white flex items-center justify-center transition-all duration-200 group"
          title="Criar Novo Grupo / Servidor"
        >
          <Plus size={22} />
        </button>
      )}

      {/* Bottom Settings Button */}
      <div className="mt-auto flex flex-col items-center gap-2 pt-2">
        <button
          onClick={onOpenSettings}
          className="w-12 h-12 rounded-full bg-discord-channelList text-discord-textMuted hover:rounded-2xl hover:bg-[#35373c] hover:text-white flex items-center justify-center transition-all duration-200"
          title="Configurações & Diagnóstico"
        >
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
};
