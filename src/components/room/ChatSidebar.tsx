import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Hash } from 'lucide-react';
import { ChatMessage } from '../../types/live-room';

interface ChatSidebarProps {
  roomTitle: string;
  messages: ChatMessage[];
  currentUserId: string;
  onSendMessage: (text: string) => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  roomTitle,
  messages,
  currentUserId,
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="w-80 bg-discord-chat flex flex-col h-full select-none border-l border-[#1f2023]">
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-2 border-b border-[#1f2023] font-semibold text-discord-textHeader shadow-sm">
        <Hash size={18} className="text-discord-textMuted" />
        <span className="truncate text-sm">{roomTitle}</span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-discord-textMuted text-xs space-y-2">
            <MessageSquare size={32} className="opacity-40" />
            <p>Nenhuma mensagem ainda.</p>
            <p className="text-[11px]">Envie uma mensagem para iniciar o bate-papo!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.userId === currentUserId;
            const timeFormatted = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={msg.id || index} className="flex items-start gap-3 group">
                <div className="w-8 h-8 rounded-full bg-discord-accent flex items-center justify-center font-bold text-white text-xs overflow-hidden flex-shrink-0 mt-0.5">
                  {msg.avatarUrl ? (
                    <img src={msg.avatarUrl} alt={msg.userName} className="w-full h-full object-cover" />
                  ) : (
                    msg.userName.substring(0, 2).toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        isMe ? 'text-discord-accent' : 'text-discord-textHeader'
                      }`}
                    >
                      {msg.userName}
                    </span>
                    <span className="text-[10px] text-discord-textMuted">{timeFormatted}</span>
                  </div>
                  <div className="text-xs text-discord-textNormal mt-0.5 leading-relaxed break-words">
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="p-4 pt-2">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Conversar em #${roomTitle}...`}
            className="w-full bg-[#1e1f22] text-xs text-discord-textNormal rounded-lg pl-3 pr-10 py-2.5 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="absolute right-2 top-2 p-1 text-discord-textMuted hover:text-white disabled:opacity-30 transition-colors"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
};
