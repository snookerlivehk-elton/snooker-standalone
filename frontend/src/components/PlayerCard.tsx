import React from 'react';
import { Player } from '../lib/Player';

interface PlayerCardProps {
    player: Player;
    isCurrentPlayer: boolean;
    isFreeBall: boolean; // Add this prop
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, isCurrentPlayer, isFreeBall }) => {
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
      <h3 className={nameClasses}>{player.name} ({player.memberId})</h3>
      <div className={scoreClasses}>{player.score}</div>
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