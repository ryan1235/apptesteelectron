import React, { useState } from 'react';
import {
  Sparkles,
  User,
  Radio,
  KeyRound,
  Server,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { AppConfig } from '../../types/live-room';

interface LoginModalProps {
  isOpen: boolean;
  config: AppConfig;
  onLogin: (userName: string, avatarUrl: string, jwtToken?: string, apiUrl?: string, wsUrl?: string) => void;
}

const PRESET_AVATARS = [
  { id: '1', name: 'Cyberpunk', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80' },
  { id: '2', name: 'Dev Gamer', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80' },
  { id: '3', name: 'Pixel Bot', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' },
  { id: '4', name: 'Neon Fox', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
  { id: '5', name: 'Astro', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' },
];

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  config,
  onLogin,
}) => {
  const [userName, setUserName] = useState(config.userName || '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(config.avatarUrl || PRESET_AVATARS[0].url);
  const [customAvatar, setCustomAvatar] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jwtToken, setJwtToken] = useState(config.jwtToken || '');
  const [apiUrl, setApiUrl] = useState(config.apiUrl || '');
  const [wsUrl, setWsUrl] = useState(config.wsUrl || '');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setError('Por favor, informe seu nome de usuário.');
      return;
    }

    const finalAvatar = customAvatar.trim() || selectedAvatar;
    onLogin(userName.trim(), finalAvatar, jwtToken.trim(), apiUrl.trim(), wsUrl.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-discord-chat rounded-2xl shadow-2xl border border-discord-border overflow-hidden flex flex-col">
        {/* Banner Header */}
        <div className="p-8 pb-4 text-center bg-gradient-to-b from-[#2b2d31] to-discord-chat border-b border-[#1f2023]">
          <div className="w-14 h-14 rounded-2xl bg-discord-accent flex items-center justify-center text-white mx-auto shadow-lg mb-3">
            <Radio size={28} className="animate-pulse" />
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            Boas-vindas ao Live Rooms!
          </h2>
          <p className="text-xs text-discord-textMuted mt-1">
            Escolha seu nome e avatar para entrar nos canais de voz e vídeo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-discord-red/10 border border-discord-red/30 text-discord-red text-xs">
              {error}
            </div>
          )}

          {/* User Name Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-2">
              Como devemos te chamar? <span className="text-discord-red">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-3 text-discord-textMuted" />
              <input
                type="text"
                autoFocus
                required
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  setError(null);
                }}
                placeholder="Ex: Ryan_Gamer"
                className="w-full bg-[#1e1f22] text-sm text-discord-textNormal rounded-lg pl-9 pr-3 py-2.5 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
              />
            </div>
          </div>

          {/* Avatar Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-2">
              Escolha seu Avatar
            </label>
            <div className="flex items-center justify-between gap-2 p-2 bg-[#1e1f22] rounded-xl">
              {PRESET_AVATARS.map((av) => {
                const isSelected = selectedAvatar === av.url && !customAvatar;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(av.url);
                      setCustomAvatar('');
                    }}
                    className={`relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all ${
                      isSelected
                        ? 'border-discord-accent ring-2 ring-discord-accent/50 scale-105'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    title={av.name}
                  >
                    <img src={av.url} alt={av.name} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-discord-accent/30 flex items-center justify-center">
                        <Check size={14} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Server Settings Accordion */}
          <div className="border-t border-[#1f2023] pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-discord-textMuted hover:text-white flex items-center gap-1.5 transition-colors font-medium"
            >
              <Server size={14} />
              <span>{showAdvanced ? 'Ocultar Configurações de Conexão' : 'Configurações de Servidor & Token (Opcional)'}</span>
            </button>

            {showAdvanced && (
              <div className="space-y-3 pt-3 text-xs animate-fade-in">
                <div>
                  <label className="block text-[11px] font-semibold text-discord-textMuted mb-1">
                    API URL
                  </label>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://archpixel.squareweb.app"
                    className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded px-3 py-1.5 border border-transparent focus:border-discord-accent focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-discord-textMuted mb-1">
                    WebSocket URL
                  </label>
                  <input
                    type="text"
                    value={wsUrl}
                    onChange={(e) => setWsUrl(e.target.value)}
                    placeholder="wss://archpixel.squareweb.app/ws/live-room"
                    className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded px-3 py-1.5 border border-transparent focus:border-discord-accent focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-discord-textMuted mb-1">
                    Token JWT (Bearer Auth)
                  </label>
                  <input
                    type="password"
                    value={jwtToken}
                    onChange={(e) => setJwtToken(e.target.value)}
                    placeholder="Cole seu JWT token se necessário..."
                    className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded px-3 py-1.5 border border-transparent focus:border-discord-accent focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-discord-accent hover:bg-discord-accentHover text-white text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2 group"
            >
              <span>Entrar no Discord Live Rooms</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
