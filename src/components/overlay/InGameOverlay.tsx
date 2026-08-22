import React, { useState, useEffect } from 'react';
import {
  MicOff,
  VolumeX,
  Lock,
  Unlock,
  Gamepad2,
} from 'lucide-react';
import { OverlayState, OverlayParticipant, OverlayRecentMessage } from '../../types/live-room';

export const InGameOverlay: React.FC = () => {
  const [state, setState] = useState<OverlayState>({
    activeRoomTitle: undefined,
    participants: [],
    recentMessages: [],
    isLocked: true,
    detectedGame: undefined,
    myMicOn: true,
    myDeafened: false,
  });

  const [isInteractive, setIsInteractive] = useState<boolean>(false);

  useEffect(() => {
    if (window.electronAPI?.onOverlayStateUpdated) {
      const unsubState = window.electronAPI.onOverlayStateUpdated((newState) => {
        setState((prev) => ({
          ...prev,
          ...newState,
        }));
      });

      const unsubGame = window.electronAPI.onGameActivityDetected?.((game) => {
        setState((prev) => ({
          ...prev,
          detectedGame: game || undefined,
        }));
      });

      return () => {
        unsubState?.();
        unsubGame?.();
      };
    }
  }, []);

  const toggleInteractive = () => {
    const nextInteractive = !isInteractive;
    setIsInteractive(nextInteractive);
    if (window.electronAPI?.setOverlayIgnoreMouse) {
      window.electronAPI.setOverlayIgnoreMouse(!nextInteractive);
    }
  };

  // Only show recent messages from the last 4.5 seconds
  const now = Date.now();
  const visibleMessages = state.recentMessages.filter(
    (msg) => now - msg.timestamp < 4500
  );

  return (
    <div
      className={`w-full h-full p-2 font-sans select-none flex flex-col justify-between transition-all duration-300 pointer-events-none ${
        isInteractive
          ? 'bg-black/40 backdrop-blur-sm ring-1 ring-discord-accent/40 rounded-xl pointer-events-auto'
          : 'bg-transparent'
      }`}
    >
      {/* Top Header: Ultra-Discreet Game / Room Pill */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 shadow-sm text-[10px] text-white/90">
          <span className="w-1.5 h-1.5 rounded-full bg-discord-green flex-shrink-0 animate-pulse" />
          <span className="truncate max-w-[130px] font-medium">
            {state.detectedGame || state.activeRoomTitle || 'Discord'}
          </span>
        </div>

        {/* Lock / Interactive Mode Toggle */}
        <button
          onClick={toggleInteractive}
          className={`p-1 rounded-full transition-colors pointer-events-auto backdrop-blur-md ${
            isInteractive
              ? 'bg-discord-accent text-white shadow'
              : 'text-white/40 hover:text-white/90 bg-black/30 border border-white/5'
          }`}
          title={isInteractive ? 'Bloquear para o jogo (Click-Through)' : 'Desbloquear (Interativo)'}
        >
          {isInteractive ? <Unlock size={10} /> : <Lock size={10} />}
        </button>
      </div>

      {/* Voice Avatars HUD: Discreet floating circles on the left */}
      <div className="my-2 space-y-1.5 overflow-hidden">
        {state.participants.map((p) => {
          const isSpeaking = p.isSpeaking;

          return (
            <div
              key={p.id}
              className={`flex items-center gap-2 transition-all duration-150 ${
                isSpeaking ? 'opacity-100 scale-105 translate-x-1' : 'opacity-40 hover:opacity-80'
              }`}
            >
              {/* Circular Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className={`w-7 h-7 rounded-full bg-[#2b2d31] flex items-center justify-center font-bold text-white text-[10px] overflow-hidden transition-all duration-150 ${
                    isSpeaking
                      ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-black/60 shadow-[0_0_10px_rgba(52,211,153,0.9)]'
                      : 'ring-1 ring-white/15'
                  }`}
                >
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    (p.name || 'U').substring(0, 2).toUpperCase()
                  )}
                </div>

                {/* Status Badges */}
                {!p.micOn && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-600 flex items-center justify-center text-white ring-1 ring-black">
                    <MicOff size={7} />
                  </div>
                )}
                {p.isDeafened && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-600 flex items-center justify-center text-white ring-1 ring-black">
                    <VolumeX size={7} />
                  </div>
                )}
              </div>

              {/* Discreet Name Pill (Only highlights when speaking) */}
              <div
                className={`px-2 py-0.5 rounded-md backdrop-blur-md text-[11px] font-semibold truncate max-w-[150px] transition-colors ${
                  isSpeaking
                    ? 'bg-black/60 text-white border border-emerald-500/40 shadow-sm font-bold'
                    : 'bg-black/30 text-white/70 border border-white/5'
                }`}
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
              >
                {p.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom: Mini Chat Notifications (Discreet auto-fading glass pill) */}
      <div className="space-y-1.5 mt-auto">
        {visibleMessages.map((msg) => (
          <div
            key={msg.id}
            className="flex items-start gap-1.5 px-2 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 shadow-lg text-[11px] animate-fade-in text-white/90"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
          >
            <span className="font-bold text-discord-accent flex-shrink-0">
              {msg.userName}:
            </span>
            <span className="text-gray-200 break-words leading-tight flex-1">
              {msg.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
