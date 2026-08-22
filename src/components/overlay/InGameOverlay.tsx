import React, { useState, useEffect, useRef } from 'react';
import {
  MicOff,
  VolumeX,
  Lock,
  Unlock,
  Gamepad2,
  Monitor,
  Volume2,
  X,
  Sliders,
  Sparkles,
  Move,
  Eye,
  Check,
} from 'lucide-react';
import {
  OverlayState,
  OverlayParticipant,
  OverlayRecentMessage,
  OverlayWidgetCorner,
  OverlayPipSize,
  OverlayVoiceMode,
} from '../../types/live-room';

export const InGameOverlay: React.FC = () => {
  const [state, setState] = useState<OverlayState>({
    activeRoomTitle: undefined,
    participants: [],
    recentMessages: [],
    isLocked: true,
    detectedGame: undefined,
    myMicOn: true,
    myDeafened: false,
    activePresenter: null,
    voicePosition: 'top-left',
    pipPosition: 'top-right',
    chatPosition: 'bottom-left',
    pipSize: 'medium',
    pipOpacity: 90,
    voiceMode: 'speaking_only',
    showPip: true,
  });

  const [isInteractive, setIsInteractive] = useState<boolean>(false);
  const [hasFrame, setHasFrame] = useState<boolean>(false);
  const pipImgRef = useRef<HTMLImageElement>(null);

  // Load saved preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('discord_in_game_overlay_prefs_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch (e) {}
  }, []);

  // IPC Event Listeners
  useEffect(() => {
    if (window.electronAPI) {
      const unsubState = window.electronAPI.onOverlayStateUpdated?.((newState) => {
        setState((prev) => ({
          ...prev,
          ...newState,
          // Preserve local position customizations if already customized
          voicePosition: prev.voicePosition || newState.voicePosition || 'top-left',
          pipPosition: prev.pipPosition || newState.pipPosition || 'top-right',
          chatPosition: prev.chatPosition || newState.chatPosition || 'bottom-left',
          pipSize: prev.pipSize || newState.pipSize || 'medium',
          pipOpacity: prev.pipOpacity ?? newState.pipOpacity ?? 90,
          voiceMode: prev.voiceMode || newState.voiceMode || 'speaking_only',
          showPip: prev.showPip ?? newState.showPip ?? true,
        }));
      });

      const unsubGame = window.electronAPI.onGameActivityDetected?.((game) => {
        setState((prev) => ({
          ...prev,
          detectedGame: game || undefined,
        }));
      });

      const unsubFrame = window.electronAPI.onOverlayVideoFrame?.((frameData) => {
        if (pipImgRef.current) {
          pipImgRef.current.src = frameData;
        }
        setHasFrame(true);
      });

      const unsubShortOverlay = window.electronAPI.onGlobalToggleOverlay?.(() => {
        toggleInteractive();
      });

      return () => {
        unsubState?.();
        unsubGame?.();
        unsubFrame?.();
        unsubShortOverlay?.();
      };
    }
  }, [isInteractive]);

  const toggleInteractive = () => {
    const nextInteractive = !isInteractive;
    setIsInteractive(nextInteractive);
    if (window.electronAPI?.setOverlayIgnoreMouse) {
      window.electronAPI.setOverlayIgnoreMouse(!nextInteractive);
    }
  };

  const updatePreference = (updates: Partial<OverlayState>) => {
    setState((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(
          'discord_in_game_overlay_prefs_v1',
          JSON.stringify({
            voicePosition: next.voicePosition,
            pipPosition: next.pipPosition,
            chatPosition: next.chatPosition,
            pipSize: next.pipSize,
            pipOpacity: next.pipOpacity,
            voiceMode: next.voiceMode,
            showPip: next.showPip,
          })
        );
        window.electronAPI?.saveOverlayConfig?.(updates);
      } catch (e) {}
      return next;
    });
  };

  // Helper for corner styles
  const getCornerClasses = (corner: OverlayWidgetCorner) => {
    switch (corner) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4 items-end';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4 items-end';
      default:
        return 'top-4 left-4';
    }
  };

  // Filter participants based on voiceMode
  const displayedParticipants = state.participants.filter((p) => {
    if (state.voiceMode === 'speaking_only') {
      return p.isSpeaking;
    }
    return true;
  });

  // Recent messages for the last 5 seconds
  const now = Date.now();
  const visibleMessages = state.recentMessages.filter((msg) => now - msg.timestamp < 5000);

  // PIP Dimensions
  const pipDimensions = {
    small: 'w-[240px] h-[135px]',
    medium: 'w-[360px] h-[202px]',
    large: 'w-[480px] h-[270px]',
  }[state.pipSize || 'medium'];

  return (
    <div
      className={`fixed inset-0 w-screen h-screen font-sans select-none overflow-hidden transition-colors duration-200 pointer-events-none ${
        isInteractive
          ? 'bg-black/30 backdrop-blur-[2px] ring-2 ring-discord-accent/40 pointer-events-auto'
          : 'bg-transparent'
      }`}
    >
      {/* 1. TOP INTERACTIVE EDITOR TOOLBAR (Only shown when unlocked) */}
      {isInteractive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111214]/95 backdrop-blur-xl border border-discord-accent/50 shadow-2xl rounded-2xl p-3 flex items-center gap-4 text-xs animate-fade-in pointer-events-auto">
          <div className="flex items-center gap-2 pr-3 border-r border-[#2b2d31]">
            <Sparkles className="text-discord-accent animate-pulse" size={16} />
            <div className="leading-tight">
              <span className="font-bold text-white block">Modo Editor de Overlay</span>
              <span className="text-[10px] text-discord-textMuted">Posicione e personalize os widgets nos jogos</span>
            </div>
          </div>

          {/* Voice Mode Toggle */}
          <div className="flex items-center gap-1.5 pr-3 border-r border-[#2b2d31]">
            <span className="text-[11px] text-discord-textMuted font-semibold">Voz:</span>
            <button
              onClick={() =>
                updatePreference({
                  voiceMode: state.voiceMode === 'speaking_only' ? 'all' : 'speaking_only',
                })
              }
              className="px-2 py-1 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-white font-medium text-[11px] border border-white/10"
            >
              {state.voiceMode === 'speaking_only' ? '🎙️ Só quem fala' : '👥 Todos'}
            </button>
          </div>

          {/* PIP Size & Opacity */}
          {state.activePresenter && (
            <div className="flex items-center gap-2 pr-3 border-r border-[#2b2d31]">
              <span className="text-[11px] text-discord-textMuted font-semibold">PIP Tela:</span>
              <div className="flex rounded-lg bg-[#2b2d31] p-0.5 border border-white/10">
                {(['small', 'medium', 'large'] as OverlayPipSize[]).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => updatePreference({ pipSize: sz })}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${
                      state.pipSize === sz
                        ? 'bg-discord-accent text-white shadow'
                        : 'text-discord-textMuted hover:text-white'
                    }`}
                  >
                    {sz === 'small' ? 'P' : sz === 'medium' ? 'M' : 'G'}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] text-discord-textMuted font-mono">{state.pipOpacity}%</span>
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={state.pipOpacity}
                  onChange={(e) => updatePreference({ pipOpacity: Number(e.target.value) })}
                  className="w-16 h-1 accent-discord-accent bg-[#1e1f22] rounded cursor-pointer"
                  title="Opacidade do PIP de Tela"
                />
              </div>
            </div>
          )}

          {/* Lock / Save Button */}
          <button
            onClick={toggleInteractive}
            className="px-3.5 py-1.5 rounded-xl bg-discord-green hover:bg-emerald-600 text-white font-bold flex items-center gap-1.5 shadow-lg transition-all"
          >
            <Lock size={13} />
            <span>Travar para o Jogo</span>
          </button>
        </div>
      )}

      {/* 2. VOICE AVATARS HUD WIDGET */}
      <div
        className={`absolute z-30 flex flex-col gap-1.5 transition-all duration-300 ${getCornerClasses(
          state.voicePosition
        )}`}
      >
        {/* Widget Corner Switcher (In Interactive Mode) */}
        {isInteractive && (
          <div className="flex items-center gap-1 p-1 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 text-[10px] text-white pointer-events-auto shadow-lg mb-1">
            <span className="px-1 text-discord-textMuted font-semibold">Voz:</span>
            {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as OverlayWidgetCorner[]).map((pos) => (
              <button
                key={pos}
                onClick={() => updatePreference({ voicePosition: pos })}
                className={`w-5 h-5 rounded flex items-center justify-center font-bold transition-colors ${
                  state.voicePosition === pos
                    ? 'bg-discord-accent text-white'
                    : 'bg-white/10 text-discord-textMuted hover:text-white'
                }`}
                title={`Mover Voz para ${pos}`}
              >
                {pos === 'top-left' ? '↖' : pos === 'top-right' ? '↗' : pos === 'bottom-left' ? '↙' : '↘'}
              </button>
            ))}
          </div>
        )}

        {/* Avatars List */}
        <div className="space-y-1.5">
          {displayedParticipants.map((p) => {
            const isSpeaking = p.isSpeaking;

            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 transition-all duration-200 ${
                  isSpeaking ? 'opacity-100 scale-105 translate-x-1' : 'opacity-40 hover:opacity-90'
                }`}
              >
                {/* Circular Avatar */}
                <div className="relative flex-shrink-0">
                  <div
                    className={`w-8 h-8 rounded-full bg-[#2b2d31] flex items-center justify-center font-bold text-white text-[11px] overflow-hidden transition-all duration-150 ${
                      isSpeaking
                        ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-black/60 shadow-[0_0_12px_rgba(52,211,153,0.95)]'
                        : 'ring-1 ring-white/20'
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
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-600 flex items-center justify-center text-white ring-1 ring-black">
                      <MicOff size={8} />
                    </div>
                  )}
                  {p.isDeafened && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-600 flex items-center justify-center text-white ring-1 ring-black">
                      <VolumeX size={8} />
                    </div>
                  )}
                </div>

                {/* Name Tag Pill */}
                <div
                  className={`px-2 py-0.5 rounded-md backdrop-blur-md text-xs font-semibold truncate max-w-[140px] transition-colors ${
                    isSpeaking
                      ? 'bg-black/70 text-white border border-emerald-500/40 shadow font-bold'
                      : 'bg-black/35 text-white/80 border border-white/5'
                  }`}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                >
                  {p.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. PICTURE-IN-PICTURE (PIP) SCREEN SHARE STREAM WIDGET */}
      {state.activePresenter && state.showPip && (
        <div
          className={`absolute z-40 flex flex-col gap-1 transition-all duration-300 ${getCornerClasses(
            state.pipPosition
          )}`}
          style={{ opacity: (state.pipOpacity || 90) / 100 }}
        >
          {/* PIP Header & Position Switcher (In Interactive Mode) */}
          {isInteractive && (
            <div className="flex items-center justify-between gap-2 p-1 px-2 bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-[10px] text-white pointer-events-auto shadow-lg mb-1">
              <div className="flex items-center gap-1">
                <span className="text-discord-accent font-bold">PIP:</span>
                <span className="truncate max-w-[90px]">{state.activePresenter.userName}</span>
              </div>
              <div className="flex items-center gap-1">
                {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as OverlayWidgetCorner[]).map((pos) => (
                  <button
                    key={pos}
                    onClick={() => updatePreference({ pipPosition: pos })}
                    className={`w-5 h-5 rounded flex items-center justify-center font-bold transition-colors ${
                      state.pipPosition === pos
                        ? 'bg-discord-accent text-white'
                        : 'bg-white/10 text-discord-textMuted hover:text-white'
                    }`}
                    title={`Mover PIP para ${pos}`}
                  >
                    {pos === 'top-left' ? '↖' : pos === 'top-right' ? '↗' : pos === 'bottom-left' ? '↙' : '↘'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Video Stream Container */}
          <div
            className={`relative ${pipDimensions} rounded-xl overflow-hidden bg-black/90 border-2 border-discord-accent/60 shadow-2xl backdrop-blur-md group pointer-events-auto`}
          >
            <img
              ref={pipImgRef}
              alt="Live Stream PIP"
              className={`w-full h-full object-contain bg-black ${hasFrame ? 'block' : 'hidden'}`}
            />
            {!hasFrame && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-discord-textMuted text-xs">
                <Monitor size={28} className="text-discord-accent animate-pulse" />
                <span className="font-semibold text-[11px] text-white">
                  Ao Vivo: {state.activePresenter.userName}
                </span>
              </div>
            )}

            {/* Discreet Live Badge Overlay */}
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] font-bold text-discord-accent border border-discord-accent/30 shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-discord-accent animate-ping" />
              <span>AO VIVO</span>
            </div>

            {/* Quick Hide Button */}
            {isInteractive && (
              <button
                onClick={() => updatePreference({ showPip: false })}
                className="absolute top-2 right-2 p-1 rounded-full bg-black/70 hover:bg-red-600 text-white transition-colors shadow"
                title="Ocultar PIP de Vídeo"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. MINI CHAT NOTIFICATIONS WIDGET */}
      <div
        className={`absolute z-30 flex flex-col gap-1.5 max-w-[280px] transition-all duration-300 ${getCornerClasses(
          state.chatPosition
        )}`}
      >
        {/* Chat Corner Switcher (In Interactive Mode) */}
        {isInteractive && (
          <div className="flex items-center gap-1 p-1 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 text-[10px] text-white pointer-events-auto shadow-lg mb-1">
            <span className="px-1 text-discord-textMuted font-semibold">Chat:</span>
            {(['top-left', 'top-right', 'bottom-left', 'bottom-right'] as OverlayWidgetCorner[]).map((pos) => (
              <button
                key={pos}
                onClick={() => updatePreference({ chatPosition: pos })}
                className={`w-5 h-5 rounded flex items-center justify-center font-bold transition-colors ${
                  state.chatPosition === pos
                    ? 'bg-discord-accent text-white'
                    : 'bg-white/10 text-discord-textMuted hover:text-white'
                }`}
                title={`Mover Chat para ${pos}`}
              >
                {pos === 'top-left' ? '↖' : pos === 'top-right' ? '↗' : pos === 'bottom-left' ? '↙' : '↘'}
              </button>
            ))}
          </div>
        )}

        {/* Chat Toasts */}
        {visibleMessages.map((msg) => (
          <div
            key={msg.id}
            className="flex items-start gap-1.5 px-2.5 py-1.5 bg-black/65 backdrop-blur-md rounded-xl border border-white/10 shadow-xl text-xs animate-fade-in text-white/90"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
          >
            <span className="font-bold text-discord-accent flex-shrink-0 text-[11px]">
              {msg.userName}:
            </span>
            <span className="text-gray-100 break-words leading-tight flex-1 text-[11px]">
              {msg.content}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
