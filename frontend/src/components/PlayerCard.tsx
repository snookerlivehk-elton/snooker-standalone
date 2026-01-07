import React from 'react';
import { Player } from '../lib/Player';

interface PlayerCardProps {
    player: Player;
    isCurrentPlayer: boolean;
    isFreeBall: boolean; // Add this prop
    handicapRaw?: number | string;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, isCurrentPlayer, isFreeBall, handicapRaw }) => {
  const cardClasses = `relative p-4 rounded-lg shadow-md transition-all duration-300 bg-gray-800 ${isCurrentPlayer ? 'border-4 border-yellow-400 shadow-yellow-300' : 'border-2 border-transparent'}`;
  const nameClasses = `font-bold text-2xl text-white`;
  const scoreClasses = `text-6xl font-bold my-2 text-yellow-200`;
  const framesClasses = `text-lg font-semibold text-gray-300`;

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cardClasses}>
      {isCurrentPlayer && isFreeBall && (
        <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
          FREE BALL
        </div>
      )}
      <h3 className={nameClasses}>
        {player.name}
        {(() => {
          const mid = (player.memberId || '').trim();
          if (!mid) return null;
          return <span className="ml-2 text-base text-gray-300 font-semibold">({mid})</span>;
        })()}
        {(() => {
          const isBlank = handicapRaw === null || handicapRaw === undefined || (typeof handicapRaw === 'string' && handicapRaw.trim() === '');
          if (isBlank) return null;
          const n = typeof handicapRaw === 'number' ? handicapRaw : Number(handicapRaw);
          const display = isNaN(n) ? String(handicapRaw) : (n > 0 ? `+${n}` : `${n}`);
          return (
          <span className="ml-2 text-base text-gray-300 font-semibold">
            ({display})
          </span>
          );
        })()}
      </h3>
      <div className={scoreClasses}>{player.score}</div>
      {/* Per-player quick stats: Fouls / Miss / Safe */}
      <div className="mt-1 grid grid-cols-3 gap-2 text-center">
        <div className="bg-black/40 rounded px-2 py-1 border border-yellow-400/30">
          <div className="text-[11px] font-semibold text-gray-300">Fouls</div>
          <div className="text-sm font-bold text-yellow-300 leading-tight">{player.fouls}</div>
        </div>
        <div className="bg-black/40 rounded px-2 py-1 border border-yellow-400/30">
          <div className="text-[11px] font-semibold text-gray-300">Miss</div>
          <div className="text-sm font-bold text-yellow-300 leading-tight">{player.misses}</div>
        </div>
        <div className="bg-black/40 rounded px-2 py-1 border border-yellow-400/30">
          <div className="text-[11px] font-semibold text-gray-300">Safe</div>
          <div className="text-sm font-bold text-yellow-300 leading-tight">{player.safeties}</div>
        </div>
      </div>
      {player.highBreaks.filter(br => br.score >= 20).length > 0 && (
        <div className="mt-2">
            <h4 className={`${framesClasses} text-lg text-center`}>High Break</h4>
            <div className="text-center mt-1">
                {player.highBreaks.filter(br => br.score >= 20).map((br) => (
                    <div key={`${br.score}-${br.time}`} className="text-gray-300 text-sm">
                        {br.score} ({formatTime(br.time)})
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default PlayerCard;
