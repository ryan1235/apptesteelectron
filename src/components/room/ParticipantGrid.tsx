import React, { useState } from 'react';
import { Mic, MicOff, Monitor, Volume2, Crown, Sliders } from 'lucide-react';
import { Participant } from '../../types/live-room';

interface ParticipantGridProps {
  participants: Participant[];
  currentUserId: string;
  onSetUserVolume: (userId: string, volume: number) => void;
}

export const ParticipantGrid: React.FC<ParticipantGridProps> = ({
  participants,
  currentUserId,
  onSetUserVolume,
}) => {
  const [activeVolumePopup, setActiveVolumePopup] = useState<string | null>(null);

  return (
    <div className="p-4 overflow-y-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {participants.map((p) => {
          const isMe = p.id === currentUserId;
          const userVolume = p.volume ?? 100;

          return (
            <div
              key={p.id}
              className={`relative bg-[#232428] rounded-xl p-3 flex flex-col items-center justify-between min-h-[140px] border transition-all duration-150 group ${
                p.isSpeaking && p.micOn
                  ? 'speaking-glow border-discord-green bg-[#2b2d31]'
                  : 'border-transparent hover:border-[#35373c]'
              }`}
            >
              {/* Top Icons Bar: Host / Screen share / Volume settings */}
              <div className="w-full flex items-center justify-between text-discord-textMuted text-xs">
                <div>
                  {p.isHost && (
                    <span className="flex items-center gap-1 text-discord-yellow text-[10px] font-bold">
                      <Crown size={12} />
                      <span>Host</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {p.isScreenSharing && (
                    <span className="p-1 rounded bg-discord-accent/20 text-discord-accent" title="Transmitindo Tela">
                      <Monitor size={12} />
                    </span>
                  )}

                  {!isMe && (
                    <button
                      onClick={() =>
                        setActiveVolumePopup(activeVolumePopup === p.id ? null : p.id)
                      }
                      className="p-1 rounded hover:bg-[#35373c] text-discord-textMuted hover:text-white transition-colors"
                      title="Ajustar Volume Individual"
                    >
                      <Volume2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Center Avatar with Speaking Glow */}
              <div className="relative my-2">
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-white text-base overflow-hidden transition-all duration-150 ${
                    p.isSpeaking && p.micOn
                      ? 'speaking-glow ring-4 ring-discord-green/30'
                      : 'bg-discord-accent'
                  }`}
                >
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    p.name.substring(0, 2).toUpperCase()
                  )}
                </div>

                {/* Mic Muted Badge */}
                {!p.micOn && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-discord-red text-white flex items-center justify-center shadow">
                    <MicOff size={11} />
                  </div>
                )}
              </div>

              {/* Bottom Username */}
              <div className="w-full text-center truncate">
                <span className="text-xs font-semibold text-discord-textHeader truncate block">
                  {p.name} {isMe && '(Você)'}
                </span>
              </div>

              {/* Individual Volume Slider Popup */}
              {activeVolumePopup === p.id && (
                <div className="absolute top-10 right-2 z-20 bg-[#111214] p-3 rounded-lg shadow-2xl border border-discord-border w-44 animate-fade-in text-xs">
                  <div className="flex items-center justify-between mb-1.5 font-bold text-discord-textHeader">
                    <span>Volume de {p.name}</span>
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
                  <div className="flex justify-between text-[10px] text-discord-textMuted mt-1">
                    <span>Mudo (0%)</span>
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
