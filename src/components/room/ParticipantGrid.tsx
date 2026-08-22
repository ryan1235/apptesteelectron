import React, { useState } from 'react';
import { Mic, MicOff, Monitor, Volume2, Crown, Sliders, User } from 'lucide-react';
import { Participant } from '../../types/live-room';

interface ParticipantGridProps {
  participants: Participant[];
  currentUserId: string;
  onSetUserVolume: (userId: string, volume: number) => void;
  compact?: boolean;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
  currentUserId,
  onSetUserVolume,
  compact = false,
}) => {
  const [activeVolumePopup, setActiveVolumePopup] = useState<string | null>(null);

  // Determine optimal responsive grid columns based on participant count
  const count = participants.length;

  let gridClasses = 'grid gap-4 w-full justify-center items-center';
  let cardClasses = 'relative rounded-2xl flex flex-col items-center justify-center transition-all duration-200 overflow-hidden group shadow-lg';
  let avatarSize = 'w-24 h-24 text-2xl';

  if (compact) {
    // Mini strip under screen share
    gridClasses = 'flex items-center gap-3 w-full h-full';
    cardClasses = 'relative rounded-xl w-32 h-24 flex-shrink-0 bg-[#2b2d31] border border-[#383a40] flex flex-col items-center justify-center';
    avatarSize = 'w-10 h-10 text-xs';
  } else {
    if (count <= 1) {
      gridClasses += ' grid-cols-1 max-w-md mx-auto';
      cardClasses += ' h-72 aspect-video bg-gradient-to-b from-[#2b2d31] to-[#1e1f22] border border-[#383a40]';
      avatarSize = 'w-28 h-28 text-3xl';
    } else if (count === 2) {
      gridClasses += ' grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto';
      cardClasses += ' h-64 aspect-video bg-gradient-to-b from-[#2b2d31] to-[#1e1f22] border border-[#383a40]';
      avatarSize = 'w-24 h-24 text-2xl';
    } else if (count <= 4) {
      gridClasses += ' grid-cols-2 max-w-4xl mx-auto';
      cardClasses += ' h-56 bg-gradient-to-b from-[#2b2d31] to-[#1e1f22] border border-[#383a40]';
      avatarSize = 'w-20 h-20 text-xl';
    } else if (count <= 6) {
      gridClasses += ' grid-cols-2 sm:grid-cols-3 max-w-5xl mx-auto';
      cardClasses += ' h-48 bg-[#2b2d31] border border-[#383a40]';
      avatarSize = 'w-16 h-16 text-lg';
    } else {
      gridClasses += ' grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-w-6xl mx-auto';
      cardClasses += ' h-44 bg-[#2b2d31] border border-[#383a40]';
      avatarSize = 'w-14 h-14 text-base';
    }
  }

  return (
    <div className={`w-full flex items-center justify-center ${compact ? 'h-full' : 'p-6 flex-1'}`}>
      <div className={gridClasses}>
        {participants.map((p) => {
          const isMe = p.id === currentUserId;
          const userVolume = p.volume ?? 100;
          const isSpeakingNow = p.isSpeaking && p.micOn;

          return (
            <div
              key={p.id}
              className={`${cardClasses} ${
                isSpeakingNow
                  ? 'ring-2 ring-discord-green border-discord-green shadow-xl shadow-discord-green/20'
                  : 'hover:border-[#4e5058]'
              }`}
            >
              {/* Top Badges (Host, Screen Share, Volume) */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
                <div className="flex items-center gap-1.5">
                  {p.isHost && (
                    <span className="flex items-center gap-1 text-discord-yellow text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm shadow">
                      <Crown size={11} />
                      <span>Host</span>
                    </span>
                  )}
                  {p.isScreenSharing && (
                    <span className="flex items-center gap-1 text-discord-accent text-[10px] font-bold px-2 py-0.5 rounded-full bg-discord-accent/20 border border-discord-accent/40 backdrop-blur-sm shadow animate-pulse">
                      <Monitor size={11} />
                      <span>Ao Vivo</span>
                    </span>
                  )}
                </div>

                {!isMe && !compact && (
                  <button
                    onClick={() =>
                      setActiveVolumePopup(activeVolumePopup === p.id ? null : p.id)
                    }
                    className="p-1.5 rounded-lg bg-black/50 hover:bg-black/80 text-discord-textMuted hover:text-white transition-all pointer-events-auto backdrop-blur-sm"
                    title="Ajustar Volume do Usuário"
                  >
                    <Volume2 size={13} />
                  </button>
                )}
              </div>

              {/* Center Avatar with Speaking Glow */}
              <div className="relative flex items-center justify-center">
                <div
                  className={`${avatarSize} rounded-full flex items-center justify-center font-bold text-white overflow-hidden transition-all duration-200 shadow-xl ${
                    isSpeakingNow
                      ? 'ring-4 ring-discord-green ring-offset-4 ring-offset-[#1e1f22] scale-105'
                      : 'bg-[#5865F2]'
                  }`}
                >
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    (p.name || 'U').substring(0, 2).toUpperCase()
                  )}
                </div>
              </div>

              {/* Bottom Name & Mic Pill (Discord Style Overlay) */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-semibold max-w-[85%] shadow-sm">
                  {p.micOn ? (
                    <Mic size={12} className={isSpeakingNow ? 'text-discord-green' : 'text-discord-textMuted'} />
                  ) : (
                    <MicOff size={12} className="text-discord-red" />
                  )}
                  <span className="truncate">
                    {p.name} {isMe && <span className="text-discord-textMuted font-normal">(Você)</span>}
                  </span>
                </div>
              </div>

              {/* Volume Slider Popup */}
              {activeVolumePopup === p.id && (
                <div className="absolute top-12 right-3 z-30 bg-[#111214]/95 p-3 rounded-xl shadow-2xl border border-discord-border w-48 animate-fade-in text-xs backdrop-blur-xl pointer-events-auto">
                  <div className="flex items-center justify-between mb-1.5 font-bold text-discord-textHeader">
                    <span className="truncate pr-1">Volume de {p.name}</span>
                    <span className="text-discord-green font-mono">{userVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    value={userVolume}
                    onChange={(e) => onSetUserVolume(p.id, Number(e.target.value))}
                    className="w-full accent-discord-accent bg-[#2b2d31] rounded-lg cursor-pointer h-1.5"
                  />
                  <div className="flex justify-between text-[10px] text-discord-textMuted mt-1 font-mono">
                    <span>0%</span>
                    <span>100%</span>
                    <span>200%</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
