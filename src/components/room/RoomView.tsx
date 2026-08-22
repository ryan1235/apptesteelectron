import React, { useState, useEffect } from 'react';
import {
  RoomDetails,
  Participant,
  PresenterInfo,
  TelemetryStats,
  QualityProfile,
  ChatMessage,
  FloatingReaction,
} from '../../types/live-room';
import { ScreenStage } from './ScreenStage';
import { ParticipantGrid } from './ParticipantGrid';
import { ChatSidebar } from './ChatSidebar';
import { ControlsBar } from './ControlsBar';
import { FloatingReactionsOverlay } from './FloatingReactionsOverlay';
import { Monitor, Volume2, ShieldCheck, Sparkles } from 'lucide-react';

interface RoomViewProps {
  room: RoomDetails;
  participants: Participant[];
  activePresenter: PresenterInfo | null;
  currentUserId: string;
  telemetry: TelemetryStats;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  localStream: MediaStream | null;
  isMicMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  activeProfile: QualityProfile;
  messages: ChatMessage[];
  typingUsers: string[];
  reactions: FloatingReaction[];
  onRequestKeyframe: () => void;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onChangeProfile: (profile: QualityProfile) => void;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onTyping: (isTyping: boolean) => void;
  onLeaveRoom: () => void;
  onSetUserVolume: (userId: string, volume: number) => void;
}

export const RoomView: React.FC<RoomViewProps> = ({
  room,
  participants,
  activePresenter,
  currentUserId,
  telemetry,
  canvasRef,
  localStream,
  isMicMuted,
  isDeafened,
  isScreenSharing,
  activeProfile,
  messages,
  typingUsers,
  reactions,
  onRequestKeyframe,
  onToggleMic,
  onToggleDeafen,
  onToggleScreenShare,
  onChangeProfile,
  onSendMessage,
  onSendReaction,
  onTyping,
  onLeaveRoom,
  onSetUserVolume,
}) => {
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevMessagesLengthRef = React.useRef(messages.length);

  // Track unread messages when chat is closed
  useEffect(() => {
    if (isChatOpen) {
      setUnreadCount(0);
    } else if (messages.length > prevMessagesLengthRef.current) {
      const newCount = messages.length - prevMessagesLengthRef.current;
      setUnreadCount((prev) => prev + newCount);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isChatOpen]);

  const hasActiveScreenShare = Boolean(activePresenter || isScreenSharing);
  const isLocalUserPresenter = isScreenSharing;

  return (
    <div className="flex-1 flex flex-col h-full bg-discord-chat overflow-hidden select-none relative">
      {/* Real-time Floating Reactions Stream */}
      <FloatingReactionsOverlay reactions={reactions} />

      {/* Top Header Bar */}
      <div className="h-14 px-5 flex items-center justify-between border-b border-[#1f2023] bg-[#1e1f22]/90 backdrop-blur-md shadow-sm z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-discord-green/10 flex items-center justify-center text-discord-green">
              <Volume2 size={18} />
            </div>
            <h1 className="font-bold text-sm text-discord-textHeader truncate">
              {room.title}
            </h1>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-discord-textMuted border-l border-[#3f4147] pl-3">
            <ShieldCheck size={14} className="text-discord-accent" />
            <span>Anti-Eco & DSP Studio Ativo</span>
          </div>
        </div>

        {/* Presenter Status Badge */}
        {hasActiveScreenShare && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-discord-accent/15 border border-discord-accent/30 text-discord-accent text-xs font-semibold animate-fade-in shadow-sm">
            <Monitor size={14} className="animate-pulse" />
            <span>
              {isLocalUserPresenter
                ? 'Você está transmitindo tela (GPU)'
                : `${activePresenter?.userName} está transmitindo (${activePresenter?.qualityProfile || '60 FPS'})`}
            </span>
          </div>
        )}
      </div>

      {/* Main Center Content (Stage / Participants + Chat) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Video Stage or Participant Cards */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {hasActiveScreenShare ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* WebCodecs GPU Stage Canvas / Local Preview */}
              <div className="flex-1 min-h-0 relative">
                <ScreenStage
                  presenter={activePresenter}
                  canvasRef={canvasRef}
                  localStream={localStream}
                  telemetry={telemetry}
                  onRequestKeyframe={onRequestKeyframe}
                  isLocalUserPresenter={isLocalUserPresenter}
                />
              </div>

              {/* Bottom Mini Participant Strip */}
              <div className="h-32 bg-[#1e1f22]/90 border-t border-[#1f2023] overflow-x-auto flex items-center p-2 backdrop-blur-sm">
                <ParticipantGrid
                  participants={participants}
                  currentUserId={currentUserId}
                  onSetUserVolume={onSetUserVolume}
                />
              </div>
            </div>
          ) : (
            // Full Participant Grid when no screen share is active
            <div className="flex-1 flex flex-col justify-center bg-discord-chat overflow-y-auto p-4">
              <ParticipantGrid
                participants={participants}
                currentUserId={currentUserId}
                onSetUserVolume={onSetUserVolume}
              />
            </div>
          )}
        </div>

        {/* Right Chat Sidebar */}
        {isChatOpen && (
          <ChatSidebar
            roomTitle={room.title}
            messages={messages}
            currentUserId={currentUserId}
            typingUsers={typingUsers}
            onSendMessage={onSendMessage}
            onSendReaction={onSendReaction}
            onTyping={onTyping}
          />
        )}
      </div>

      {/* Bottom Voice & Video Controls Bar */}
      <ControlsBar
        isMicMuted={isMicMuted}
        isDeafened={isDeafened}
        isScreenSharing={isScreenSharing}
        activeProfile={activeProfile}
        isChatOpen={isChatOpen}
        unreadCount={unreadCount}
        onToggleMic={onToggleMic}
        onToggleDeafen={onToggleDeafen}
        onToggleScreenShare={onToggleScreenShare}
        onChangeProfile={onChangeProfile}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onLeaveRoom={onLeaveRoom}
      />
    </div>
  );
};
