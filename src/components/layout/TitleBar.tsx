import React, { useState, useEffect } from 'react';
import { Minus, Square, Copy, X, Radio, Wifi, WifiOff } from 'lucide-react';

interface TitleBarProps {
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'mock';
  activeRoomTitle?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  connectionStatus,
  activeRoomTitle,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (window.electronAPI?.onWindowStateChanged) {
      const cleanup = window.electronAPI.onWindowStateChanged((state) => {
        setIsMaximized(state.isMaximized);
      });
      return cleanup;
    }
  }, []);

  const handleMinimize = () => window.electronAPI?.minimizeWindow();
  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow();
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => window.electronAPI?.closeWindow();

  return (
    <div className="h-8 bg-discord-sidebar flex items-center justify-between px-3 select-none drag-region text-xs text-discord-textMuted border-b border-[#1f2023] z-50">
      {/* App Branding */}
      <div className="flex items-center gap-2 font-semibold text-discord-textNormal">
        <div className="w-4 h-4 rounded-full bg-discord-accent flex items-center justify-center text-white">
          <Radio size={10} className="animate-pulse" />
        </div>
        <span className="tracking-tight text-white font-medium">Discord Live Rooms</span>
        {activeRoomTitle && (
          <span className="text-discord-textMuted font-normal">
            — <span className="text-discord-textNormal">{activeRoomTitle}</span>
          </span>
        )}
      </div>

      {/* Connection Indicator */}
      <div className="flex items-center gap-2 no-drag">
        {connectionStatus === 'connected' && (
          <div className="flex items-center gap-1.5 text-discord-green bg-discord-green/10 px-2 py-0.5 rounded-full text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-ping"></span>
            <Wifi size={12} />
            <span>Conectado (30ms)</span>
          </div>
        )}
        {connectionStatus === 'mock' && (
          <div className="flex items-center gap-1.5 text-discord-yellow bg-discord-yellow/10 px-2 py-0.5 rounded-full text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-discord-yellow"></span>
            <Wifi size={12} />
            <span>Modo Mock / Offline</span>
          </div>
        )}
        {connectionStatus === 'connecting' && (
          <div className="flex items-center gap-1.5 text-discord-yellow bg-discord-yellow/10 px-2 py-0.5 rounded-full text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-discord-yellow animate-bounce"></span>
            <span>Conectando...</span>
          </div>
        )}
        {connectionStatus === 'disconnected' && (
          <div className="flex items-center gap-1.5 text-discord-red bg-discord-red/10 px-2 py-0.5 rounded-full text-[11px]">
            <WifiOff size={12} />
            <span>Desconectado</span>
          </div>
        )}
      </div>

      {/* Window Controls */}
      <div className="flex items-center no-drag -mr-3 h-full">
        <button
          onClick={handleMinimize}
          className="h-full px-3 hover:bg-[#35373c] text-discord-textNormal flex items-center justify-center transition-colors"
          title="Minimizar"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="h-full px-3 hover:bg-[#35373c] text-discord-textNormal flex items-center justify-center transition-colors"
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
        >
          {isMaximized ? <Copy size={12} className="rotate-180" /> : <Square size={12} />}
        </button>
        <button
          onClick={handleClose}
          className="h-full px-3 hover:bg-discord-red hover:text-white text-discord-textNormal flex items-center justify-center transition-colors"
          title="Fechar"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
