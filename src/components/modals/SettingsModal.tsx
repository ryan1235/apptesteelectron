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
  Play,
  Square,
  Activity,
  Headphones,
  Gamepad2,
  Keyboard,
} from 'lucide-react';
import { AppConfig } from '../../types/live-room';
import { logger, LogEntry, LogCategory } from '../../services/logger';
import { AudioManager } from '../../services/audioManager';

interface SettingsModalProps {
  isOpen: boolean;
  config: AppConfig;
  micVolumeLevel: number;
  audioManager?: AudioManager;
  onClose: () => void;
  onSaveConfig: (config: AppConfig) => void;
}

type TabType = 'connection' | 'audio' | 'overlay' | 'loopback' | 'video' | 'logs';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  config,
  micVolumeLevel,
  audioManager,
  onClose,
  onSaveConfig,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('connection');
  const [formData, setFormData] = useState<AppConfig>({ ...config });
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);

  // Logs Tab State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedLogs, setCopiedLogs] = useState<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setFormData({ ...config });
  }, [config, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      if (isTestingMic && audioManager) {
        audioManager.stopMicTest();
        setIsTestingMic(false);
      }
      return;
    }

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
      if (audioManager) {
        audioManager.stopMicTest();
      }
    };
  }, [isOpen]);

  // Live Oscilloscope Waveform Animation
  useEffect(() => {
    if (!isOpen || activeTab !== 'audio' || !audioManager) return;
    let animationFrameId: number;

    const canvas = waveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = audioManager.getAnalyser();
    const bufferLength = analyser?.frequencyBinCount || 256;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameId = requestAnimationFrame(draw);

      if (analyser) {
        analyser.getByteTimeDomainData(dataArray);
      } else {
        dataArray.fill(128);
      }

      ctx.fillStyle = '#111214';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Grid / Center line
      ctx.strokeStyle = '#232428';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Draw Waveform
      ctx.lineWidth = 2;
      ctx.strokeStyle = micVolumeLevel > (100 - formData.vadSensitivity) ? '#23a55a' : '#5865F2';
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 4;
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen, activeTab, audioManager, micVolumeLevel, formData.vadSensitivity]);

  useEffect(() => {
    if (activeTab === 'logs' && autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, activeTab, autoScroll]);

  if (!isOpen) return null;

  const handleToggleMicTest = async () => {
    if (!audioManager) return;
    if (isTestingMic) {
      audioManager.stopMicTest();
      setIsTestingMic(false);
    } else {
      await audioManager.startMicTest();
      setIsTestingMic(true);
    }
  };

  const handleSave = () => {
    if (isTestingMic && audioManager) {
      audioManager.stopMicTest();
      setIsTestingMic(false);
    }
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
      <div className="w-full max-w-3xl bg-discord-chat rounded-xl shadow-2xl border border-discord-border flex overflow-hidden h-[600px]">
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
              <span>Voz, DSP & Teste</span>
            </button>

            <button
              onClick={() => setActiveTab('overlay')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                activeTab === 'overlay'
                  ? 'bg-[#35373c] text-white font-bold'
                  : 'text-discord-textMuted hover:bg-[#35373c]/40 hover:text-discord-textNormal'
              }`}
            >
              <Gamepad2 size={16} className={activeTab === 'overlay' ? 'text-discord-green' : ''} />
              <span>In-Game Overlay & Atalhos</span>
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
            Versão v1.0.0 • Studio DSP & Overlay
          </div>
        </div>

        {/* Right Tab Content Panel */}
        <div className="flex-1 flex flex-col justify-between bg-discord-chat overflow-y-auto">
          {/* Header */}
          <div className="p-6 pb-2 flex items-center justify-between border-b border-[#1f2023]">
            <h2 className="text-base font-bold text-discord-textHeader">
              {activeTab === 'connection' && 'Servidor & Conexão (.env)'}
              {activeTab === 'audio' && 'Microfone, DSP Anti-Ruído & Teste de Voz'}
              {activeTab === 'overlay' && 'In-Game Discord Overlay & Atalhos Globais'}
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

            {/* Tab 2: Audio, DSP & Mic Test */}
            {activeTab === 'audio' && (
              <div className="space-y-4 text-xs animate-fade-in">
                {/* Device Selectors & Volumes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-discord-textHeader mb-1 flex items-center gap-1">
                      <Mic size={13} className="text-discord-green" />
                      <span>Dispositivo de Entrada</span>
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

                  <div>
                    <label className="block font-semibold text-discord-textHeader mb-1 flex items-center gap-1">
                      <Volume2 size={13} className="text-discord-accent" />
                      <span>Dispositivo de Saída</span>
                    </label>
                    <select
                      value={formData.selectedSpeakerId || ''}
                      onChange={(e) => setFormData({ ...formData, selectedSpeakerId: e.target.value })}
                      className="w-full bg-[#1e1f22] text-discord-textNormal rounded px-3 py-2 border border-transparent focus:border-discord-accent focus:outline-none"
                    >
                      <option value="">Padrão do Sistema</option>
                      {audioOutputDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Alto-falantes (${d.deviceId.slice(0, 5)})`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Volumes Sliders */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#1e1f22] rounded-xl border border-discord-border">
                  <div>
                    <div className="flex justify-between items-center mb-1 text-[11px]">
                      <span className="font-semibold text-discord-textHeader">Volume de Entrada (Mic)</span>
                      <span className="font-mono text-discord-green font-bold">{formData.inputVolume || 100}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={formData.inputVolume || 100}
                      onChange={(e) => setFormData({ ...formData, inputVolume: Number(e.target.value) })}
                      className="w-full accent-discord-green bg-[#111214] rounded-lg cursor-pointer h-1.5"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1 text-[11px]">
                      <span className="font-semibold text-discord-textHeader">Volume de Saída (Master)</span>
                      <span className="font-mono text-discord-accent font-bold">{formData.outputVolume || 100}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={formData.outputVolume || 100}
                      onChange={(e) => setFormData({ ...formData, outputVolume: Number(e.target.value) })}
                      className="w-full accent-discord-accent bg-[#111214] rounded-lg cursor-pointer h-1.5"
                    />
                  </div>
                </div>

                {/* Oscilloscope Waveform & Mic Loopback Test Card */}
                <div className="p-3 bg-[#1e1f22] rounded-xl border border-discord-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-discord-green" />
                      <span className="font-bold text-discord-textHeader">Osciloscópio & Teste de Áudio</span>
                    </div>

                    <button
                      onClick={handleToggleMicTest}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        isTestingMic
                          ? 'bg-discord-red hover:bg-discord-red/90 text-white animate-pulse'
                          : 'bg-discord-accent hover:bg-discord-accentHover text-white'
                      }`}
                    >
                      {isTestingMic ? <Square size={13} /> : <Headphones size={13} />}
                      <span>{isTestingMic ? 'Parar Teste' : 'Testar Microfone (Ouvir voz)'}</span>
                    </button>
                  </div>

                  {/* Waveform Canvas */}
                  <div className="w-full h-14 rounded-lg overflow-hidden border border-[#2b2d31]">
                    <canvas
                      ref={waveCanvasRef}
                      width={500}
                      height={56}
                      className="w-full h-full block bg-[#111214]"
                    />
                  </div>

                  {/* Live RMS Meter */}
                  <div>
                    <div className="flex justify-between items-center mb-1 text-[11px]">
                      <span className="text-discord-textMuted">Nível de Entrada (Live VU Meter)</span>
                      <span className="font-mono text-discord-green font-bold">{micVolumeLevel}%</span>
                    </div>
                    <div className="relative w-full h-2.5 bg-[#111214] rounded-full overflow-hidden p-0.5 border border-[#2b2d31]">
                      <div
                        className={`h-full rounded-full transition-all duration-75 ${
                          micVolumeLevel > (formData.autoSensitivity ? 25 : 100 - formData.vadSensitivity)
                            ? 'bg-discord-green shadow-sm'
                            : 'bg-discord-accent'
                        }`}
                        style={{ width: `${Math.min(100, micVolumeLevel)}%` }}
                      />
                      {/* Threshold Marker */}
                      {!formData.autoSensitivity && (
                        <div
                          className="absolute top-0 bottom-0 w-1 bg-discord-yellow rounded-full"
                          style={{ left: `${Math.max(0, Math.min(100, 100 - formData.vadSensitivity))}%` }}
                          title="Ponto de corte do Noise Gate"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Input Sensitivity (Auto vs Manual) */}
                <div className="p-3 bg-[#1e1f22] rounded-xl border border-discord-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-bold text-discord-textHeader block">
                        Sensibilidade de Entrada
                      </label>
                      <span className="text-[11px] text-discord-textMuted">
                        Detectar automaticamente quando você está falando ou ajustar o ponto de corte manualmente.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, autoSensitivity: !formData.autoSensitivity })}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        formData.autoSensitivity ? 'bg-discord-green justify-end' : 'bg-[#35373c] justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-white">
                      {formData.autoSensitivity ? '✅ Automática (Recomendada)' : '⚙️ Ajuste Manual'}
                    </span>
                  </div>

                  {!formData.autoSensitivity && (
                    <div className="pt-1 space-y-1">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-discord-textMuted">Limiar de Ativação: {formData.vadSensitivity}%</span>
                        <span className="text-[10px] text-discord-yellow">Linha amarela no medidor</span>
                      </div>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={formData.vadSensitivity}
                        onChange={(e) => setFormData({ ...formData, vadSensitivity: Number(e.target.value) })}
                        className="w-full accent-discord-green bg-[#111214] rounded-lg cursor-pointer h-2"
                      />
                    </div>
                  )}
                </div>

                {/* Advanced Audio Processing Toggles */}
                <div className="space-y-2">
                  <span className="font-bold text-discord-textHeader uppercase tracking-wider text-[11px] block">
                    Processamento Avançado de Voz
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* IA RNNoise */}
                    <div
                      onClick={() => setFormData({ ...formData, rnnoiseSuppression: !formData.rnnoiseSuppression })}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        formData.rnnoiseSuppression
                          ? 'bg-discord-green/10 border-discord-green/50 text-white'
                          : 'bg-[#1e1f22] border-[#2e3035] text-discord-textMuted'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">IA RNNoise</span>
                        <div className={`w-2 h-2 rounded-full ${formData.rnnoiseSuppression ? 'bg-discord-green' : 'bg-gray-600'}`} />
                      </div>
                      <span className="text-[10px] block leading-tight">Rede neural anti-ruído</span>
                    </div>

                    {/* Noise Suppression */}
                    <div
                      onClick={() => setFormData({ ...formData, noiseSuppression: !formData.noiseSuppression })}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        formData.noiseSuppression
                          ? 'bg-discord-green/10 border-discord-green/50 text-white'
                          : 'bg-[#1e1f22] border-[#2e3035] text-discord-textMuted'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">Redução Passa-Faixa</span>
                        <div className={`w-2 h-2 rounded-full ${formData.noiseSuppression ? 'bg-discord-green' : 'bg-gray-600'}`} />
                      </div>
                      <span className="text-[10px] block leading-tight">Filtra teclado mecânico</span>
                    </div>

                    {/* Echo Cancellation */}
                    <div
                      onClick={() => setFormData({ ...formData, echoCancellation: !formData.echoCancellation })}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        formData.echoCancellation
                          ? 'bg-discord-green/10 border-discord-green/50 text-white'
                          : 'bg-[#1e1f22] border-[#2e3035] text-discord-textMuted'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">Cancelamento de Eco</span>
                        <div className={`w-2 h-2 rounded-full ${formData.echoCancellation ? 'bg-discord-green' : 'bg-gray-600'}`} />
                      </div>
                      <span className="text-[10px] block leading-tight">Sem retorno de fone/caixa</span>
                    </div>

                    {/* Auto Gain Control */}
                    <div
                      onClick={() => setFormData({ ...formData, autoGainControl: !formData.autoGainControl })}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                        formData.autoGainControl
                          ? 'bg-discord-green/10 border-discord-green/50 text-white'
                          : 'bg-[#1e1f22] border-[#2e3035] text-discord-textMuted'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs">Ganho Automático</span>
                        <div className={`w-2 h-2 rounded-full ${formData.autoGainControl ? 'bg-discord-green' : 'bg-gray-600'}`} />
                      </div>
                      <span className="text-[10px] block leading-tight">Nivela volume das vozes</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: In-Game Overlay & Global Hotkeys */}
            {activeTab === 'overlay' && (
              <div className="space-y-4 text-xs animate-fade-in">
                {/* 1. Main Toggle */}
                <div className="p-3 bg-[#1e1f22] rounded-xl border border-discord-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-discord-textHeader block">
                        In-Game Overlay Flutuante para Jogos
                      </span>
                      <span className="text-[11px] text-discord-textMuted">
                        Exibe quem fala, mini-chat e picture-in-picture de tela por cima de jogos exclusivos.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, enableInGameOverlay: !formData.enableInGameOverlay })}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        formData.enableInGameOverlay ? 'bg-discord-green justify-end' : 'bg-[#35373c] justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                    </button>
                  </div>

                  {formData.enableInGameOverlay && (
                    <div className="pt-3 border-t border-[#2b2d31] space-y-4">
                      {/* Voice Avatars Position & Mode */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-discord-textHeader block">
                            🎙️ Avatares de Voz (Quem está falando)
                          </label>
                          {/* Mode Toggle */}
                          <div className="flex rounded-lg bg-[#2b2d31] p-0.5 border border-white/5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, overlayVoiceMode: 'speaking_only' })}
                              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                                formData.overlayVoiceMode === 'speaking_only'
                                  ? 'bg-discord-accent text-white'
                                  : 'text-discord-textMuted hover:text-white'
                              }`}
                            >
                              Só quem fala (Discreto)
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, overlayVoiceMode: 'all' })}
                              className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                                formData.overlayVoiceMode === 'all'
                                  ? 'bg-discord-accent text-white'
                                  : 'text-discord-textMuted hover:text-white'
                              }`}
                            >
                              Todos os participantes
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { id: 'top-left', label: '↖ Sup. Esq.' },
                            { id: 'top-right', label: '↗ Sup. Dir.' },
                            { id: 'bottom-left', label: '↙ Inf. Esq.' },
                            { id: 'bottom-right', label: '↘ Inf. Dir.' },
                          ].map((pos) => (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, overlayVoicePosition: pos.id as any })}
                              className={`p-2 rounded-lg border text-center font-semibold transition-all text-[11px] ${
                                formData.overlayVoicePosition === pos.id
                                  ? 'bg-discord-accent/20 border-discord-accent text-white shadow'
                                  : 'bg-[#2b2d31] border-[#383a40] text-discord-textMuted hover:text-white'
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Screen Share PIP Player */}
                      <div className="space-y-2 pt-2 border-t border-[#2b2d31]">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-discord-textHeader block">
                            📺 PIP de Compartilhamento de Tela (Assistir amigos no jogo)
                          </label>
                          <input
                            type="checkbox"
                            checked={formData.overlayShowPip !== false}
                            onChange={(e) => setFormData({ ...formData, overlayShowPip: e.target.checked })}
                            className="w-4 h-4 accent-discord-accent cursor-pointer"
                          />
                        </div>

                        {formData.overlayShowPip !== false && (
                          <>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { id: 'top-left', label: '↖ Sup. Esq.' },
                                { id: 'top-right', label: '↗ Sup. Dir. (Padrão)' },
                                { id: 'bottom-left', label: '↙ Inf. Esq.' },
                                { id: 'bottom-right', label: '↘ Inf. Dir.' },
                              ].map((pos) => (
                                <button
                                  key={pos.id}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, overlayPipPosition: pos.id as any })}
                                  className={`p-2 rounded-lg border text-center font-semibold transition-all text-[11px] ${
                                    formData.overlayPipPosition === pos.id
                                      ? 'bg-discord-accent/20 border-discord-accent text-white shadow'
                                      : 'bg-[#2b2d31] border-[#383a40] text-discord-textMuted hover:text-white'
                                  }`}
                                >
                                  {pos.label}
                                </button>
                              ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="text-[11px] text-discord-textMuted block mb-1">
                                  Tamanho do Player PIP:
                                </label>
                                <div className="flex rounded-lg bg-[#2b2d31] p-0.5 border border-white/5 text-[11px]">
                                  {[
                                    { id: 'small', label: 'Pequeno (240p)' },
                                    { id: 'medium', label: 'Médio (360p)' },
                                    { id: 'large', label: 'Grande (480p)' },
                                  ].map((sz) => (
                                    <button
                                      key={sz.id}
                                      type="button"
                                      onClick={() => setFormData({ ...formData, overlayPipSize: sz.id as any })}
                                      className={`flex-1 py-1 rounded text-center font-medium transition-colors ${
                                        formData.overlayPipSize === sz.id
                                          ? 'bg-discord-accent text-white font-bold'
                                          : 'text-discord-textMuted hover:text-white'
                                      }`}
                                    >
                                      {sz.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <div className="flex justify-between items-center text-[11px] mb-1">
                                  <span className="text-discord-textMuted">Opacidade do Vídeo:</span>
                                  <span className="text-discord-green font-mono font-bold">
                                    {formData.overlayPipOpacity || 90}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min={20}
                                  max={100}
                                  value={formData.overlayPipOpacity || 90}
                                  onChange={(e) =>
                                    setFormData({ ...formData, overlayPipOpacity: Number(e.target.value) })
                                  }
                                  className="w-full accent-discord-green bg-[#111214] rounded-lg cursor-pointer h-2"
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Chat Toast Position */}
                      <div className="space-y-2 pt-2 border-t border-[#2b2d31]">
                        <label className="font-bold text-discord-textHeader block">
                          💬 Notificações de Chat (Toast Popups)
                        </label>
                        <div className="grid grid-cols-4 gap-1.5">
                          {[
                            { id: 'top-left', label: '↖ Sup. Esq.' },
                            { id: 'top-right', label: '↗ Sup. Dir.' },
                            { id: 'bottom-left', label: '↙ Inf. Esq. (Padrão)' },
                            { id: 'bottom-right', label: '↘ Inf. Dir.' },
                          ].map((pos) => (
                            <button
                              key={pos.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, overlayChatPosition: pos.id as any })}
                              className={`p-2 rounded-lg border text-center font-semibold transition-all text-[11px] ${
                                formData.overlayChatPosition === pos.id
                                  ? 'bg-discord-accent/20 border-discord-accent text-white shadow'
                                  : 'bg-[#2b2d31] border-[#383a40] text-discord-textMuted hover:text-white'
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Global Hotkeys Guide */}
                <div className="p-3 bg-[#1e1f22] rounded-xl border border-discord-border space-y-2.5">
                  <span className="font-bold text-discord-textHeader flex items-center gap-1.5">
                    <Keyboard size={15} className="text-discord-accent" />
                    <span>Atalhos de Teclado Globais (Funcionam dentro de jogos)</span>
                  </span>

                  <div className="space-y-1.5 pt-1">
                    {[
                      { key: 'Ctrl + Shift + M', action: 'Mutar / Desmutar Microfone' },
                      { key: 'Ctrl + Shift + D', action: 'Ativar / Desativar Ensurdecer' },
                      { key: 'Ctrl + Shift + O', action: 'Exibir / Ocultar In-Game Overlay' },
                      { key: 'Ctrl + Shift + S', action: 'Iniciar / Parar Compartilhamento de Tela' },
                    ].map((hk) => (
                      <div
                        key={hk.key}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#2b2d31] border border-[#383a40]"
                      >
                        <span className="text-discord-textNormal font-medium">{hk.action}</span>
                        <kbd className="px-2 py-0.5 rounded bg-[#1e1f22] text-discord-yellow font-mono text-[11px] border border-white/10 shadow-inner">
                          {hk.key}
                        </kbd>
                      </div>
                    ))}
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
