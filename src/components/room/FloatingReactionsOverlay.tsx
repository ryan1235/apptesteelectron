import React from 'react';
import { FloatingReaction } from '../../types/live-room';

interface FloatingReactionsOverlayProps {
  reactions: FloatingReaction[];
}

export const FloatingReactionsOverlay: React.FC<FloatingReactionsOverlayProps> = ({ reactions }) => {
  if (reactions.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-6 flex flex-col items-center animate-float-up opacity-0"
          style={{
            left: `${Math.max(10, Math.min(85, r.xOffset))}%`,
          }}
        >
          <span className="text-3xl filter drop-shadow-lg transform transition-transform hover:scale-125 select-none">
            {r.emoji}
          </span>
          {r.userName && (
            <span className="text-[10px] bg-black/60 backdrop-blur-sm text-white px-1.5 py-0.5 rounded-full font-medium shadow-sm mt-0.5">
              {r.userName}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
