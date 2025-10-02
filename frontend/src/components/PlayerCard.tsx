import React from 'react';
import { Player } from '../lib/Player';

interface PlayerCardProps {
    player: Player;
    isCurrentPlayer: boolean;
    isFreeBall: boolean; // Add this prop
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, isCurrentPlayer, isFreeBall }) => {
  const cardClasses = `p-4 rounded-lg shadow-md transition-all duration-300 ${isCurrentPlayer ? 'bg-blue-500' : 'bg-yellow-800'}`;
  const nameClasses = `font-bold text-2xl ${isCurrentPlayer ? 'text-black' : 'text-gray-300'}`;
  const scoreClasses = `text-6xl font-bold my-2 ${isCurrentPlayer ? 'text-white' : 'text-gray-100'}`;
  const framesClasses = `text-lg font-semibold ${isCurrentPlayer ? 'text-blue-200' : 'text-gray-400'}`;

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
      <div className="flex justify-around">
        <div className={framesClasses}>Frames: {player.frames}</div>
      </div>
      {player.highBreaks.filter(br => br.score >= 20).length > 0 && (
        <div className="mt-2">
            <h4 className={`${framesClasses} text-lg text-center`}>High Break</h4>
            <div className="text-center mt-1">
                {player.highBreaks.filter(br => br.score >= 20).map((br, index) => (
                    <div key={`${br.score}-${br.time}`} className="text-gray-300 text-sm">
                        {br.score} ({formatTime(br.time)})
                    </div>
                ))}
            </div>
        </div>
      )}
      <div className="mt-4 pt-2 border-t border-gray-500 flex justify-around text-sm">
        <div className={framesClasses}>Fouls: {player.fouls}</div>
        <div className={framesClasses}>Misses: {player.misses}</div>
        <div className={framesClasses}>Safeties: {player.safeties}</div>
      </div>
    </div>
  );
};

export default PlayerCard;