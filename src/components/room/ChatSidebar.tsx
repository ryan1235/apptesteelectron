import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Hash, Smile, Flame, Heart, ThumbsUp, Sparkles, Rocket, Lightbulb, PartyPopper } from 'lucide-react';
import { ChatMessage } from '../../types/live-room';

interface ChatSidebarProps {
  roomTitle: string;
  messages: ChatMessage[];
  currentUserId: string;
  typingUsers: string[];
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onTyping: (isTyping: boolean) => void;
}

const QUICK_EMOJIS = ['🔥', '👏', '❤️', '😂', '👍', '🚀', '💡', '🎉'];

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  roomTitle,
  messages,
  currentUserId,
  typingUsers,
  onSendMessage,
  onSendReaction,
  onTyping,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    // Typing throttle / debounce
    onTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  return (
    <div className="w-80 bg-discord-chat flex flex-col h-full select-none border-l border-[#1f2023] z-20">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-[#1f2023] font-bold text-discord-textHeader shadow-sm bg-[#1e1f22]/60">
        <div className="flex items-center gap-2 min-w-0">
          <Hash size={18} className="text-discord-textMuted flex-shrink-0" />
          <span className="truncate text-sm font-bold">{roomTitle}</span>
        </div>
        <span className="text-[11px] px-2 py-0.5 rounded bg-discord-accent/15 text-discord-accent font-semibold">
          Chat
        </span>
      </div>

      {/* Messages Stream (Discord Flow) */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-discord-textMuted text-xs space-y-2 py-8">
            <div className="w-12 h-12 rounded-2xl bg-[#232428] flex items-center justify-center text-discord-accent shadow-inner">
              <MessageSquare size={22} />
            </div>
            <p className="font-bold text-discord-textHeader text-sm">Início do canal #{roomTitle}</p>
            <p className="text-[11px] text-discord-textMuted max-w-[200px]">
              Envie uma mensagem ou solte uma reação rápida abaixo!
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isMe = msg.userId === currentUserId;

            // Group consecutive messages by same user within 2 minutes
            const isSameUser = prevMsg && (prevMsg.userId === msg.userId || prevMsg.userName === msg.userName);
            const timeDiff = prevMsg ? Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime()) : 999999;
            const isCompact = isSameUser && timeDiff < 120000;

            let timeFormatted = '';
            try {
              timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
            } catch (e) {
              timeFormatted = '';
            }

            if (isCompact) {
              return (
                <div
                  key={msg.id || index}
                  className="hover:bg-[#2e3035]/50 px-3 py-0.5 rounded-lg -mx-2 transition-colors flex items-center group"
                >
                  <span className="text-[10px] text-transparent group-hover:text-discord-textMuted w-9 text-right pr-3 flex-shrink-0 font-mono select-none">
                    {timeFormatted}
                  </span>
                  <div className="text-[13px] text-[#dbdee1] leading-relaxed break-words select-text flex-1">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id || index}
                className="hover:bg-[#2e3035]/50 px-3 py-1.5 rounded-xl -mx-2 transition-colors flex items-start gap-3 mt-2 group"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-xs overflow-hidden flex-shrink-0 mt-0.5 shadow-sm ${
                    isMe ? 'bg-discord-accent ring-2 ring-discord-accent/40' : 'bg-[#35373c]'
                  }`}
                >
                  {msg.avatarUrl ? (
                    <img src={msg.avatarUrl} alt={msg.userName} className="w-full h-full object-cover" />
                  ) : (
                    (msg.userName || 'U').substring(0, 2).toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-[13px] font-bold truncate hover:underline cursor-pointer ${
                        isMe ? 'text-discord-accent' : 'text-white'
                      }`}
                    >
                      {msg.userName} {isMe && <span className="text-discord-textMuted text-[10px] font-normal">(Você)</span>}
                    </span>
                    <span className="text-[10px] text-discord-textMuted font-mono">
                      {timeFormatted}
                    </span>
                  </div>
                  <div className="text-[13px] text-[#dbdee1] mt-0.5 leading-relaxed break-words select-text">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Real-time Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-discord-textMuted px-2 py-1 bg-[#1e1f22]/90 rounded-lg animate-pulse border border-[#2b2d31]">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-[11px] font-medium truncate">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'está digitando...' : 'estão digitando...'}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Emoji Quick Reactions Strip */}
      <div className="px-3 py-1.5 bg-[#1e1f22]/90 border-t border-[#232428] flex items-center justify-between gap-1 overflow-x-auto">
        <span className="text-[10px] font-bold text-discord-textMuted px-1 uppercase tracking-wider">Reações:</span>
        <div className="flex items-center gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="w-7 h-7 rounded-lg hover:bg-discord-accent/20 text-sm flex items-center justify-center transition-all hover:scale-125 active:scale-95"
              title={`Reagir com ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Discord Message Input Box */}
      <div className="p-3 bg-[#1e1f22]">
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Conversar em #${roomTitle}... (Enter para enviar)`}
            className="w-full bg-[#383a40] text-[13px] text-discord-textNormal rounded-lg pl-3.5 pr-10 py-2.5 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted shadow-inner transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2 top-2 p-1 text-discord-textMuted hover:text-white disabled:opacity-30 transition-colors"
            title="Enviar mensagem"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
