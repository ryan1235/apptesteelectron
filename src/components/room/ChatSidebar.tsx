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
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#1f2023] font-semibold text-discord-textHeader shadow-sm bg-[#1e1f22]/60 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Hash size={18} className="text-discord-textMuted flex-shrink-0" />
          <span className="truncate text-sm font-bold">{roomTitle}</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-discord-accent/20 text-discord-accent font-semibold">
          Chat Ao Vivo
        </span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-discord-textMuted text-xs space-y-2 py-8">
            <div className="w-12 h-12 rounded-2xl bg-[#232428] flex items-center justify-center text-discord-accent shadow-inner">
              <MessageSquare size={24} />
            </div>
            <p className="font-semibold text-discord-textHeader">Nenhuma mensagem ainda</p>
            <p className="text-[11px] text-discord-textMuted max-w-[200px]">
              Envie uma mensagem ou solte uma reação para interagir com a sala!
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.userId === currentUserId;
            let timeFormatted = '';
            try {
              timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
            } catch (e) {
              timeFormatted = '';
            }

            return (
              <div
                key={msg.id || index}
                className={`flex items-start gap-2.5 group transition-colors rounded-xl p-2 ${
                  isMe
                    ? 'bg-discord-accent/10 border border-discord-accent/20'
                    : 'bg-[#232428]/60 hover:bg-[#2b2d31]/60'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs overflow-hidden flex-shrink-0 mt-0.5 shadow-sm ${
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
                  <div className="flex items-baseline justify-between gap-1">
                    <span
                      className={`text-xs font-bold truncate ${
                        isMe ? 'text-discord-accent' : 'text-discord-textHeader'
                      }`}
                    >
                      {msg.userName} {isMe && '(Você)'}
                    </span>
                    <span className="text-[10px] text-discord-textMuted flex-shrink-0 font-mono">
                      {timeFormatted}
                    </span>
                  </div>
                  <div className="text-xs text-discord-textNormal mt-1 leading-relaxed break-words select-text">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Real-time Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-discord-textMuted px-2 py-1 bg-[#1e1f22]/80 rounded-lg animate-pulse border border-[#2b2d31]">
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

      {/* Floating Emoji Reactions Bar */}
      <div className="px-3 py-1.5 bg-[#1e1f22]/70 border-t border-[#232428] flex items-center justify-between gap-1 overflow-x-auto">
        <span className="text-[10px] font-semibold text-discord-textMuted px-1">Reações:</span>
        <div className="flex items-center gap-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="w-7 h-7 rounded-lg bg-[#2b2d31] hover:bg-discord-accent text-sm flex items-center justify-center transition-all hover:scale-125 active:scale-95 shadow-sm"
              title={`Enviar reação ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input */}
      <div className="p-3 bg-[#1e1f22]">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Conversar em #${roomTitle}... (Pressione Enter)`}
            className="w-full bg-[#2b2d31] text-xs text-discord-textNormal rounded-xl pl-3.5 pr-10 py-3 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted shadow-inner transition-colors"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2.5 top-2.5 p-1.5 rounded-lg bg-discord-accent text-white hover:bg-discord-accentHover disabled:bg-transparent disabled:text-discord-textMuted disabled:opacity-30 transition-all"
            title="Enviar Mensagem (Enter)"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
