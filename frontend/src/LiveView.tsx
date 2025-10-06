import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { State } from './lib/State';
import PlayerCard from './components/PlayerCard';
import { StatsEngine, MatchStats } from './lib/StatsEngine';
import { SOCKET_URL, ENABLE_SOCKET, SOCKET_PATH } from './config';
import { RoomStorage } from './lib/RoomStorage';

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
    const [statsPage, setStatsPage] = useState(0);
    const totalPages = 3; // 將統計分為 3 版輪播
    // 調試：顯示更新來源與連線狀態
    const [connStatus, setConnStatus] = useState<'init' | 'socket_connected' | 'socket_error' | 'socket_disconnected'>('init');
    const [updateSource, setUpdateSource] = useState<'none' | 'storage' | 'socket'>('none');
    const [lastUpdateTs, setLastUpdateTs] = useState<number | null>(null);
    // 移除重複定義：formatTime 已在上方宣告
    const debug = useMemo(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('debug') === 'true';
        } catch { return false; }
    }, []);
    // socket 失敗時的輪詢回退
    const pollRef = useRef<number | null>(null);
    const startPolling = () => {
        if (!roomId) return;
        if (pollRef.current != null) return;
        const updateFromStorage = () => {
            const raw = RoomStorage.getState(roomId!);
            if (raw) {
                try {
                    const deserializedState = State.fromJSON(raw);
                    setGameState(deserializedState);
                    setUpdateSource('storage');
                    setLastUpdateTs(Date.now());
                } catch {}
            }
        };
        updateFromStorage();
        pollRef.current = window.setInterval(updateFromStorage, 500);
    };
    const stopPolling = () => {
        if (pollRef.current != null) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    useEffect(() => {
        if (!ENABLE_SOCKET) {
            const updateFromStorage = () => {
                if (!roomId) return;
                const raw = RoomStorage.getState(roomId!);
                if (raw) {
                    try {
                        const deserializedState = State.fromJSON(raw);
                        setGameState(deserializedState);
                    } catch {}
                }
            };
            updateFromStorage();
            const id = setInterval(updateFromStorage, 500);
            const onStorage = (e: StorageEvent) => {
                if (!e.key || !roomId) return;
                if (e.key.includes(`snooker_room_${roomId}`)) updateFromStorage();
            };
            window.addEventListener('storage', onStorage);
            return () => {
                clearInterval(id);
                window.removeEventListener('storage', onStorage);
            };
        }
        // 先以本機儲存狀態作為初始顯示（即使在 socket 模式），避免初次加入房間時沒有快照
        if (roomId) {
            const raw = RoomStorage.getState(roomId!);
            if (raw) {
                try {
                    const deserializedState = State.fromJSON(raw);
                    setGameState(deserializedState);
                    setUpdateSource('storage');
                    setLastUpdateTs(Date.now());
                } catch {}
            }
        }
        // 在 socket 模式下也開啟常時輪詢，避免 storage 事件在某些環境未觸發而造成更新漏接
        startPolling();
        // 在 socket 模式也監聽 storage 事件，確保當 Scoreboard 在無後端模式更新本地儲存時，LiveView 仍可自動更新
        const onStorage = (e: StorageEvent) => {
            if (!e.key || !roomId) return;
            if (e.key.includes(`snooker_room_${roomId}`)) {
                try {
                    const raw = RoomStorage.getState(roomId!);
                    if (raw) {
                        const deserialized = State.fromJSON(raw);
                        setGameState(deserialized);
                        setUpdateSource('storage');
                        setLastUpdateTs(Date.now());
                    }
                } catch {}
            }
        };
        window.addEventListener('storage', onStorage);
        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            path: SOCKET_PATH,
            reconnection: true,
            reconnectionAttempts: Infinity,
        });

        if (roomId) {
            newSocket.emit('join room', roomId);
        }

        newSocket.on('gameState updated', (newGameState) => {
            // 以 State.fromJSON 正確反序列化，避免建構子參數數量錯誤與隱含 any
            const deserializedState = State.fromJSON(newGameState);
            setGameState(deserializedState);
            setUpdateSource('socket');
            setLastUpdateTs(Date.now());
        });

        // 連線狀態紀錄（不再停止輪詢）
        newSocket.on('connect', () => {
            setConnStatus('socket_connected');
        });
        newSocket.on('connect_error', () => {
            setConnStatus('socket_error');
        });
        newSocket.on('reconnect_error', () => {
            setConnStatus('socket_error');
        });
        newSocket.on('reconnect_failed', () => {
            setConnStatus('socket_error');
        });
        newSocket.on('disconnect', () => {
            setConnStatus('socket_disconnected');
        });

        return () => {
            newSocket.disconnect();
            stopPolling();
            window.removeEventListener('storage', onStorage);
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

    // 自動輪播統計頁面（每 8 秒）
    useEffect(() => {
        const timer = setInterval(() => {
            setStatsPage((p) => (p + 1) % totalPages);
        }, 8000);
        return () => clearInterval(timer);
    }, [totalPages]);

    useEffect(() => {
        if (isMatchOver) setShowEndModal(true);
    }, [isMatchOver]);

    if (!gameState) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">
                Loading...
                {debug && (
                    <div className="fixed bottom-2 right-2 bg-black/60 text-xs px-3 py-2 rounded">
                        <div>room: {roomId}</div>
                        <div>conn: {connStatus}</div>
                        <div>src: {updateSource}</div>
                        <div>ts: {lastUpdateTs ? new Date(lastUpdateTs).toLocaleTimeString() : '-'}</div>
                    </div>
                )}
            </div>
        );
    }

    const remainingPoints = gameState.getRemainingPoints();
    const lead = Math.abs(gameState.players[0].score - gameState.players[1].score);
    const leader = gameState.players[0].score > gameState.players[1].score ? gameState.players[0] : gameState.players[1];
    const lastShot = gameState.shotHistory[gameState.shotHistory.length - 1];

    return (
        <>
        <div className="min-h-screen bg-green-900 text-white p-4 flex flex-col items-center">
            <div className="w-full max-w-5xl mx-auto">
                <div className="text-center mb-4">
                    <h1 className="text-5xl md:text-6xl font-extrabold tracking-widest drop-shadow-md">{gameState.settings.matchName}</h1>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-4">
                    {gameState.players.map((player, index) => (
                        <PlayerCard
                            key={player.memberId}
                            player={player}
                            isCurrentPlayer={gameState.currentPlayerIndex === index}
                            isFreeBall={gameState.isFreeBall && gameState.currentPlayerIndex === index}
                        />
                    ))}
                </div>

                {/* 中央計分條（置中），左右顯示 Fouls / Miss / Safeties 即時數據 */}
                <div className="w-full max-w-[1920px] mx-auto mb-6 grid grid-cols-3 items-center bg-green-800 border-4 border-yellow-400 rounded-xl px-8 py-4">
                    {/* 左側：球員1即時數據（三欄居中，與標題對齊中置） */}
                    <div className="flex items-center justify-start">
                        <div className="grid grid-cols-3 gap-4 bg-black/40 rounded-lg px-6 py-3 border border-yellow-400/30 w-[560px]">
                            <div className="flex flex-col items-center">
                                <div className="text-xl font-semibold text-gray-300">Fouls</div>
                                <div className="text-2xl font-bold text-yellow-300">{gameState.players[0].fouls}</div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="text-xl font-semibold text-gray-300">Miss</div>
                                <div className="text-2xl font-bold text-yellow-300">{gameState.players[0].misses}</div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="text-xl font-semibold text-gray-300">Safeties</div>
                                <div className="text-2xl font-bold text-yellow-300">{gameState.players[0].safeties}</div>
                            </div>
                        </div>
                    </div>

                    {/* 中央：雙方得局（整體膠囊，總局數置中以括號顯示） */}
                    <div className="flex items-center justify-center">
                        <div className="bg-black text-yellow-300 font-extrabold text-3xl rounded px-6 py-2 flex items-center gap-6">
                            <span>{gameState.players[0].framesWon}</span>
                            <span>({gameState.settings.framesRequired})</span>
                            <span>{gameState.players[1].framesWon}</span>
                        </div>
                    </div>

                    {/* 右側：球員2即時數據（三欄居中，與標題對齊中置） */}
                    <div className="flex items-center justify-end">
                        <div className="grid grid-cols-3 gap-4 bg-black/40 rounded-lg px-6 py-3 border border-yellow-400/30 w-[560px]">
                            <div className="flex flex-col items-center">
                                <div className="text-xl font-semibold text-gray-300">Fouls</div>
                                <div className="text-2xl font-bold text-yellow-300">{gameState.players[1].fouls}</div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="text-xl font-semibold text-gray-300">Miss</div>
                                <div className="text-2xl font-bold text-yellow-300">{gameState.players[1].misses}</div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="text-xl font-semibold text-gray-300">Safeties</div>
                                <div className="text-2xl font-bold text-yellow-300">{gameState.players[1].safeties}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center">
                    <div className="grid grid-cols-6 gap-4 text-lg">
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
                        <div>
                            <p className="text-gray-400">Frame Time</p>
                            <p className="font-bold text-2xl">{formatTime(gameState.timers.frameTime)}</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Match Time</p>
                            <p className="font-bold text-2xl">{formatTime(gameState.timers.matchTime)}</p>
                        </div>
                    </div>
                    {lastShot && (
                        <p className="text-xl font-semibold text-gray-300 mt-4">
                            Last: {`${gameState.players[lastShot.player].memberId}: ${lastShot.type} ${lastShot.ball ? `(Ball ${lastShot.ball})` : ''} - ${lastShot.points} pts`}
                        </p>
                    )}
                </div>

                {/* 已將 Frame Time 與 Match Time 併入上方統計群組 */}

                {/* Live Stats (VS layout, 1920x1080-friendly, carousel) */}
                <div className="w-full max-w-[1920px] mx-auto mb-6 bg-gray-800/60 rounded-lg p-8">
                    <h2 className="text-4xl font-bold tracking-wider mb-6 text-center">Live Stats — {gameState.settings.matchName}</h2>
                    <div className="flex items-baseline justify-between mb-8">
                        <div className="flex-1 text-right text-2xl font-bold tracking-wide">{gameState.players[0].name} ({gameState.players[0].memberId})</div>
                        <div className="mx-8 text-2xl text-gray-300 tracking-wide">vs</div>
                        <div className="flex-1 text-left text-2xl font-bold tracking-wide">{gameState.players[1].name} ({gameState.players[1].memberId})</div>
                    </div>

                    {(() => {
                        const s0 = stats.perPlayer[0];
                        const s1 = stats.perPlayer[1];
                        const pages: { label: string; left: string | number; right: string | number }[][] = [
                            [
                                { label: 'Shots', left: s0.totalShots, right: s1.totalShots },
                                { label: 'Pots', left: s0.potCount, right: s1.potCount },
                                { label: 'Points', left: s0.totalPoints, right: s1.totalPoints },
                                { label: 'Pot Rate', left: `${(s0.potRate * 100).toFixed(1)}%`, right: `${(s1.potRate * 100).toFixed(1)}%` },
                            ],
                            [
                                { label: 'Avg Shot Time', left: `${(s0.avgShotTimeMs / 1000).toFixed(2)}s`, right: `${(s1.avgShotTimeMs / 1000).toFixed(2)}s` },
                                { label: 'Quick Shot Rate', left: `${(s0.quickShotRate * 100).toFixed(1)}%`, right: `${(s1.quickShotRate * 100).toFixed(1)}%` },
                                { label: 'Max Break', left: s0.maxBreakPoints, right: s1.maxBreakPoints },
                                { label: 'Fouls', left: s0.foulCount, right: s1.foulCount },
                                { label: 'Safes', left: s0.safeCount, right: s1.safeCount },
                                { label: 'Safe Success', left: `${(s0.safeSuccessRate * 100).toFixed(1)}%`, right: `${(s1.safeSuccessRate * 100).toFixed(1)}%` },
                            ],
                            [
                                { label: 'Red Pots', left: s0.potByBall.red, right: s1.potByBall.red },
                                { label: 'Yellow Pots', left: s0.potByBall.yellow, right: s1.potByBall.yellow },
                                { label: 'Green Pots', left: s0.potByBall.green, right: s1.potByBall.green },
                                { label: 'Brown Pots', left: s0.potByBall.brown, right: s1.potByBall.brown },
                                { label: 'Blue Pots', left: s0.potByBall.blue, right: s1.potByBall.blue },
                                { label: 'Pink Pots', left: s0.potByBall.pink, right: s1.potByBall.pink },
                                { label: 'Black Pots', left: s0.potByBall.black, right: s1.potByBall.black },
                            ],
                        ];
                        const rows = pages[statsPage] || pages[0];
                        return (
                            <>
                                <div className="space-y-4">
                                    {rows.map((row) => (
                                        <div key={row.label} className="flex items-center justify-between">
                                            <div className="flex-1 text-right text-3xl font-semibold tracking-wider">{row.left}</div>
                                            <div className="mx-10 text-2xl font-medium tracking-wider">{row.label}</div>
                                            <div className="flex-1 text-left text-3xl font-semibold tracking-wider">{row.right}</div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center justify-center gap-2 mt-8">
                                    {[0,1,2].map((i) => (
                                        <button
                                            key={i}
                                            className={`w-3 h-3 rounded-full ${i === statsPage ? 'bg-yellow-400' : 'bg-gray-500'}`}
                                            onClick={() => setStatsPage(i)}
                                            aria-label={`Stats page ${i+1}`}
                                        />
                                    ))}
                                </div>
                            </>
                        );
                    })()}
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
        {debug && (
            <div className="fixed bottom-2 right-2 bg-black/60 text-xs px-3 py-2 rounded">
                <div>room: {roomId}</div>
                <div>conn: {connStatus}</div>
                <div>src: {updateSource}</div>
                <div>ts: {lastUpdateTs ? new Date(lastUpdateTs).toLocaleTimeString() : '-'}</div>
            </div>
        )}
        </>
    );
};

export default LiveView;