import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { State } from './lib/State';
import PlayerCard from './components/PlayerCard';
import { StatsEngine, MatchStats } from './lib/StatsEngine';
import { SOCKET_URL } from './config';

const LiveView: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    // LiveView 不需要持久保存 socket 實例，避免未使用變數警告
    const [gameState, setGameState] = useState<State | null>(null);
    const [stats, setStats] = useState<MatchStats>(() => roomId ? StatsEngine.compute(roomId) : {
        perPlayer: [
            {
                playerIndex: 0,
                totalShots: 0,
                potCount: 0,
                totalPoints: 0,
                potRate: 0,
                avgShotTimeMs: 0,
                quickShotCount: 0,
                quickShotRate: 0,
                maxBreakPoints: 0,
                safeCount: 0,
                safeSuccessRate: 0,
                foulCount: 0,
                potByBall: { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 },
                shotTimeBuckets: [0, 0, 0, 0],
            },
            {
                playerIndex: 1,
                totalShots: 0,
                potCount: 0,
                totalPoints: 0,
                potRate: 0,
                avgShotTimeMs: 0,
                quickShotCount: 0,
                quickShotRate: 0,
                maxBreakPoints: 0,
                safeCount: 0,
                safeSuccessRate: 0,
                foulCount: 0,
                potByBall: { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 },
                shotTimeBuckets: [0, 0, 0, 0],
            },
        ],
        eventsCount: 0,
    });
    const [showEndModal, setShowEndModal] = useState(false);

    useEffect(() => {
        const newSocket = io(SOCKET_URL);

        if (roomId) {
            newSocket.emit('join room', roomId);
        }

        newSocket.on('gameState updated', (newGameState) => {
            // 以 State.fromJSON 正確反序列化，避免建構子參數數量錯誤與隱含 any
            const deserializedState = State.fromJSON(newGameState);
            setGameState(deserializedState);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [roomId]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    // Hooks 必須在任何可能的 return 之前固定呼叫順序
    // 使用狀態中的 isMatchOver，與 State.checkMatchOver 的定義一致
    const isMatchOver = useMemo(() => gameState?.isMatchOver ?? false, [gameState?.isMatchOver]);

    useEffect(() => {
        if (!roomId) return;
        setStats(StatsEngine.compute(roomId));
    }, [
        roomId,
        gameState?.shotHistory.length,
        gameState?.currentPlayerIndex,
        gameState?.players[0].score,
        gameState?.players[1].score,
    ]);

    useEffect(() => {
        if (isMatchOver) setShowEndModal(true);
    }, [isMatchOver]);

    if (!gameState) {
        return <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">Loading...</div>;
    }

    const remainingPoints = gameState.getRemainingPoints();
    const lead = Math.abs(gameState.players[0].score - gameState.players[1].score);
    const leader = gameState.players[0].score > gameState.players[1].score ? gameState.players[0] : gameState.players[1];
    const lastShot = gameState.shotHistory[gameState.shotHistory.length - 1];

    return (
        <div className="min-h-screen bg-green-900 text-white p-4 flex flex-col items-center">
            <div className="w-full max-w-5xl mx-auto">
                <div className="text-center mb-4">
                    <h1 className="text-3xl font-bold tracking-wider">{gameState.settings.matchName}</h1>
                    <p className="text-xl text-gray-400">{gameState.players[0].framesWon} ({gameState.settings.framesRequired}) {gameState.players[1].framesWon}</p>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    {gameState.players.map((player, index) => (
                        <PlayerCard
                            key={player.memberId}
                            player={player}
                            isCurrentPlayer={gameState.currentPlayerIndex === index}
                            isFreeBall={gameState.isFreeBall && gameState.currentPlayerIndex === index}
                        />
                    ))}
                </div>

                <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center">
                    <div className="grid grid-cols-4 gap-4 text-lg">
                        <div>
                            <p className="text-gray-400">Lead</p>
                            <p className="font-bold text-2xl">{lead > 0 ? `${leader.memberId} +${lead}` : 'Tied'}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Remaining</p>
                            <p className="font-bold text-2xl">{remainingPoints}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Break</p>
                            <p className="font-bold text-2xl">{gameState.breakScore} ({formatTime(gameState.breakTime)})</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Reds Left</p>
                            <p className="font-bold text-2xl">{gameState.redsRemaining}</p>
                        </div>
                    </div>
                    {lastShot && (
                        <p className="text-sm text-gray-300 mt-4">
                            Last: {`${gameState.players[lastShot.player].memberId}: ${lastShot.type} ${lastShot.ball ? `(Ball ${lastShot.ball})` : ''} - ${lastShot.points} pts`}
                        </p>
                    )}
                </div>

                <div className="text-center mb-6 text-gray-400 grid grid-cols-2 gap-4">
                    <div>
                        <p>Frame Time</p>
                        <p className="font-bold text-white text-xl">{formatTime(gameState.timers.frameTime)}</p>
                    </div>
                    <div>
                        <p>Match Time</p>
                        <p className="font-bold text-white text-xl">{formatTime(gameState.timers.matchTime)}</p>
                    </div>
                </div>

                {/* Live Stats */}
                <div className="w-full max-w-5xl mx-auto mb-6 bg-gray-800/60 rounded-lg p-4">
                    <h2 className="text-xl font-semibold mb-2 text-center">Live Stats — {gameState.settings.matchName}</h2>
                    <div className="grid grid-cols-2 gap-4">
                        {[0, 1].map((pi) => (
                            <div key={pi} className="bg-gray-700/50 rounded-md p-3">
                                <p className="font-semibold">{gameState.players[pi].name} ({gameState.players[pi].memberId})</p>
                                <div className="text-sm text-gray-300 space-y-1 mt-2">
                                    <p>Shots: {stats.perPlayer[pi].totalShots}</p>
                                    <p>Pot Rate: {(stats.perPlayer[pi].potRate * 100).toFixed(1)}%</p>
                                    <p>Avg Shot Time: {(stats.perPlayer[pi].avgShotTimeMs / 1000).toFixed(2)}s</p>
                                    <p>Quick Shots (≤7s): {(stats.perPlayer[pi].quickShotRate * 100).toFixed(1)}%</p>
                                    <p>Total Points: {stats.perPlayer[pi].totalPoints}</p>
                                    <p>Max Break: {stats.perPlayer[pi].maxBreakPoints}</p>
                                    <p>Safe Success: {(stats.perPlayer[pi].safeSuccessRate * 100).toFixed(1)}%</p>
                                    <p>Fouls: {stats.perPlayer[pi].foulCount}</p>
                                </div>

                                {/* Color Pot Distribution */}
                                <div className="mt-3">
                                    <p className="text-xs text-gray-400 mb-1">Color Distribution</p>
                                    {(() => {
                                        const pb = stats.perPlayer[pi].potByBall;
                                        const totals = [pb.red, pb.yellow, pb.green, pb.brown, pb.blue, pb.pink, pb.black];
                                        const labels = ['Red', 'Yellow', 'Green', 'Brown', 'Blue', 'Pink', 'Black'];
                                        const colors = ['#dc2626','#f59e0b','#22c55e','#a16207','#3b82f6','#ec4899','#111827'];
                                        const max = Math.max(1, ...totals);
                                        return (
                                            <div className="space-y-1">
                                                {totals.map((v, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <span className="w-12 text-xs">{labels[idx]}</span>
                                                        <div className="flex-1 h-2 rounded bg-gray-600 overflow-hidden">
                                                            <div style={{ width: `${(v / max) * 100}%`, backgroundColor: colors[idx] }} className="h-2" />
                                                        </div>
                                                        <span className="w-6 text-xs text-right">{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Shot Time Histogram */}
                                <div className="mt-3">
                                    <p className="text-xs text-gray-400 mb-1">Shot Time Histogram</p>
                                    {(() => {
                                        const buckets = stats.perPlayer[pi].shotTimeBuckets;
                                        const labels = ['0-5s','5-10s','10-20s','>20s'];
                                        const max = Math.max(1, ...buckets);
                                        return (
                                            <div className="space-y-1">
                                                {buckets.map((v, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <span className="w-12 text-xs">{labels[idx]}</span>
                                                        <div className="flex-1 h-2 rounded bg-gray-600 overflow-hidden">
                                                            <div style={{ width: `${(v / max) * 100}%`, backgroundColor: '#10b981' }} className="h-2" />
                                                        </div>
                                                        <span className="w-6 text-xs text-right">{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {showEndModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="bg-gray-900 rounded-lg p-6 w-full max-w-3xl">
                        <h3 className="text-2xl font-bold mb-4 text-center">Match Summary — {gameState.settings.matchName}</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            {[0, 1].map((pi) => (
                                <div key={pi} className="bg-gray-800/50 rounded-md p-3">
                                    <p className="font-semibold">{gameState.players[pi].name} ({gameState.players[pi].memberId})</p>
                                    <div className="text-sm text-gray-300 space-y-1 mt-2">
                                        <p>Frames: {gameState.players[pi].framesWon}/{gameState.settings.framesRequired}</p>
                                        <p>Total Points: {gameState.players[pi].score}</p>
                                        <p>Pot Rate: {(stats.perPlayer[pi].potRate * 100).toFixed(1)}%</p>
                                        <p>Avg Shot Time: {(stats.perPlayer[pi].avgShotTimeMs / 1000).toFixed(2)}s</p>
                                        <p>Max Break: {stats.perPlayer[pi].maxBreakPoints}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-300">Match: {gameState.settings.matchName}</p>
                                <p className="text-gray-300">Events: {stats.eventsCount}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
                                    onClick={() => {
                                        if (!roomId) return;
                                        const record = StatsEngine.buildMatchRecord(roomId, gameState);
                                        navigator.clipboard.writeText(JSON.stringify(record, null, 2));
                                    }}
                                >
                                    複製 JSON
                                </button>
                                <button
                                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white"
                                    onClick={() => setShowEndModal(false)}
                                >
                                    關閉
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveView;