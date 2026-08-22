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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        {participants.map((p) => {
          const isMe = p.id === currentUserId;
          const userVolume = p.volume ?? 100;
          const isSpeakingNow = p.isSpeaking && p.micOn;

          return (
            <div
              key={p.id}
              className={`relative rounded-2xl p-3 flex flex-col items-center justify-between min-h-[150px] transition-all duration-200 group backdrop-blur-md ${
                isSpeakingNow
                  ? 'bg-gradient-to-b from-[#2b2d31] to-[#1e1f22] border-2 border-discord-green shadow-lg shadow-discord-green/20 scale-[1.02]'
                  : 'bg-[#232428]/90 hover:bg-[#2b2d31] border border-[#313338] hover:border-[#3f4147]'
              }`}
            >
              {/* Top Icons Bar: Host / Screen share / Volume settings */}
              <div className="w-full flex items-center justify-between text-discord-textMuted text-xs">
                <div>
                  {p.isHost && (
                    <span className="flex items-center gap-1 text-discord-yellow text-[10px] font-bold px-1.5 py-0.5 rounded bg-discord-yellow/10">
                      <Crown size={11} />
                      <span>Host</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {p.isScreenSharing && (
                    <span className="p-1 rounded-md bg-discord-accent/20 text-discord-accent shadow-sm animate-pulse" title="Transmitindo Tela (GPU)">
                      <Monitor size={12} />
                    </span>
                  )}

                  {!isMe && (
                    <button
                      onClick={() =>
                        setActiveVolumePopup(activeVolumePopup === p.id ? null : p.id)
                      }
                      className="p-1 rounded-md hover:bg-[#35373c] text-discord-textMuted hover:text-white transition-colors"
                      title="Ajustar Volume Individual"
                    >
                      <Volume2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Center Avatar with Speaking Glow & Animated Audio Bars */}
              <div className="relative my-2 flex flex-col items-center">
                <div
                  className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-white text-lg overflow-hidden transition-all duration-200 ${
                    isSpeakingNow
                      ? 'ring-4 ring-discord-green ring-offset-2 ring-offset-[#232428] shadow-xl shadow-discord-green/30'
                      : 'bg-discord-accent shadow-md'
                  }`}
                >
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.name || ''} className="w-full h-full object-cover" />
                  ) : (
                    (p.name || 'U').substring(0, 2).toUpperCase()
                  )}
                </div>

                {/* Animated Equalizer Wave Bars When Speaking */}
                {isSpeakingNow && (
                  <div className="flex items-center gap-0.5 mt-1.5 h-3">
                    <span className="w-1 bg-discord-green rounded-full animate-bounce [animation-delay:0ms] h-2.5" />
                    <span className="w-1 bg-discord-green rounded-full animate-bounce [animation-delay:150ms] h-3.5" />
                    <span className="w-1 bg-discord-green rounded-full animate-bounce [animation-delay:300ms] h-2" />
                    <span className="w-1 bg-discord-green rounded-full animate-bounce [animation-delay:75ms] h-3" />
                  </div>
                )}

                {/* Mic Muted Badge */}
                {!p.micOn && (
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-discord-red text-white flex items-center justify-center shadow-lg border border-[#232428]">
                    <MicOff size={11} />
                  </div>
                )}
              </div>

              {/* Bottom Username */}
              <div className="w-full text-center truncate pt-1">
                <span className="text-xs font-semibold text-discord-textHeader truncate block group-hover:text-white transition-colors">
                  {p.name} {isMe && <span className="text-discord-textMuted font-normal">(Você)</span>}
                </span>
              </div>

              {/* Individual Volume Slider Popup */}
              {activeVolumePopup === p.id && (
                <div className="absolute top-10 right-2 z-30 bg-[#111214] p-3 rounded-xl shadow-2xl border border-discord-border w-48 animate-fade-in text-xs backdrop-blur-xl">
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
