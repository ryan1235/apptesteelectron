import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  VolumeX,
  Lock,
  Unlock,
  Gamepad2,
  Volume2,
  Sparkles,
  MessageSquare,
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

  // Only show recent messages from the last 6 seconds
  const now = Date.now();
  const visibleMessages = state.recentMessages.filter(
    (msg) => now - msg.timestamp < 6000
  );

  return (
    <div
      className={`w-full h-full p-3 font-sans select-none flex flex-col justify-between transition-all duration-200 ${
        isInteractive ? 'bg-black/60 backdrop-blur-md ring-1 ring-discord-accent/50 rounded-2xl' : 'bg-transparent'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 bg-black/75 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2.5 h-2.5 rounded-full bg-discord-green animate-pulse flex-shrink-0" />
          <span className="text-xs font-bold text-white truncate">
            {state.activeRoomTitle ? `# ${state.activeRoomTitle}` : 'Discord Live Overlay'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {state.detectedGame && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-discord-green bg-discord-green/15 px-2 py-0.5 rounded-full border border-discord-green/30">
              <Gamepad2 size={11} />
              <span className="truncate max-w-[90px]">{state.detectedGame}</span>
            </div>
          )}

          {/* Interactive / Click-Through Mode Toggle */}
          <button
            onClick={toggleInteractive}
            className={`p-1 rounded-lg transition-colors pointer-events-auto ${
              isInteractive
                ? 'bg-discord-accent text-white shadow-lg'
                : 'text-discord-textMuted hover:text-white bg-white/5'
            }`}
            title={isInteractive ? 'Bloquear para o jogo (Click-Through)' : 'Desbloquear Overlay (Interativo)'}
          >
            {isInteractive ? <Unlock size={12} /> : <Lock size={12} />}
          </button>
        </div>
      </div>

      {/* Center / Left: Floating Voice Avatars HUD */}
      <div className="my-2 space-y-1.5 overflow-y-auto max-h-[300px] pr-1">
        {state.participants.length === 0 ? (
          <div className="p-2 bg-black/40 backdrop-blur-sm rounded-xl text-[11px] text-discord-textMuted text-center border border-white/5">
            Entre em uma sala para ver os avatares aqui no jogo!
          </div>
        ) : (
          state.participants.map((p) => {
            const isSpeaking = p.isSpeaking;

            return (
              <div
                key={p.id}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-150 backdrop-blur-md shadow-lg ${
                  isSpeaking
                    ? 'bg-discord-green/20 border border-discord-green/60 translate-x-1'
                    : 'bg-black/50 border border-white/5'
                }`}
              >
                {/* Avatar with speaking halo */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full bg-[#35373c] flex items-center justify-center font-bold text-white text-[11px] overflow-hidden transition-all ${
                      isSpeaking
                        ? 'ring-2 ring-discord-green ring-offset-1 ring-offset-black scale-105 shadow-[0_0_12px_rgba(35,165,90,0.8)]'
                        : 'ring-1 ring-white/10 opacity-80'
                    }`}
                  >
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      (p.name || 'U').substring(0, 2).toUpperCase()
                    )}
                  </div>

                  {/* Status Indicator */}
                  {!p.micOn && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-discord-red flex items-center justify-center text-white ring-1 ring-black">
                      <MicOff size={8} />
                    </div>
                  )}
                  {p.isDeafened && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-discord-red flex items-center justify-center text-white ring-1 ring-black">
                      <VolumeX size={8} />
                    </div>
                  )}
                </div>

                {/* Name & Game Tag */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-bold truncate transition-colors ${
                        isSpeaking ? 'text-white font-extrabold' : 'text-[#dbdee1]'
                      }`}
                    >
                      {p.name}
                    </span>
                    {isSpeaking && (
                      <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-ping" />
                    )}
                  </div>
                  {p.activity && (
                    <span className="text-[9px] text-discord-textMuted truncate block">
                      {p.activity}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom: Mini Chat Popup HUD (Auto-fade after 5s) */}
      <div className="space-y-1.5 mt-auto">
        {visibleMessages.map((msg) => (
          <div
            key={msg.id}
            className="flex items-start gap-2 p-2 bg-black/85 backdrop-blur-md rounded-xl border border-white/15 shadow-2xl animate-fade-in text-xs"
          >
            <div className="w-6 h-6 rounded-full bg-discord-accent/30 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5">
              {msg.avatarUrl ? (
                <img src={msg.avatarUrl} alt={msg.userName} className="w-full h-full object-cover rounded-full" />
              ) : (
                msg.userName.substring(0, 1).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-white text-[11px] block">{msg.userName}</span>
              <p className="text-gray-200 text-xs break-words leading-tight">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Global Hotkey Hint Footer */}
        <div className="flex items-center justify-between text-[10px] text-discord-textMuted px-1 font-mono pt-1">
          <span>Ctrl+Shift+M: Mute</span>
          <span>Ctrl+Shift+O: Overlay</span>
        </div>
      </div>
    </div>
  );
};
