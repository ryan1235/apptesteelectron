import React, { useState } from 'react';
import { X, Lock, Users, Sparkles, Shield, Hash, Layers } from 'lucide-react';
import { CreateRoomPayload, LiveGroup } from '../../types/live-room';

interface CreateRoomModalProps {
  isOpen: boolean;
  groups?: LiveGroup[];
  defaultGroupId?: string;
  clientUserId?: string;
  onClose: () => void;
  onCreate: (payload: CreateRoomPayload) => Promise<void>;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  groups = [],
  defaultGroupId,
  clientUserId,
  onClose,
  onCreate,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState(defaultGroupId || '');
  const [customRoomId, setCustomRoomId] = useState('');
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
        groupId: groupId || undefined,
        customRoomId: customRoomId.trim() || undefined,
        password: isProtected ? password.trim() : null,
        maxParticipants,
        clientUserId,
      });

      // Reset
      setTitle('');
      setDescription('');
      setGroupId('');
      setCustomRoomId('');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-discord-chat rounded-2xl shadow-2xl border border-discord-border overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-3 flex items-center justify-between border-b border-[#1f2023] bg-[#1e1f22]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-discord-accent/20 flex items-center justify-center text-discord-accent shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-discord-textHeader">Criar Nova Sala Ao Vivo</h2>
              <p className="text-xs text-discord-textMuted">Voz, Vídeo GPU 60 FPS & Chat</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-discord-textMuted hover:text-white p-1 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-discord-red/10 border border-discord-red/30 text-discord-red font-medium">
              {error}
            </div>
          )}

          {/* Group Selector */}
          <div>
            <label className="block font-bold text-discord-textHeader mb-1 flex items-center gap-1.5">
              <Layers size={13} className="text-discord-accent" />
              <span>Vincular ao Grupo / Servidor (Opcional)</span>
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full bg-[#1e1f22] text-discord-textNormal rounded-xl px-3 py-2.5 border border-transparent focus:border-discord-accent focus:outline-none"
            >
              <option value="">Nenhum (Sala Pública Geral)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} {g.isPasswordProtected ? '🔒' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block font-bold text-discord-textHeader mb-1">
              Título da Sala *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Call de Alinhamento & Transmissão 🚀"
              className="w-full bg-[#1e1f22] text-discord-textNormal rounded-xl px-3.5 py-2.5 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
            />
          </div>

          {/* Description & Custom Room ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-discord-textHeader mb-1">
                Descrição (Opcional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Jogando ao vivo..."
                className="w-full bg-[#1e1f22] text-discord-textNormal rounded-xl px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
              />
            </div>

            <div>
              <label className="block font-bold text-discord-textHeader mb-1 flex items-center gap-1">
                <Hash size={12} className="text-discord-textMuted" />
                <span>ID Customizado</span>
              </label>
              <input
                type="text"
                value={customRoomId}
                onChange={(e) => setCustomRoomId(e.target.value)}
                placeholder="Ex: room-app-01"
                className="w-full bg-[#1e1f22] text-discord-textNormal rounded-xl px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted font-mono"
              />
            </div>
          </div>

          {/* Max Participants Slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-bold text-discord-textHeader flex items-center gap-1.5">
                <Users size={13} className="text-discord-green" />
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
          <div className="p-3 bg-[#2b2d31] rounded-xl border border-discord-border/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={15} className="text-discord-yellow" />
                <span className="font-bold text-discord-textHeader">Proteger com Senha</span>
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
                <div className="relative">
                  <Lock size={13} className="absolute left-3 top-2.5 text-discord-textMuted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite a senha da sala..."
                    className="w-full bg-[#1e1f22] text-discord-textNormal rounded-lg pl-8 pr-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#1f2023] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-discord-textNormal hover:underline transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-discord-accent hover:bg-discord-accentHover text-white transition-all shadow-md shadow-discord-accent/20 disabled:opacity-50"
            >
              {isLoading ? 'Criando...' : 'Criar Sala'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
