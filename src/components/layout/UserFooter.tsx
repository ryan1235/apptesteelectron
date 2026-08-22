import React from 'react';
import { Mic, MicOff, Headphones, Settings, UserCheck } from 'lucide-react';

interface UserFooterProps {
  userName: string;
  avatarUrl?: string;
  isMicMuted: boolean;
  isDeafened: boolean;
  isSpeaking: boolean;
  activity?: string;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onOpenSettings: () => void;
  onOpenLogin?: () => void;
  onToggleOverlay?: () => void;
}

export const UserFooter: React.FC<UserFooterProps> = ({
  userName,
  avatarUrl,
  isMicMuted,
  isDeafened,
  isSpeaking,
  activity,
  onToggleMic,
  onToggleDeafen,
  onOpenSettings,
  onOpenLogin,
  onToggleOverlay,
}) => {
  return (
    <div className="h-[52px] bg-[#232428] px-2 flex items-center justify-between select-none border-t border-[#1f2023]">
      {/* User Profile Info */}
      <div
        onClick={onOpenLogin}
        className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-[#2e3035] cursor-pointer flex-1 min-w-0 transition-colors group"
        title="Clique para editar nome e avatar"
      >
        <div className="relative">
          <div
            className={`w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center font-bold text-white text-xs overflow-hidden ${
              isSpeaking && !isMicMuted ? 'speaking-glow' : ''
            }`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName || ''} className="w-full h-full object-cover" />
            ) : (
              (userName || 'Você').substring(0, 2).toUpperCase()
            )}
          </div>
          {/* Status Dot */}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-discord-green border-2 border-[#232428]" />
        </div>

        <div className="flex flex-col min-w-0 leading-tight">
          <span className="text-xs font-semibold text-discord-textHeader truncate group-hover:text-white">
            {userName}
          </span>
          <span className="text-[10px] text-discord-green truncate font-medium">
            {activity || '#Online'}
          </span>
        </div>
      </div>

      {/* Action Buttons: Mic, Deafen, Settings */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={onToggleMic}
          className={`p-1.5 rounded hover:bg-[#35373c] transition-colors ${
            isMicMuted ? 'text-discord-red hover:text-discord-red' : 'text-discord-textMuted hover:text-discord-textNormal'
          }`}
          title={isMicMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
        >
          {isMicMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          onClick={onToggleDeafen}
          className={`p-1.5 rounded hover:bg-[#35373c] transition-colors ${
            isDeafened ? 'text-discord-red hover:text-discord-red' : 'text-discord-textMuted hover:text-discord-textNormal'
          }`}
          title={isDeafened ? 'Desativar Ensurdecer' : 'Ensurdecer'}
        >
          <Headphones size={18} />
        </button>

        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded hover:bg-[#35373c] text-discord-textMuted hover:text-discord-textNormal transition-colors"
          title="Configurações de Usuário"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
};
