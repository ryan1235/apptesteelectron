import React, { useState } from 'react';
import { X, Lock, Users, Sparkles, Shield } from 'lucide-react';
import { CreateRoomPayload } from '../../types/live-room';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateRoomPayload) => Promise<void>;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isProtected, setIsProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(16);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('O título da sala é obrigatório.');
      return;
    }
    if (isProtected && !password.trim()) {
      setError('Por favor, defina uma senha para a sala protegida.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onCreate({
        title: title.trim(),
        description: description.trim() || undefined,
        password: isProtected ? password.trim() : null,
        maxParticipants,
      });
      // Reset
      setTitle('');
      setDescription('');
      setIsProtected(false);
      setPassword('');
      setMaxParticipants(16);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar sala.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-md bg-discord-chat rounded-lg shadow-2xl border border-discord-border overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-discord-textHeader font-bold text-lg">
            <Sparkles className="text-discord-accent" size={20} />
            <span>Criar Nova Sala Ao Vivo</span>
          </div>
          <button
            onClick={onClose}
            className="text-discord-textMuted hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded bg-discord-red/10 border border-discord-red/30 text-discord-red text-xs">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-1.5">
              Título da Sala <span className="text-discord-red">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Call de Alinhamento & Code Review 🚀"
              className="w-full bg-[#1e1f22] text-sm text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-1.5">
              Descrição (Opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito da sala..."
              rows={2}
              className="w-full bg-[#1e1f22] text-sm text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted resize-none"
            />
          </div>

          {/* Max Participants Slider */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-discord-textMuted flex items-center gap-1.5">
                <Users size={14} />
                <span>Limite de Participantes: {maxParticipants}</span>
              </label>
            </div>
            <input
              type="range"
              min={2}
              max={32}
              value={maxParticipants}
              onChange={(e) => setMaxParticipants(Number(e.target.value))}
              className="w-full accent-discord-accent bg-[#1e1f22] rounded-lg cursor-pointer h-2"
            />
            <div className="flex justify-between text-[10px] text-discord-textMuted mt-1">
              <span>2 pessoas</span>
              <span>16 (Padrão)</span>
              <span>32 pessoas</span>
            </div>
          </div>

          {/* Password Protection */}
          <div className="p-3 bg-[#2b2d31] rounded-lg border border-discord-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-discord-yellow" />
                <span className="text-sm font-medium text-discord-textHeader">Proteger com Senha</span>
              </div>
              <input
                type="checkbox"
                checked={isProtected}
                onChange={(e) => setIsProtected(e.target.checked)}
                className="w-4 h-4 rounded accent-discord-accent cursor-pointer"
              />
            </div>

            {isProtected && (
              <div className="pt-2 border-t border-discord-border/30 animate-fade-in">
                <label className="block text-xs font-medium text-discord-textMuted mb-1">
                  Senha de Acesso
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-2.5 text-discord-textMuted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite a senha da sala..."
                    className="w-full bg-[#1e1f22] text-sm text-discord-textNormal rounded pl-9 pr-3 py-1.5 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-sm font-medium text-discord-textNormal hover:underline transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isLoading ? 'Criando...' : 'Criar Sala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
