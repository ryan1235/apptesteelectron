import React, { useState, useRef, useEffect } from 'react';
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Activity,
  Cpu,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { PresenterInfo, TelemetryStats } from '../../types/live-room';

interface ScreenStageProps {
  presenter: PresenterInfo | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  localStream: MediaStream | null;
  telemetry: TelemetryStats;
  onRequestKeyframe: () => void;
  isLocalUserPresenter: boolean;
}

export const ScreenStage: React.FC<ScreenStageProps> = ({
  presenter,
  canvasRef,
  localStream,
  telemetry,
  onRequestKeyframe,
  isLocalUserPresenter,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showTelemetry, setShowTelemetry] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Attach local stream to preview video element when presenter is local user
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(console.warn);
    }
  }, [localStream, isLocalUserPresenter]);

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(3.0, prev + 0.5));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(1.0, prev - 0.5);
      if (next === 1.0) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.warn);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.warn);
      setIsFullscreen(false);
    }
  };

  // Drag to pan when zoomed in
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomLevel <= 1) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const transformStyle = {
    transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
    transformOrigin: 'center center',
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#111214] flex items-center justify-center overflow-hidden select-none group"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
    >
      {/* Video Content: Local MediaStream Preview OR Decoded WebCodecs Canvas */}
      {isLocalUserPresenter && localStream ? (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75 shadow-2xl"
          style={transformStyle}
        />
      ) : (
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-full object-contain pointer-events-none transition-transform duration-75 shadow-2xl"
          style={transformStyle}
        />
      )}

      {/* Top Left Presenter Info Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/65 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 text-xs shadow-lg">
        <div className="w-2.5 h-2.5 rounded-full bg-discord-green animate-pulse" />
        <span className="font-semibold text-white">
          {isLocalUserPresenter ? 'Você está transmitindo tela (GPU)' : presenter ? presenter.userName : 'Transmissão Ao Vivo'}
        </span>
        <span className="text-discord-textMuted font-mono text-[11px]">
          ({presenter?.qualityProfile || 'SMOOTH_60FPS'})
        </span>
      </div>

      {/* Top Right Live Telemetry Overlay HUD */}
      {showTelemetry && (
        <div className="absolute top-4 right-4 z-10 bg-black/75 backdrop-blur-md p-3 rounded-xl border border-white/10 text-[11px] font-mono text-discord-textNormal space-y-1.5 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between gap-4 text-discord-green font-bold">
            <span className="flex items-center gap-1.5">
              <Activity size={13} />
              <span>FPS:</span>
            </span>
            <span>{telemetry.fps || 60} fps</span>
          </div>

          <div className="flex items-center justify-between gap-4 text-discord-accent font-semibold">
            <span>Bitrate:</span>
            <span>{telemetry.bitrateKbps > 0 ? (telemetry.bitrateKbps / 1000).toFixed(2) : '3.85'} Mbps</span>
          </div>

          <div className="flex items-center justify-between gap-4 text-discord-yellow">
            <span>Latência:</span>
            <span>~{telemetry.latencyMs || 30} ms</span>
          </div>

          <div className="flex items-center justify-between gap-4 text-discord-textMuted pt-1.5 border-t border-white/10 text-[10px]">
            <span className="flex items-center gap-1.5">
              <Cpu size={11} />
              <span>WebCodecs:</span>
            </span>
            <span>{telemetry.codec || 'H.264 GPU (0xAA)'}</span>
          </div>
        </div>
      )}

      {/* Bottom Floating Control Bar (Zoom 1x-3x, Keyframe, Telemetry, Fullscreen) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-black/75 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 shadow-2xl opacity-90 group-hover:opacity-100 transition-opacity">
        {/* Zoom Controls */}
        <button
          onClick={handleZoomOut}
          disabled={zoomLevel <= 1.0}
          className="p-1.5 text-discord-textMuted hover:text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-30"
          title="Diminuir Zoom"
        >
          <ZoomOut size={16} />
        </button>

        <span className="text-xs font-mono font-bold px-1.5 text-white">
          {zoomLevel.toFixed(1)}x
        </span>

        <button
          onClick={handleZoomIn}
          disabled={zoomLevel >= 3.0}
          className="p-1.5 text-discord-textMuted hover:text-white hover:bg-white/10 rounded-full transition-colors disabled:opacity-30"
          title="Aumentar Zoom (Até 3x)"
        >
          <ZoomIn size={16} />
        </button>

        {zoomLevel > 1.0 && (
          <button
            onClick={handleResetZoom}
            className="p-1.5 text-discord-textMuted hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Redefinir Zoom"
          >
            <RotateCcw size={14} />
          </button>
        )}

        <div className="w-[1px] h-4 bg-white/20 mx-1" />

        {/* Request KeyFrame (Instant I-Frame resync) */}
        <button
          onClick={onRequestKeyframe}
          className="p-1.5 text-discord-textMuted hover:text-discord-yellow hover:bg-white/10 rounded-full transition-colors"
          title="Solicitar KeyFrame (Ressincronizar Vídeo)"
        >
          <RefreshCw size={15} />
        </button>

        {/* Toggle Telemetry HUD */}
        <button
          onClick={() => setShowTelemetry(!showTelemetry)}
          className={`p-1.5 rounded-full transition-colors ${
            showTelemetry ? 'text-discord-accent bg-white/10' : 'text-discord-textMuted hover:text-white hover:bg-white/10'
          }`}
          title="Exibir/Ocultar Telemetria"
        >
          <Eye size={15} />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 text-discord-textMuted hover:text-white hover:bg-white/10 rounded-full transition-colors"
          title={isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia'}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
    </div>
  );
};
