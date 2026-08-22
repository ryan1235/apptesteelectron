import React, { useState, useEffect } from 'react';
import {
  X,
  Monitor,
  AppWindow,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
  Check,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import {
  DesktopSource,
  QualityProfile,
  QUALITY_PROFILES,
  ScreenAudioMode,
} from '../../types/live-room';

interface ScreenSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartShare: (
    sourceId: string,
    profile: QualityProfile,
    audioMode: ScreenAudioMode
  ) => void;
  getSources: () => Promise<DesktopSource[]>;
}

export const ScreenSourceModal: React.FC<ScreenSourceModalProps> = ({
  isOpen,
  onClose,
  onStartShare,
  getSources,
}) => {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [activeTab, setActiveTab] = useState<'screens' | 'windows'>('screens');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<QualityProfile>('SMOOTH_60FPS');
  const [audioMode, setAudioMode] = useState<ScreenAudioMode>('app_only');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadSources = async () => {
    try {
      setIsLoading(true);
      const res = await getSources();
      setSources(res || []);
      if (res && res.length > 0) {
        // Select first available source if none selected
        setSelectedSourceId((prev) => {
          if (prev && res.some((s) => s.id === prev)) return prev;
          const firstScreen = res.find((s) => s.isScreen);
          return firstScreen ? firstScreen.id : res[0].id;
        });
      }
    } catch (e) {
      console.error('Erro ao listar fontes:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSources();
    } else {
      setSources([]);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const screens = sources.filter((s) => s.isScreen);
  const windows = sources.filter((s) => !s.isScreen);
  const displayedSources = activeTab === 'screens' ? screens : windows;

  const handleConfirm = () => {
    if (!selectedSourceId) return;
    onStartShare(selectedSourceId, selectedProfile, audioMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-discord-chat rounded-xl shadow-2xl border border-discord-border flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#1f2023] bg-[#2b2d31]">
          <div className="flex items-center gap-2 text-discord-textHeader font-bold text-base">
            <Monitor className="text-discord-accent" size={20} />
            <span>Compartilhar Tela (WebCodecs GPU)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadSources}
              className="text-discord-textMuted hover:text-white p-1 rounded hover:bg-[#35373c] transition-colors"
              title="Atualizar Janelas e Telas"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="text-discord-textMuted hover:text-white p-1 rounded hover:bg-[#35373c] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs: Screens vs Windows */}
        <div className="flex px-6 pt-3 border-b border-[#1f2023] gap-6 text-sm font-medium bg-discord-chat">
          <button
            onClick={() => {
              setActiveTab('screens');
              const firstScreen = screens[0];
              if (firstScreen) setSelectedSourceId(firstScreen.id);
            }}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'screens'
                ? 'border-discord-accent text-white font-semibold'
                : 'border-transparent text-discord-textMuted hover:text-discord-textNormal'
            }`}
          >
            <Monitor size={16} />
            <span>Telas Inteiras ({screens.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('windows');
              const firstWindow = windows[0];
              if (firstWindow) setSelectedSourceId(firstWindow.id);
            }}
            className={`pb-3 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'windows'
                ? 'border-discord-accent text-white font-semibold'
                : 'border-transparent text-discord-textMuted hover:text-discord-textNormal'
            }`}
          >
            <AppWindow size={16} />
            <span>Janelas de Aplicativos ({windows.length})</span>
          </button>
        </div>

        {/* Source Cards Grid */}
        <div className="p-6 overflow-y-auto min-h-[200px] max-h-[300px] bg-[#232428]/50">
          {isLoading && sources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-discord-textMuted text-xs gap-2">
              <RefreshCw size={24} className="animate-spin text-discord-accent" />
              <span>Detectando telas e aplicativos abertos...</span>
            </div>
          ) : displayedSources.length === 0 ? (
            <div className="text-center py-16 text-discord-textMuted text-xs">
              Nenhuma {activeTab === 'screens' ? 'tela' : 'janela de aplicativo'} encontrada.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {displayedSources.map((source) => {
                const isSelected = selectedSourceId === source.id;
                return (
                  <div
                    key={source.id}
                    onClick={() => setSelectedSourceId(source.id)}
                    className={`group relative flex flex-col bg-[#1e1f22] rounded-lg overflow-hidden border-2 cursor-pointer transition-all duration-150 select-none ${
                      isSelected
                        ? 'border-discord-accent shadow-xl ring-2 ring-discord-accent/50 bg-[#2b2d31]'
                        : 'border-[#2e3035] hover:border-discord-accent/60 hover:bg-[#25272b]'
                    }`}
                  >
                    {/* Thumbnail Preview */}
                    <div className="w-full h-28 bg-[#111214] flex items-center justify-center overflow-hidden relative">
                      {source.thumbnailUrl ? (
                        <img
                          src={source.thumbnailUrl}
                          alt={source.name}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <Monitor size={36} className="text-discord-textMuted opacity-40" />
                      )}

                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-discord-accent text-white flex items-center justify-center shadow-lg animate-fade-in">
                          <Check size={14} strokeWidth={3} />
                        </div>
                      )}
                    </div>

                    {/* Window / Screen Label */}
                    <div className="p-2.5 flex items-center gap-2 bg-[#1e1f22]">
                      {source.appIconUrl ? (
                        <img
                          src={source.appIconUrl}
                          alt="app"
                          className="w-4 h-4 rounded-sm flex-shrink-0"
                        />
                      ) : source.isScreen ? (
                        <Monitor size={14} className="text-discord-textMuted flex-shrink-0" />
                      ) : (
                        <AppWindow size={14} className="text-discord-textMuted flex-shrink-0" />
                      )}
                      <span className="text-xs text-discord-textHeader truncate font-medium flex-1">
                        {source.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quality Profile & Audio Mode Selection */}
        <div className="p-6 py-4 bg-[#2b2d31] border-t border-[#1f2023] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quality Profile */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-1.5 flex items-center gap-1">
                <Sparkles size={12} className="text-discord-yellow" />
                <span>Qualidade do Vídeo (GPU)</span>
              </label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value as QualityProfile)}
                className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none cursor-pointer"
              >
                {Object.values(QUALITY_PROFILES).map((prof) => (
                  <option key={prof.name} value={prof.name}>
                    {prof.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Audio Mode Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-discord-textMuted mb-1.5 flex items-center gap-1">
                <Volume2 size={12} className="text-discord-green" />
                <span>Transmissão de Áudio</span>
              </label>
              <select
                value={audioMode}
                onChange={(e) => setAudioMode(e.target.value as ScreenAudioMode)}
                className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none cursor-pointer"
              >
                <option value="app_only">Apenas o Áudio do Aplicativo (Recomendado)</option>
                <option value="desktop_loopback">Áudio Completo do PC (Todo o Sistema)</option>
                <option value="none">Sem Áudio (Apenas Vídeo)</option>
              </select>
            </div>
          </div>

          {/* Audio Mode Explanation / Tip */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#1e1f22]/60 rounded text-[11px] text-discord-textMuted border border-[#2e3035]">
            <ShieldCheck size={14} className="text-discord-accent flex-shrink-0" />
            <span>
              {audioMode === 'app_only' && 'Transmite apenas o som da janela escolhida sem eco ou vazamento de chamadas externas.'}
              {audioMode === 'desktop_loopback' && 'Transmite todos os sons do Windows (jogos, música e navegadores) em estéreo 44.1kHz.'}
              {audioMode === 'none' && 'Transmite apenas o fluxo de imagem em alta taxa de quadros sem áudio.'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded text-xs font-medium text-discord-textNormal hover:underline transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedSourceId}
              className="px-6 py-2 rounded text-xs font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg"
            >
              <Monitor size={14} />
              <span>Iniciar Transmissão</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
