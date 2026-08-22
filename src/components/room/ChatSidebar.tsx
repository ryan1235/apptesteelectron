import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  MessageSquare,
  Hash,
  Smile,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  Crown,
} from 'lucide-react';
import { ChatMessage } from '../../types/live-room';

interface ChatSidebarProps {
  roomTitle: string;
  messages: ChatMessage[];
  currentUserId: string;
  currentUserName?: string;
  clientUserId?: string;
  typingUsers: string[];
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onTyping: (isTyping: boolean) => void;
}

const QUICK_EMOJIS = ['🔥', '👏', '❤️', '😂', '👍', '🚀', '💡', '🎉'];

const EMOJI_CATEGORIES = [
  {
    name: 'Populares',
    emojis: ['🔥', '❤️', '😂', '👍', '👏', '🎉', '🚀', '💡', '✨', '👀', '💯', '🙌'],
  },
  {
    name: 'Carinhas',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😭', '😎', '🥳', '🤔', '😴'],
  },
  {
    name: 'Gaming & Vibe',
    emojis: ['🎮', '🕹️', '🏆', '👑', '⚡', '💣', '🎧', '👾', '🍿', '🍕', '🍔', '🍺'],
  },
  {
    name: 'Gestos & Amor',
    emojis: ['👋', '🤝', '💪', '🙏', '💖', '💘', '💕', '⭐', '🌟', '💥', '💀', '💩'],
  },
];

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  roomTitle,
  messages,
  currentUserId,
  currentUserName = '',
  clientUserId = '',
  typingUsers,
  onSendMessage,
  onSendReaction,
  onTyping,
}) => {
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<any>(null);
  const prevMessagesLength = useRef(messages.length);

  // Handle scroll detection
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 80;
    setIsScrolledUp(isUp);
    if (!isUp) {
      setUnreadWhileScrolled(0);
    }
  };

  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      if (isScrolledUp) {
        setUnreadWhileScrolled((prev) => prev + (messages.length - prevMessagesLength.current));
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevMessagesLength.current = messages.length;
  }, [messages, isScrolledUp]);

  useEffect(() => {
    if (!isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [typingUsers]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUnreadWhileScrolled(0);
    setIsScrolledUp(false);
  };

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
    setShowEmojiPicker(false);
    setTimeout(scrollToBottom, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 1500);
  };

  // Helper to format text with Markdown links, code blocks, bold, mentions
  const renderFormattedContent = (content: string) => {
    const parts = content.split(/((?:https?:\/\/[^\s]+)|(?:\*\*[^*]+\*\*)|(?:\*[^*]+\*)|(?:`[^`]+`)|(?:@[a-zA-Z0-9_-]+))/g);

    return parts.map((part, i) => {
      if (!part) return null;

      // URL Links
      if (part.startsWith('http://') || part.startsWith('https://')) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-discord-accent hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }

      // Code blocks `code`
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded bg-[#111214] text-discord-yellow font-mono text-[12px] border border-white/5 mx-0.5"
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold **text**
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
      }

      // Italic *text*
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={i} className="italic text-gray-300">{part.slice(1, -1)}</em>;
      }

      // Mentions @user
      if (part.startsWith('@') && part.length > 1) {
        return (
          <span
            key={i}
            className="bg-discord-accent/20 text-discord-accent font-semibold px-1 py-0.2 rounded hover:bg-discord-accent/30 cursor-pointer"
          >
            {part}
          </span>
        );
      }

      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="w-80 bg-discord-chat flex flex-col h-full select-none border-l border-[#1f2023] z-20 relative">
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#1f2023] font-bold text-discord-textHeader shadow-sm bg-[#1e1f22]/90 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <Hash size={18} className="text-discord-textMuted flex-shrink-0" />
          <span className="truncate text-sm font-bold">{roomTitle}</span>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-[#2b2d31] text-discord-green font-semibold border border-discord-green/20 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-discord-green animate-pulse" />
          Ao Vivo
        </span>
      </div>

      {/* Messages Stream (Authentic Discord Flow) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 relative"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-discord-textMuted text-xs space-y-2.5 py-8">
            <div className="w-12 h-12 rounded-2xl bg-[#232428] flex items-center justify-center text-discord-accent shadow-inner">
              <MessageSquare size={22} />
            </div>
            <p className="font-bold text-discord-textHeader text-sm">Início do canal #{roomTitle}</p>
            <p className="text-[11px] text-discord-textMuted max-w-[200px]">
              Envie uma mensagem ou use reações rápidas para interagir com a sala!
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;

            // Group consecutive messages by same user within 2 minutes
            const isSameUser =
              prevMsg &&
              (prevMsg.userId === msg.userId ||
                (prevMsg.clientUserId && prevMsg.clientUserId === msg.clientUserId) ||
                (prevMsg.userName && msg.userName && prevMsg.userName.toLowerCase() === msg.userName.toLowerCase()));

            const timeDiff = prevMsg
              ? Math.abs(new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime())
              : 999999;
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

            const msgId = msg.id || `msg-${index}`;
            const isCopied = copiedMessageId === msgId;

            if (isCompact) {
              return (
                <div
                  key={msgId}
                  className="hover:bg-[#2e3035]/60 px-3 py-1 rounded-lg -mx-2 transition-colors flex items-start group relative"
                >
                  <span className="text-[10px] text-transparent group-hover:text-discord-textMuted w-9 text-right pr-3 flex-shrink-0 font-mono select-none mt-0.5">
                    {timeFormatted}
                  </span>
                  <div className="text-[13px] text-[#dbdee1] leading-relaxed break-words select-text flex-1">
                    {renderFormattedContent(msg.content)}
                  </div>

                  {/* Copy Action on Hover */}
                  <button
                    onClick={() => handleCopyText(msgId, msg.content)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-discord-textMuted hover:text-white rounded bg-[#1e1f22] border border-[#2e3035] transition-all ml-2 flex-shrink-0"
                    title={isCopied ? 'Copiado!' : 'Copiar mensagem'}
                  >
                    {isCopied ? <Check size={11} className="text-discord-green" /> : <Copy size={11} />}
                  </button>
                </div>
              );
            }

            return (
              <div
                key={msgId}
                className="hover:bg-[#2e3035]/60 px-3 py-2 rounded-xl -mx-2 transition-colors flex items-start gap-3 mt-2 group relative"
              >
                <div className="w-9 h-9 rounded-full bg-[#35373c] flex items-center justify-center font-bold text-white text-xs overflow-hidden flex-shrink-0 mt-0.5 shadow-sm ring-1 ring-white/5">
                  {msg.avatarUrl ? (
                    <img src={msg.avatarUrl} alt={msg.userName} className="w-full h-full object-cover" />
                  ) : (
                    (msg.userName || 'U').substring(0, 2).toUpperCase()
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-white truncate hover:underline cursor-pointer">
                      {msg.userName}
                    </span>
                    <span className="text-[10px] text-discord-textMuted font-mono">
                      {timeFormatted}
                    </span>
                  </div>
                  <div className="text-[13px] text-[#dbdee1] mt-0.5 leading-relaxed break-words select-text">
                    {renderFormattedContent(msg.content)}
                  </div>
                </div>

                {/* Copy Action on Hover */}
                <button
                  onClick={() => handleCopyText(msgId, msg.content)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-discord-textMuted hover:text-white rounded bg-[#1e1f22] border border-[#2e3035] transition-all flex-shrink-0"
                  title={isCopied ? 'Copiado!' : 'Copiar mensagem'}
                >
                  {isCopied ? <Check size={11} className="text-discord-green" /> : <Copy size={11} />}
                </button>
              </div>
            );
          })
        )}

        {/* Real-time Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-discord-textMuted px-2.5 py-1.5 bg-[#1e1f22]/90 rounded-lg animate-pulse border border-[#2b2d31] shadow-md">
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

      {/* Floating "Scroll to Bottom / New Messages" Pill */}
      {isScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-discord-accent text-white text-xs font-bold shadow-xl hover:bg-discord-accentHover transition-all animate-bounce"
        >
          <ChevronDown size={14} />
          <span>{unreadWhileScrolled > 0 ? `${unreadWhileScrolled} novas mensagens` : 'Ir para o final'}</span>
        </button>
      )}

      {/* Emoji Picker Popover Modal */}
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-3 right-3 bg-[#2b2d31] rounded-xl p-3 border border-[#383a40] shadow-2xl z-40 animate-fade-in">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#383a40]">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles size={13} className="text-discord-yellow" />
              <span>Selecione um Emoji</span>
            </span>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="text-xs text-discord-textMuted hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.name}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-discord-textMuted block mb-1">
                  {cat.name}
                </span>
                <div className="grid grid-cols-6 gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleInsertEmoji(emoji)}
                      className="w-8 h-8 rounded-lg hover:bg-white/10 text-lg flex items-center justify-center transition-transform hover:scale-125 active:scale-95"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            placeholder={`Conversar em #${roomTitle}... (**negrito**, \`código\`)`}
            className="w-full bg-[#383a40] text-[13px] text-discord-textNormal rounded-lg pl-3.5 pr-16 py-2.5 border border-transparent focus:border-discord-accent focus:outline-none placeholder-discord-textMuted shadow-inner transition-colors"
          />

          <div className="absolute right-2 flex items-center gap-1">
            {/* Emoji Picker Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-1.5 rounded transition-colors ${
                showEmojiPicker ? 'text-discord-yellow' : 'text-discord-textMuted hover:text-white'
              }`}
              title="Escolher emoji"
            >
              <Smile size={16} />
            </button>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-1.5 text-discord-textMuted hover:text-discord-accent disabled:opacity-30 transition-colors"
              title="Enviar mensagem"
            >
              <Send size={15} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
