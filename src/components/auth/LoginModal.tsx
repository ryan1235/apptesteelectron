import React, { useState, useEffect } from 'react';
import {
  User,
  Radio,
  ArrowRight,
  Check,
} from 'lucide-react';
import { AppConfig } from '../../types/live-room';

interface LoginModalProps {
  isOpen: boolean;
  config: AppConfig;
  onLogin: (userName: string, avatarUrl: string) => void;
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
  const [userName, setUserName] = useState(config.userName || 'Ryan');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(config.avatarUrl || PRESET_AVATARS[0].url);
  const [customAvatar, setCustomAvatar] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setUserName(config.userName || 'Ryan');
    if (config.avatarUrl) setSelectedAvatar(config.avatarUrl);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) {
      setError('Por favor, digite seu nome de usuário.');
      return;
    }

    const finalAvatar = customAvatar.trim() || selectedAvatar;
    onLogin(userName.trim(), finalAvatar);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-discord-chat rounded-2xl shadow-2xl border border-discord-border overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 text-center bg-gradient-to-b from-[#2b2d31] to-discord-chat border-b border-[#1f2023]">
          <div className="w-12 h-12 rounded-2xl bg-discord-accent flex items-center justify-center text-white mx-auto shadow-lg mb-2.5">
            <Radio size={24} className="animate-pulse" />
          </div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Boas-vindas ao Discord Live Rooms!
          </h2>
          <p className="text-xs text-discord-textMuted mt-0.5">
            Servidor Aberto • Transmissão 60 FPS • Voz PCM Baixa Latência
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-discord-red/10 border border-discord-red/30 text-discord-red text-xs">
              {error}
            </div>
          )}

          {/* Nome de Usuário */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-1.5">
              Como devemos te chamar? <span className="text-discord-red">*</span>
            </label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-2.5 text-discord-textMuted" />
              <input
                type="text"
                required
                autoFocus
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  setError(null);
                }}
                placeholder="Ex: Ryan"
                className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded-lg pl-9 pr-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
              />
            </div>
          </div>

          {/* Seletor de Avatar */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-1.5">
              Escolha seu Avatar
            </label>
            <div className="flex items-center justify-between gap-2 p-1.5 bg-[#1e1f22] rounded-lg">
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
                    className={`relative w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${
                      isSelected
                        ? 'border-discord-accent ring-2 ring-discord-accent/50 scale-105'
                        : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    title={av.name}
                  >
                    <img src={av.url} alt="" className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute inset-0 bg-discord-accent/30 flex items-center justify-center">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botão de Entrar */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-discord-accent hover:bg-discord-accentHover text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Entrar no Servidor</span>
              <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
