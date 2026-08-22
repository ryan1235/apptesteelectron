import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Headphones,
  Monitor,
  MonitorOff,
  PhoneOff,
  Sparkles,
  MessageSquare,
  ChevronUp,
} from 'lucide-react';
import { QualityProfile, QUALITY_PROFILES } from '../../types/live-room';

interface ControlsBarProps {
  isMicMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  activeProfile: QualityProfile;
  isChatOpen: boolean;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onChangeProfile: (profile: QualityProfile) => void;
  onToggleChat: () => void;
  onLeaveRoom: () => void;
}

export const ControlsBar: React.FC<ControlsBarProps> = ({
  isMicMuted,
  isDeafened,
  isScreenSharing,
  activeProfile,
  isChatOpen,
  onToggleMic,
  onToggleDeafen,
  onToggleScreenShare,
  onChangeProfile,
  onToggleChat,
  onLeaveRoom,
}) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <div className="h-16 bg-[#1e1f22] px-6 flex items-center justify-between border-t border-[#1f2023] select-none z-30">
      {/* Left Info / Profile Selector */}
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-discord-textHeader text-xs font-semibold transition-colors"
          title="Alterar Resolução / Qualidade WebCodecs GPU"
        >
          <Sparkles size={14} className="text-discord-yellow" />
          <span>{QUALITY_PROFILES[activeProfile].label.split('(')[0]}</span>
          <ChevronUp size={14} className={`text-discord-textMuted transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
        </button>

        {showProfileMenu && (
          <div className="absolute bottom-12 left-0 w-64 bg-[#111214] rounded-lg shadow-2xl border border-discord-border p-2 space-y-1 z-50 animate-fade-in text-xs">
            <div className="text-[10px] font-bold uppercase text-discord-textMuted px-2 py-1">
              Perfis de Transmissão (WebCodecs)
            </div>
            {Object.values(QUALITY_PROFILES).map((prof) => (
              <button
                key={prof.name}
                onClick={() => {
                  onChangeProfile(prof.name);
                  setShowProfileMenu(false);
                }}
                className={`w-full text-left px-2.5 py-2 rounded-md transition-colors ${
                  activeProfile === prof.name
                    ? 'bg-discord-accent text-white font-medium'
                    : 'text-discord-textNormal hover:bg-[#2b2d31]'
                }`}
              >
                <div className="font-semibold">{prof.label}</div>
                <div className="text-[10px] text-discord-textMuted leading-tight mt-0.5">
                  {prof.description}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center Voice & Video Controls */}
      <div className="flex items-center gap-3">
        {/* Toggle Mic */}
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-full transition-all duration-150 ${
            isMicMuted
              ? 'bg-discord-red text-white hover:bg-discord-red/90'
              : 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
          }`}
          title={isMicMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
        >
          {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Toggle Deafen */}
        <button
          onClick={onToggleDeafen}
          className={`p-3 rounded-full transition-all duration-150 ${
            isDeafened
              ? 'bg-discord-red text-white hover:bg-discord-red/90'
              : 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
          }`}
          title={isDeafened ? 'Desativar Ensurdecer' : 'Ensurdecer Chamada'}
        >
          <Headphones size={20} />
        </button>

        {/* Toggle Screen Share */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3 rounded-full transition-all duration-150 ${
            isScreenSharing
              ? 'bg-discord-green text-white hover:bg-discord-green/90 animate-pulse'
              : 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
          }`}
          title={isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela (WebCodecs GPU)'}
        >
          {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
        </button>

        {/* Disconnect Room Button */}
        <button
          onClick={onLeaveRoom}
          className="p-3 rounded-full bg-discord-red text-white hover:bg-discord-red/90 transition-all duration-150 ml-2"
          title="Sair da Sala"
        >
          <PhoneOff size={20} />
        </button>
      </div>

      {/* Right Side Chat Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            isChatOpen
              ? 'bg-discord-accent text-white'
              : 'bg-[#2b2d31] text-discord-textNormal hover:bg-[#35373c]'
          }`}
          title="Alternar Chat Lateral"
        >
          <MessageSquare size={16} />
          <span>Chat</span>
        </button>
      </div>
    </div>
  );
};
