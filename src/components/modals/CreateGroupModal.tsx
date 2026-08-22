import React, { useState } from 'react';
import { X, Users, Lock, Sparkles, Hash, Image as ImageIcon } from 'lucide-react';
import { CreateGroupPayload } from '../../types/live-room';

interface CreateGroupModalProps {
  isOpen: boolean;
  clientUserId: string;
  onClose: () => void;
  onCreate: (payload: CreateGroupPayload) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  clientUserId,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [customGroupId, setCustomGroupId] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isProtected, setIsProtected] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      password: isProtected && password.trim() ? password.trim() : undefined,
      customGroupId: customGroupId.trim() || undefined,
      avatarUrl: avatarUrl.trim() || undefined,
      clientUserId,
    });

    // Reset & Close
    setName('');
    setDescription('');
    setPassword('');
    setCustomGroupId('');
    setAvatarUrl('');
    setIsProtected(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-md bg-discord-chat rounded-2xl shadow-2xl border border-discord-border overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between border-b border-[#1f2023] bg-[#1e1f22]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-discord-accent/20 flex items-center justify-center text-discord-accent shadow-sm">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-discord-textHeader">Criar Grupo / Servidor</h2>
              <p className="text-xs text-discord-textMuted">Agrupe várias salas ao vivo para seu Squad</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-discord-textMuted hover:text-white p-1 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block font-bold text-discord-textHeader mb-1">
              Nome do Grupo *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Squad Alpha, Comunidade Gamer, Tech Hub..."
              className="w-full bg-[#1e1f22] text-discord-textNormal rounded-xl px-3.5 py-2.5 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted text-xs"
            />
          </div>

          <div>
            <label className="block font-bold text-discord-textHeader mb-1">
              Descrição (Opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Servidor para bate-papo de desenvolvimento e transmissões..."
              rows={2}
              className="w-full bg-[#1e1f22] text-discord-textNormal rounded-xl px-3.5 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted text-xs resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-discord-textHeader mb-1 flex items-center gap-1">
                <Hash size={12} className="text-discord-textMuted" />
                <span>ID Customizado</span>
              </label>
              <input
                type="text"
                value={customGroupId}
                onChange={(e) => setCustomGroupId(e.target.value)}
                placeholder="Ex: squad-01"
                className="w-full bg-[#1e1f22] text-discord-textNormal rounded-xl px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted text-xs font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-discord-textHeader mb-1 flex items-center gap-1">
                <ImageIcon size={12} className="text-discord-textMuted" />
                <span>Ícone / Avatar URL</span>
              </label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full bg-[#1e1f22] text-discord-textNormal rounded-xl px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted text-xs"
              />
            </div>
          </div>

          {/* Password Protection Toggle */}
          <div className="pt-2 border-t border-[#1f2023] space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-discord-textHeader flex items-center gap-2 cursor-pointer">
                <Lock size={14} className="text-discord-yellow" />
                <span>Proteger Grupo com Senha</span>
              </label>
              <input
                type="checkbox"
                checked={isProtected}
                onChange={(e) => setIsProtected(e.target.checked)}
                className="w-4 h-4 accent-discord-accent cursor-pointer"
              />
            </div>

            {isProtected && (
              <div className="animate-fade-in">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a senha de acesso ao grupo..."
                  className="w-full bg-[#1e1f22] text-discord-textNormal rounded-xl px-3.5 py-2.5 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted text-xs"
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#1f2023] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-discord-textNormal hover:underline transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-discord-accent hover:bg-discord-accentHover text-white disabled:opacity-50 transition-all shadow-md shadow-discord-accent/20"
            >
              Criar Grupo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
