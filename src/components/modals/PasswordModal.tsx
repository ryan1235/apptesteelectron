import React, { useState } from 'react';
import { X, Lock, KeyRound } from 'lucide-react';
import { RoomSummary } from '../../types/live-room';

interface PasswordModalProps {
  isOpen: boolean;
  room: RoomSummary | null;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  room,
  onClose,
  onConfirm,
}) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !room) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Por favor, digite a senha da sala.');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await onConfirm(password);
      setPassword('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Senha incorreta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-discord-chat rounded-lg shadow-2xl border border-discord-border overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-discord-textHeader font-bold text-base">
            <Lock className="text-discord-yellow" size={18} />
            <span>Sala Protegida por Senha</span>
          </div>
          <button
            onClick={onClose}
            className="text-discord-textMuted hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-xs text-discord-textMuted leading-relaxed">
            A sala <strong className="text-white">{room.title}</strong> é privada. Digite a senha para entrar.
          </div>

          {error && (
            <div className="p-3 rounded bg-discord-red/10 border border-discord-red/30 text-discord-red text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-1.5">
              Senha de Acesso
            </label>
            <div className="relative">
              <KeyRound size={14} className="absolute left-3 top-2.5 text-discord-textMuted" />
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha..."
                className="w-full bg-[#1e1f22] text-sm text-discord-textNormal rounded pl-9 pr-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
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
              className="px-5 py-2 rounded text-sm font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Verificando...' : 'Entrar na Sala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
