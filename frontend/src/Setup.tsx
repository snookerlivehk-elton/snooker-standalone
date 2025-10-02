import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

interface SetupProps {
    onStartMatch: (settings: any) => void;
}

const Setup: React.FC<SetupProps> = ({ onStartMatch }) => {
    const [matchName, setMatchName] = useState('Snooker Match');
    const [p1Name, setP1Name] = useState('Player 1');
    const [p1MemberId, setP1MemberId] = useState('P1');
    const [p2Name, setP2Name] = useState('Player 2');
    const [p2MemberId, setP2MemberId] = useState('P2');
    const [redBalls, setRedBalls] = useState(15);
    const [framesRequired, setFramesRequired] = useState(1);
    const [startingPlayerIndex, setStartingPlayerIndex] = useState(0);
    const navigate = useNavigate();
    const { roomId } = useParams();

    const handleStartMatch = () => {
        onStartMatch({
            playersInfo: [
                { name: p1Name, memberId: p1MemberId },
                { name: p2Name, memberId: p2MemberId },
            ],
            settings: { matchName, redBalls, framesRequired },
            startingPlayerIndex,
        });
        if (roomId) {
            navigate(`/room/${roomId}`);
        }
    };

    return (
        <div className="min-h-screen bg-green-900 p-4 flex flex-col items-center justify-center">
            <div className="max-w-md w-full bg-yellow-800 rounded-xl shadow-md p-6">
                <h1 className="text-4xl font-bold text-center text-white mb-2 font-serif italic">Snooker Live HK</h1>
                <p className="text-base text-center text-gray-300 mb-6 -mt-2">Scoreboard System</p>
                <h2 className="text-2xl font-bold text-center text-white mb-6">Create Match</h2>
                <div className="space-y-4">
                    <div className="setting-item">
                        <label htmlFor="matchName" className="block text-sm font-medium text-white">Match Name:</label>
                        <input 
                            type="text" 
                            id="matchName"
                            value={matchName} 
                            onChange={(e) => setMatchName(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                    </div>
                    <div className="player-setup grid grid-cols-2 gap-4">
                        <div>
                            <h2 className="text-lg font-medium text-white">Player 1</h2>
                            <div className="input-group mt-2">
                                <label htmlFor="p1Name" className="block text-sm font-medium text-white">Full Name:</label>
                                <input type="text" id="p1Name" value={p1Name} onChange={(e) => setP1Name(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"/>
                            </div>
                            <div className="input-group mt-2">
                                <label htmlFor="p1MemberId" className="block text-sm font-medium text-white">Member ID</label>
                                <input type="text" id="p1MemberId" value={p1MemberId} onChange={(e) => setP1MemberId(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"/>
                            </div>
                        </div>
                        <div>
                            <h2 className="text-lg font-medium text-white">Player 2</h2>
                            <div className="input-group mt-2">
                                <label htmlFor="p2Name" className="block text-sm font-medium text-white">Full Name:</label>
                                <input type="text" id="p2Name" value={p2Name} onChange={(e) => setP2Name(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"/>
                            </div>
                            <div className="input-group mt-2">
                                <label htmlFor="p2MemberId" className="block text-sm font-medium text-white">Member ID</label>
                                <input type="text" id="p2MemberId" value={p2MemberId} onChange={(e) => setP2MemberId(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"/>
                            </div>
                        </div>
                    </div>
                    <div className="setting-item">
                        <label className="block text-sm font-medium text-white">Number of Reds:</label>
                        <div className="flex space-x-2 mt-1">
                            {[6, 10, 15].map(reds => (
                                <button 
                                    key={reds} 
                                    className={`px-4 py-2 rounded-md text-sm font-medium ${redBalls === reds ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                                    onClick={() => setRedBalls(reds)}
                                >
                                    {reds}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="setting-item">
                        <label htmlFor="framesRequired" className="block text-sm font-medium text-white">Number of Frames:</label>
                        <input 
                            type="number" 
                            id="framesRequired"
                            value={framesRequired} 
                            onChange={(e) => setFramesRequired(parseInt(e.target.value, 10))}
                            className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"
                        />
                    </div>
                    <div className="setting-item">
                        <label className="block text-sm font-medium text-white">Starting Player:</label>
                        <div className="flex space-x-2 mt-1">
                            <button 
                                className={`px-4 py-2 rounded-md text-sm font-medium ${startingPlayerIndex === 0 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                                onClick={() => setStartingPlayerIndex(0)}
                            >
                                {p1Name}
                            </button>
                            <button 
                                className={`px-4 py-2 rounded-md text-sm font-medium ${startingPlayerIndex === 1 ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
                                onClick={() => setStartingPlayerIndex(1)}
                            >
                                {p2Name}
                            </button>
                        </div>
                    </div>
                    <button
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        onClick={handleStartMatch}
                    >
                        Start Match
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Setup;