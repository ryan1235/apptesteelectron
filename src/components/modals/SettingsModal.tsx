import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Server,
  Mic,
  Volume2,
  ShieldCheck,
  Cpu,
  Save,
  CheckCircle2,
  Sliders,
  Sparkles,
  Info,
  Terminal,
  Copy,
  Trash2,
  Check,
  RefreshCw,
} from 'lucide-react';
import { AppConfig } from '../../types/live-room';
import { logger, LogEntry, LogCategory } from '../../services/logger';

interface SettingsModalProps {
  isOpen: boolean;
  config: AppConfig;
  micVolumeLevel: number;
  onClose: () => void;
  onSaveConfig: (config: AppConfig) => void;
}

type TabType = 'connection' | 'audio' | 'loopback' | 'video' | 'logs';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  config,
  micVolumeLevel,
  onClose,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('connection');
  const [formData, setFormData] = useState<AppConfig>({ ...config });
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Logs Tab State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFormData({ ...config });
  }, [config, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    // Enumerate audio devices
    navigator.mediaDevices?.enumerateDevices().then((devices) => {
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      const outputs = devices.filter((d) => d.kind === 'audiooutput');
      setAudioInputDevices(inputs);
      setAudioOutputDevices(outputs);
    }).catch(console.warn);

    // Subscribe to logger
    const unsubscribe = logger.subscribe((newLogs) => {
      setLogs(newLogs);
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  useEffect(() => {
    if (activeTab === 'logs' && autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, activeTab, autoScroll]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveConfig(formData);
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 600);
  };

  const handleCopyLogs = () => {
    const text = logger.exportAsString();
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 1500);
  };

  const handleClearLogs = () => {
    logger.clear();
  };

  const filteredLogs = logs.filter((l) => {
    if (selectedCategory === 'ALL') return true;
    if (selectedCategory === 'ERROR') return l.level === 'ERROR' || l.category === 'ERROR';
    return l.category === selectedCategory;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in select-none">
      <div className="w-full max-w-3xl bg-discord-chat rounded-xl shadow-2xl border border-discord-border flex overflow-hidden h-[580px]">
        {/* Left Settings Sidebar Navigation */}
        <div className="w-56 bg-discord-channelList p-4 flex flex-col justify-between select-none border-r border-[#1f2023]">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-discord-textMuted px-2 pb-2">
              Configurações
            </div>

            <button
              onClick={() => setActiveTab('connection')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'connection'
                  ? 'bg-[#35373c] text-white'
                  : 'text-discord-textMuted hover:bg-[#35373c]/40 hover:text-discord-textNormal'
              }`}
            >
              <Server size={16} className={activeTab === 'connection' ? 'text-discord-accent' : ''} />
              <span>Servidor & Conexão</span>
            </button>

            <button
              onClick={() => setActiveTab('audio')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'audio'
                  ? 'bg-[#35373c] text-white'
                  : 'text-discord-textMuted hover:bg-[#35373c]/40 hover:text-discord-textNormal'
              }`}
            >
              <Mic size={16} className={activeTab === 'audio' ? 'text-discord-green' : ''} />
              <span>Voz & Microfone</span>
            </button>

            <button
              onClick={() => setActiveTab('loopback')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'loopback'
                  ? 'bg-[#35373c] text-white'
                  : 'text-discord-textMuted hover:bg-[#35373c]/40 hover:text-discord-textNormal'
              }`}
            >
              <ShieldCheck size={16} className={activeTab === 'loopback' ? 'text-discord-accent' : ''} />
              <span>Anti-Eco & Loopback</span>
            </button>

            <button
              onClick={() => setActiveTab('video')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'video'
                  ? 'bg-[#35373c] text-white'
                  : 'text-discord-textMuted hover:bg-[#35373c]/40 hover:text-discord-textNormal'
              }`}
            >
              <Cpu size={16} className={activeTab === 'video' ? 'text-discord-yellow' : ''} />
              <span>WebCodecs GPU (0xAA)</span>
            </button>

            {/* Diagnostic Logs Tab */}
            <div className="pt-2 pb-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-discord-textMuted px-2 py-1">
                Diagnóstico
              </div>
              <button
                onClick={() => setActiveTab('logs')}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'logs'
                    ? 'bg-[#35373c] text-white font-bold'
                    : 'text-discord-textMuted hover:bg-[#35373c]/40 hover:text-discord-textNormal'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Terminal size={16} className={activeTab === 'logs' ? 'text-discord-green' : 'text-discord-textMuted'} />
                  <span>Logs do App</span>
                </div>
                {logs.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#1e1f22] text-discord-green font-mono rounded-full">
                    {logs.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#1f2023] text-[10px] text-discord-textMuted">
            Versão v1.0.0 • 60 FPS
          </div>
        </div>

        {/* Right Tab Content Panel */}
        <div className="flex-1 flex flex-col justify-between bg-discord-chat overflow-y-auto">
          {/* Header */}
          <div className="p-6 pb-2 flex items-center justify-between border-b border-[#1f2023]">
            <h2 className="text-base font-bold text-discord-textHeader">
              {activeTab === 'connection' && 'Servidor & Conexão (.env)'}
              {activeTab === 'audio' && 'Configurações de Voz & Sensibilidade'}
              {activeTab === 'loopback' && 'Prevenção de Duplicação & Cancelamento de Eco'}
              {activeTab === 'video' && 'Aceleração GPU & Protocolo Binário (0xAA)'}
              {activeTab === 'logs' && 'Logs & Diagnóstico em Tempo Real'}
            </h2>
            <button
              onClick={onClose}
              className="text-discord-textMuted hover:text-white p-1 rounded transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 flex-1 overflow-y-auto">
            {/* Tab 1: Connection & .ENV */}
            {activeTab === 'connection' && (
              <div className="space-y-4 text-xs animate-fade-in">
                <div>
                  <label className="block font-semibold text-discord-textHeader mb-1">
                    URL Base da API REST (VITE_API_URL)
                  </label>
                  <input
                    type="text"
                    value={formData.apiUrl}
                    onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                    placeholder="https://archpixel.squareweb.app"
                    className="w-full bg-[#1e1f22] text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none font-mono"
                  />
                  <span className="text-[11px] text-discord-textMuted">
                    Rotas REST: /live-rooms, /verify-password, etc.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-discord-textHeader mb-1">
                    URL do WebSocket (VITE_WS_URL)
                  </label>
                  <input
                    type="text"
                    value={formData.wsUrl}
                    onChange={(e) => setFormData({ ...formData, wsUrl: e.target.value })}
                    placeholder="wss://archpixel.squareweb.app/ws/live-room"
                    className="w-full bg-[#1e1f22] text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none font-mono"
                  />
                  <span className="text-[11px] text-discord-textMuted">
                    Conexão em tempo real e relay binário (50 Bytes).
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-discord-textHeader mb-1">
                    Token JWT (Opcional - Backend Aberto)
                  </label>
                  <input
                    type="password"
                    value={formData.jwtToken}
                    onChange={(e) => setFormData({ ...formData, jwtToken: e.target.value })}
                    placeholder="Token JWT opcional..."
                    className="w-full bg-[#1e1f22] text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block font-semibold text-discord-textHeader mb-1">
                      Nome de Exibição
                    </label>
                    <input
                      type="text"
                      value={formData.userName}
                      onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                      className="w-full bg-[#1e1f22] text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-discord-textHeader mb-1">
                      URL do Avatar (Opcional)
                    </label>
                    <input
                      type="text"
                      value={formData.avatarUrl}
                      onChange={(e) => setFormData({ ...formData, avatarUrl: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-[#1e1f22] text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Audio & VAD */}
            {activeTab === 'audio' && (
              <div className="space-y-4 text-xs animate-fade-in">
                <div>
                  <label className="block font-semibold text-discord-textHeader mb-1">
                    Dispositivo de Entrada (Microfone)
                  </label>
                  <select
                    value={formData.selectedMicrophoneId || ''}
                    onChange={(e) => setFormData({ ...formData, selectedMicrophoneId: e.target.value })}
                    className="w-full bg-[#1e1f22] text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none"
                  >
                    <option value="">Padrão do Sistema</option>
                    {audioInputDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microfone (${d.deviceId.slice(0, 5)})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mic Volume Level Live Meter */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-discord-textHeader">
                      Teste de Entrada de Microfone (Live RMS)
                    </label>
                    <span className="text-[11px] font-mono text-discord-green">{micVolumeLevel}%</span>
                  </div>
                  <div className="w-full h-3 bg-[#1e1f22] rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-75 ${
                        micVolumeLevel > 30 ? 'bg-discord-green' : 'bg-discord-accent'
                      }`}
                      style={{ width: `${Math.min(100, micVolumeLevel)}%` }}
                    />
                  </div>
                </div>

                {/* VAD Sensitivity Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-discord-textHeader flex items-center gap-1.5">
                      <Sliders size={14} />
                      <span>Sensibilidade de Detecção de Voz (VAD): {formData.vadSensitivity}%</span>
                    </label>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={95}
                    value={formData.vadSensitivity}
                    onChange={(e) => setFormData({ ...formData, vadSensitivity: Number(e.target.value) })}
                    className="w-full accent-discord-green bg-[#1e1f22] rounded-lg cursor-pointer h-2"
                  />
                  <div className="flex justify-between text-[10px] text-discord-textMuted mt-1">
                    <span>Mais Sensível (Capta sussurros)</span>
                    <span>Menos Sensível (Corta ruídos)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Loopback & Echo Prevention */}
            {activeTab === 'loopback' && (
              <div className="space-y-3 text-xs animate-fade-in">
                <div className="p-3 bg-discord-accent/10 border border-discord-accent/30 rounded-lg flex items-start gap-2.5 text-discord-textNormal">
                  <Info size={18} className="text-discord-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block mb-0.5">Prevenção Total de Loopback & Duplicação de Volume:</strong>
                    Ao compartilhar a tela inteira com áudio do sistema, o aplicativo isola o som de saída dos outros participantes da chamada para que ninguém ouça o próprio eco ou duplicação.
                  </div>
                </div>

                <div className="p-3 bg-[#2b2d31] rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-discord-textHeader">Anti-Loopback do Compartilhamento</div>
                    <div className="text-[11px] text-discord-textMuted">
                      Filtra o áudio de quem está na call ao transmitir desktop/aplicações inteiras.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.preventScreenAudioLoopback}
                    onChange={(e) => setFormData({ ...formData, preventScreenAudioLoopback: e.target.checked })}
                    className="w-4 h-4 accent-discord-accent cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-[#2b2d31] rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-discord-textHeader">Cancelamento Acústico de Eco (AEC)</div>
                    <div className="text-[11px] text-discord-textMuted">
                      Elimina retorno sonoro do alto-falante para o microfone.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.echoCancellation}
                    onChange={(e) => setFormData({ ...formData, echoCancellation: e.target.checked })}
                    className="w-4 h-4 accent-discord-accent cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-[#2b2d31] rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-discord-textHeader">Supressão de Ruído de Fundo</div>
                    <div className="text-[11px] text-discord-textMuted">
                      Filtra barulhos de teclado, ventoinhas e estática.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.noiseSuppression}
                    onChange={(e) => setFormData({ ...formData, noiseSuppression: e.target.checked })}
                    className="w-4 h-4 accent-discord-accent cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Tab 4: WebCodecs Video & Binary Spec */}
            {activeTab === 'video' && (
              <div className="space-y-3 text-xs animate-fade-in">
                <div className="p-3 bg-[#2b2d31] rounded-lg space-y-2">
                  <div className="font-bold text-discord-textHeader flex items-center gap-2">
                    <Sparkles size={16} className="text-discord-yellow" />
                    <span>Protocolo Binário 0xAA (50 Bytes Header)</span>
                  </div>
                  <p className="text-discord-textMuted leading-relaxed">
                    O pipeline utiliza aceleração de hardware GPU (WebCodecs) transmitindo quadros H.264/VP8 e áudio PCM através de um cabeçalho fixo de 50 bytes via WebSocket com latência ultrabaixa (~30ms).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2.5 bg-[#1e1f22] rounded">
                    <div className="text-discord-accent font-bold">0x01 • VÍDEO GPU</div>
                    <div className="text-discord-textMuted">WebCodecs GPU Chunk (60 FPS)</div>
                  </div>
                  <div className="p-2.5 bg-[#1e1f22] rounded">
                    <div className="text-discord-green font-bold">0x05 • VOICE PCM</div>
                    <div className="text-discord-textMuted">Voz Int16 PCM (44.1 kHz)</div>
                  </div>
                  <div className="p-2.5 bg-[#1e1f22] rounded">
                    <div className="text-discord-yellow font-bold">0x02 • SCREEN AUDIO</div>
                    <div className="text-discord-textMuted">Áudio da Tela PCM Stereo</div>
                  </div>
                  <div className="p-2.5 bg-[#1e1f22] rounded">
                    <div className="text-purple-400 font-bold">0x03 / 0x04 • CONTROL</div>
                    <div className="text-discord-textMuted">Telemetria & Ping (~30ms)</div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Logs & Diagnóstico em Tempo Real */}
            {activeTab === 'logs' && (
              <div className="space-y-3 text-xs animate-fade-in flex flex-col h-full">
                {/* Action Bar & Category Filters */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-[#1f2023]">
                  <div className="flex items-center gap-1 overflow-x-auto text-[11px]">
                    {['ALL', 'WS-RX', 'WS-TX', 'AUDIO', 'VIDEO-GPU', 'ERROR', 'SYSTEM'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-2 py-1 rounded font-medium transition-colors ${
                          selectedCategory === cat
                            ? 'bg-discord-accent text-white'
                            : 'bg-[#1e1f22] text-discord-textMuted hover:text-white'
                        }`}
                      >
                        {cat === 'ALL' ? 'Todos' : cat}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-[11px] text-discord-textMuted cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                        className="accent-discord-accent"
                      />
                      <span>Auto-scroll</span>
                    </label>

                    <button
                      onClick={handleCopyLogs}
                      className="px-2.5 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-white text-[11px] font-semibold transition-colors flex items-center gap-1 border border-[#3f4147]"
                      title="Copiar logs completos"
                    >
                      {copiedLogs ? <Check size={12} className="text-discord-green" /> : <Copy size={12} />}
                      <span>{copiedLogs ? 'Copiado!' : 'Copiar'}</span>
                    </button>

                    <button
                      onClick={handleClearLogs}
                      className="p-1 rounded text-discord-textMuted hover:text-discord-red hover:bg-discord-red/10 transition-colors"
                      title="Limpar logs gravados"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Console Log Terminal Window */}
                <div
                  ref={logContainerRef}
                  className="flex-1 bg-[#111214] rounded-lg p-3 overflow-y-auto font-mono text-[11px] leading-relaxed border border-discord-border space-y-1 select-text max-h-[300px]"
                >
                  {filteredLogs.length === 0 ? (
                    <div className="text-center py-12 text-discord-textMuted">
                      Nenhum log gravado nesta categoria ainda.
                    </div>
                  ) : (
                    filteredLogs.map((entry) => {
                      let levelColor = 'text-discord-textNormal';
                      if (entry.level === 'ERROR') levelColor = 'text-discord-red font-bold';
                      else if (entry.level === 'SUCCESS') levelColor = 'text-discord-green font-semibold';
                      else if (entry.level === 'WARN') levelColor = 'text-discord-yellow';

                      let catBadge = 'bg-[#2b2d31] text-discord-textMuted';
                      if (entry.category === 'WS-TX') catBadge = 'bg-blue-900/40 text-blue-400 border border-blue-800/50';
                      else if (entry.category === 'WS-RX') catBadge = 'bg-cyan-900/40 text-cyan-400 border border-cyan-800/50';
                      else if (entry.category === 'AUDIO') catBadge = 'bg-emerald-900/40 text-emerald-400 border border-emerald-800/50';
                      else if (entry.category === 'VIDEO-GPU') catBadge = 'bg-purple-900/40 text-purple-400 border border-purple-800/50';
                      else if (entry.category === 'ERROR') catBadge = 'bg-rose-900/40 text-rose-400 border border-rose-800/50';

                      return (
                        <div key={entry.id} className="flex items-start gap-2 hover:bg-[#1e1f22]/60 p-0.5 rounded">
                          <span className="text-discord-textMuted text-[10px] flex-shrink-0">
                            {entry.timestamp}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase flex-shrink-0 ${catBadge}`}>
                            {entry.category}
                          </span>
                          <span className={`flex-1 break-all ${levelColor}`}>
                            {entry.message}
                            {entry.data && (
                              <span className="text-discord-textMuted block text-[10px] mt-0.5">
                                {typeof entry.data === 'object' ? JSON.stringify(entry.data) : String(entry.data)}
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer Save Actions */}
          <div className="p-4 bg-[#2b2d31] border-t border-[#1f2023] flex items-center justify-between">
            <div>
              {showSavedToast && (
                <div className="flex items-center gap-1.5 text-xs text-discord-green font-medium animate-fade-in">
                  <CheckCircle2 size={16} />
                  <span>Configurações salvas com sucesso!</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded text-xs font-medium text-discord-textNormal hover:underline transition-colors"
              >
                Fechar
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 rounded text-xs font-semibold bg-discord-accent hover:bg-discord-accentHover text-white transition-colors flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
