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
    <div className="h-18 bg-[#1e1f22]/95 backdrop-blur-md px-6 py-3 flex items-center justify-between border-t border-[#27292d] select-none z-30 shadow-2xl">
      {/* Left Info / Profile Selector */}
      <div className="relative flex items-center gap-2">
        <button
          onClick={() => setShowProfileMenu(!showProfileMenu)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#2b2d31]/80 hover:bg-[#35373c] border border-[#383a40] text-discord-textHeader text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
          title="Alterar Resolução / Qualidade WebCodecs GPU"
        >
          <Sparkles size={14} className="text-discord-yellow animate-pulse" />
          <span>{QUALITY_PROFILES[activeProfile].label.split('(')[0]}</span>
          <ChevronUp size={14} className={`text-discord-textMuted transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`} />
        </button>

        {showProfileMenu && (
          <div className="absolute bottom-14 left-0 w-72 bg-[#111214]/95 rounded-2xl shadow-2xl border border-discord-border p-2 space-y-1 z-50 animate-fade-in text-xs backdrop-blur-xl">
            <div className="text-[10px] font-bold uppercase tracking-wider text-discord-textMuted px-2.5 py-1.5 border-b border-[#1f2023]">
              Perfis de Transmissão (WebCodecs)
            </div>
            {Object.values(QUALITY_PROFILES).map((prof) => (
              <button
                key={prof.name}
                onClick={() => {
                  onChangeProfile(prof.name);
                  setShowProfileMenu(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                  activeProfile === prof.name
                    ? 'bg-discord-accent text-white font-semibold shadow-md shadow-discord-accent/20'
                    : 'text-discord-textNormal hover:bg-[#2b2d31] hover:text-white'
                }`}
              >
                <div className="font-semibold flex items-center justify-between">
                  <span>{prof.label}</span>
                  <span className="text-[10px] font-mono opacity-70">{prof.fps} FPS</span>
                </div>
                <div className="text-[10px] text-discord-textMuted leading-tight mt-0.5 opacity-90">
                  {prof.description}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center Voice & Video Controls (Discord Pill Bar) */}
      <div className="flex items-center gap-3 bg-[#111214]/60 p-1.5 rounded-2xl border border-[#2b2d31] shadow-inner">
        {/* Toggle Mic */}
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-xl transition-all duration-200 shadow-md hover:scale-105 active:scale-95 ${
            isMicMuted
              ? 'bg-discord-red text-white hover:bg-discord-red/90 shadow-discord-red/20'
              : 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
          }`}
          title={isMicMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
        >
          {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Toggle Deafen */}
        <button
          onClick={onToggleDeafen}
          className={`p-3 rounded-xl transition-all duration-200 shadow-md hover:scale-105 active:scale-95 ${
            isDeafened
              ? 'bg-discord-red text-white hover:bg-discord-red/90 shadow-discord-red/20'
              : 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
          }`}
          title={isDeafened ? 'Desativar Ensurdecer' : 'Ensurdecer Chamada'}
        >
          <Headphones size={20} />
        </button>

        {/* Toggle Screen Share */}
        <button
          onClick={onToggleScreenShare}
          className={`p-3 rounded-xl transition-all duration-200 shadow-md hover:scale-105 active:scale-95 ${
            isScreenSharing
              ? 'bg-discord-green text-white hover:bg-discord-green/90 shadow-lg shadow-discord-green/30 animate-pulse'
              : 'bg-[#2b2d31] text-white hover:bg-[#35373c]'
          }`}
          title={isScreenSharing ? 'Parar Compartilhamento' : 'Compartilhar Tela (WebCodecs GPU)'}
        >
          {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
        </button>

        {/* Disconnect Room Button */}
        <button
          onClick={onLeaveRoom}
          className="p-3 rounded-xl bg-discord-red text-white hover:bg-discord-red/90 shadow-lg shadow-discord-red/30 transition-all duration-200 hover:scale-105 active:scale-95 ml-1"
          title="Sair da Sala"
        >
          <PhoneOff size={20} />
        </button>
      </div>

      {/* Right Side Chat Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleChat}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm border ${
            isChatOpen
              ? 'bg-discord-accent text-white border-discord-accent shadow-discord-accent/20'
              : 'bg-[#2b2d31]/80 text-discord-textNormal border-[#383a40] hover:bg-[#35373c] hover:text-white'
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
