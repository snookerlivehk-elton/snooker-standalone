import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, API_URL, ENABLE_SOCKET, SOCKET_PATH, SIMPLE_MODE, DEFAULT_ROOM_ID } from './config';
import { RoomStorage } from './lib/RoomStorage';
import { State } from './lib/State';
import PlayerCard from './components/PlayerCard';
import { StatsEngine } from './lib/StatsEngine';

interface ScoreboardProps {
    gameState: State | null;
    setGameState: React.Dispatch<React.SetStateAction<State | null>>;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ gameState, setGameState }) => {
    const { roomId: routeRoomId } = useParams<{ roomId: string }>();
    const roomId = SIMPLE_MODE ? DEFAULT_ROOM_ID : routeRoomId;
    const navigate = useNavigate();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [endModalDismissed, setEndModalDismissed] = useState(false);
    // 當本地送出更新後，忽略一次伺服器回送，避免覆蓋本地 history 造成 UNDO 失效
    const ignoreNextSocketUpdateRef = useRef(false);
    const baseUrl = (import.meta.env.BASE_URL || '/');
    const liveViewUrl = roomId ? `${window.location.origin}${baseUrl}room/${roomId}/live` : `${window.location.origin}${baseUrl}`;

    useEffect(() => {
        // 簡化模式：若尚未建立比賽狀態，初始化為預設單場
        if (SIMPLE_MODE && !gameState) {
            try {
                const initial = new State({
                    playersInfo: [
                        { name: 'Player A', memberId: 'P1' },
                        { name: 'Player B', memberId: 'P2' },
                    ],
                    settings: { matchName: 'Simple Match', redBalls: 15, framesRequired: 1 },
                    startingPlayerIndex: 0,
                });
                setGameState(initial);
            } catch {}
        }
    }, [SIMPLE_MODE, gameState, setGameState]);

    useEffect(() => {
        if (!ENABLE_SOCKET) {
            setSocket(null);
            return;
        }
        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            path: SOCKET_PATH,
            reconnection: true,
            reconnectionAttempts: Infinity,
        });
        setSocket(newSocket);

        if (roomId) {
            newSocket.emit('join room', roomId);
        }

        newSocket.on('chat message', (msg) => {
            console.log(msg);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [roomId]);

    useEffect(() => {
        if (socket) {
            socket.on('gameState updated', (newGameState) => {
                // 若此更新為本地剛發送的回送，跳過以保留本地 history
                if (ignoreNextSocketUpdateRef.current) {
                    ignoreNextSocketUpdateRef.current = false;
                    return;
                }
                const deserializedState = State.fromJSON(newGameState);
                setGameState(deserializedState);
            });
        }
    }, [socket, setGameState]);

    // 每秒遞增計時（僅在 playing 狀態），並同步至其他視圖
    useEffect(() => {
        const id = setInterval(() => {
            setGameState((prev) => {
                if (!prev) return prev;
                if (prev.status !== 'playing') return prev;
                const next = prev.clone();
                next.timers.frameTime += 1;
                next.timers.matchTime += 1;
                if (next.breakScore > 0) next.breakTime += 1;
                // 廣播到房間（若啟用 socket）
                if (socket) {
                    ignoreNextSocketUpdateRef.current = true;
                    socket.emit('update gameState', { roomId, newState: next });
                }
                // 持久化到本地儲存供 Overlay/LiveView 輪詢
                if (roomId) {
                    try {
                        RoomStorage.setState(roomId!, next.toJSON());
                    } catch {}
                }
                return next;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [roomId, socket]);

    const updateAndBroadcastState = (newState: State) => {
        if (socket) {
            // 標記忽略下一次回送更新（伺服器會回送給發送者）
            ignoreNextSocketUpdateRef.current = true;
            socket.emit('update gameState', { roomId, newState });
        }
        setGameState(newState);
        if (roomId) {
            // 持久化序列化狀態以供 Overlay/LiveView 在無後端模式下讀取
            try {
                RoomStorage.setState(roomId!, newState.toJSON());
            } catch {}
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(liveViewUrl).then(() => {
            alert('Live view URL copied to clipboard!');
        });
    };

    const handlePot = (ball: number) => {
        const newState = gameState!.clone();
        newState.pot(ball);
        if (roomId) {
            const lastShot = newState.shotHistory[newState.shotHistory.length - 1];
            if (lastShot && lastShot.type === 'pot') {
                RoomStorage.appendEvent(roomId!, {
                    type: 'pot',
                    playerIndex: lastShot.player,
                    playerMemberId: newState.players[lastShot.player].memberId,
                    ballName: lastShot.ball,
                    points: lastShot.points,
                });
            }
        }
        updateAndBroadcastState(newState);
    };

    const handleFoul = (penalty: number) => {
        const newState = gameState!.clone();
        newState.foul(penalty);
        if (roomId) {
            const lastShot = newState.shotHistory[newState.shotHistory.length - 1];
            if (lastShot && lastShot.type === 'foul') {
                RoomStorage.appendEvent(roomId!, {
                    type: 'foul',
                    playerIndex: lastShot.player,
                    playerMemberId: newState.players[lastShot.player].memberId,
                    points: lastShot.points,
                });
                RoomStorage.incrementFoulTotal(roomId!, lastShot.player, lastShot.points || 0);
            }
        }
        updateAndBroadcastState(newState);
    };

    const handleSwitchPlayer = () => {
        const newState = gameState!.clone();
        if (roomId) {
            const prevIndex = newState.currentPlayerIndex;
            RoomStorage.appendEvent(roomId!, {
                type: 'switch',
                playerIndex: prevIndex,
                playerMemberId: newState.players[prevIndex].memberId,
            });
        }
        newState.switchPlayer();
        updateAndBroadcastState(newState);
    };

    const handleUndo = () => {
        if (!gameState) return;
        // 每次按一次回退一步
        let popped = 0;
        const ev = roomId ? RoomStorage.popLastEvent(roomId!) : null;
        if (ev) {
            popped = 1;
            if (ev.type === 'foul' && typeof ev.points === 'number') {
                RoomStorage.decrementFoulTotal(roomId!, ev.playerIndex, ev.points);
            }
        }
        const newState = popped ? gameState.undoSteps(1) : gameState.undo();
        updateAndBroadcastState(newState);
    };

    const handleNewFrame = () => {
        const newState = gameState!.clone();
        if (roomId) {
            RoomStorage.appendEvent(roomId!, {
                type: 'newFrame',
                playerIndex: newState.currentPlayerIndex,
                playerMemberId: newState.players[newState.currentPlayerIndex].memberId,
            });
        }
        newState.newFrame();
        updateAndBroadcastState(newState);
    };

    const handleConcede = () => {
        if (window.confirm('Are you sure you want to concede the frame?')) {
            const newState = gameState!.clone();
            if (roomId) {
                RoomStorage.appendEvent(roomId!, {
                    type: 'concede',
                    playerIndex: newState.currentPlayerIndex,
                    playerMemberId: newState.players[newState.currentPlayerIndex].memberId,
                });
            }
            newState.concede();
            updateAndBroadcastState(newState);
        }
    };

    const handleMiss = () => {
        const newState = gameState!.clone();
        if (roomId) {
            const shooter = newState.currentPlayerIndex;
            RoomStorage.appendEvent(roomId!, {
                type: 'miss',
                playerIndex: shooter,
                playerMemberId: newState.players[shooter].memberId,
                points: 0,
            });
        }
        newState.miss();
        updateAndBroadcastState(newState);
    };

    const handleSafe = () => {
        const newState = gameState!.clone();
        if (roomId) {
            const shooter = newState.currentPlayerIndex;
            RoomStorage.appendEvent(roomId!, {
                type: 'safe',
                playerIndex: shooter,
                playerMemberId: newState.players[shooter].memberId,
                points: 0,
            });
        }
        newState.safe();
        updateAndBroadcastState(newState);
    };

    const handleToggleFreeBall = () => {
        const newState = gameState!.clone();
        if (roomId) {
            RoomStorage.appendEvent(roomId!, {
                type: 'freeBallToggle',
                playerIndex: newState.currentPlayerIndex,
                playerMemberId: newState.players[newState.currentPlayerIndex].memberId,
            });
        }
        newState.toggleFreeBall();
        updateAndBroadcastState(newState);
    };

    if (!gameState) {
        return <div className="min-h-screen bg-green-900 text-white p-4 flex flex-col items-center justify-center">Loading...</div>;
    }

    const remainingPoints = gameState.getRemainingPoints();
    const lead = Math.abs(gameState.players[0].score - gameState.players[1].score);
    const leader = gameState.players[0].score > gameState.players[1].score ? gameState.players[0] : gameState.players[1];
    const lastShot = gameState.shotHistory[gameState.shotHistory.length - 1];

    const ballColors: { [key: number]: string } = {
        1: 'bg-red-600',
        2: 'bg-yellow-400',
        3: 'bg-green-600',
        4: 'bg-yellow-800', // Brown
        5: 'bg-blue-600',
        6: 'bg-pink-500',
        7: 'bg-black',
    };

    return (
        <div className="min-h-screen bg-green-900 text-white p-4 flex flex-col items-center">
            {!SIMPLE_MODE && gameState.isMatchOver && !endModalDismissed && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-yellow-800 p-8 rounded-lg shadow-xl text-center">
                        <h2 className="text-2xl font-bold mb-4">比賽結束</h2>
                        <p className="mb-6">是否上傳本房間的所有比賽結果與記錄到資料庫？</p>
                        <div className="flex justify-center space-x-4">
                            <button 
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                                onClick={async () => {
                                    if (!roomId) {
                                        alert('缺少房間 ID，無法上傳');
                                        return;
                                    }
                                    const p1Id = (gameState.players[0].memberId || '').trim();
                                    const p2Id = (gameState.players[1].memberId || '').trim();
                                    const hasP1 = !!p1Id;
                                    const hasP2 = !!p2Id;

                                    // 規則：若雙方都沒有 MEMBER ID，則忽略上傳
                                    if (!hasP1 && !hasP2) {
                                        alert('已跳過上傳：雙方球手皆無 MEMBER ID');
                                        setEndModalDismissed(true);
                                        return;
                                    }

                                    try {
                                        const record = StatsEngine.buildMatchRecord(roomId!, gameState);

                                        // 構造 /api/matches 請求（至少一方有 MEMBER ID 才會上傳）
                                        const playersPayload = record.players.map((p, i) => ({
                                            name: p.name,
                                            // 若沒有 MEMBER ID，視為未知球手：傳 null 以告知後端建立暫存或占位。
                                            memberId: i === 0 ? (hasP1 ? p1Id : null) : (hasP2 ? p2Id : null),
                                        }));

                                        const createRes = await fetch(`${API_URL}/api/matches`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                roomId,
                                                match: record.match,
                                                players: playersPayload,
                                                timestamps: { start: record.timestamps.start },
                                            }),
                                        });
                                        if (!createRes.ok) throw new Error(`建立比賽失敗 (${createRes.status})`);
                                        const { matchId } = await createRes.json();

                                        // 追加事件
                                        const eventsRes = await fetch(`${API_URL}/api/matches/${matchId}/events`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                events: record.events.map(e => ({
                                                    type: e.type,
                                                    playerIndex: e.playerIndex,
                                                    playerMemberId: e.playerMemberId,
                                                    ballName: e.ballName,
                                                    points: e.points,
                                                    timestamp: e.timestamp,
                                                    shotTimeMs: e.shotTimeMs,
                                                })),
                                            }),
                                        });
                                        if (!eventsRes.ok) throw new Error(`上傳事件失敗 (${eventsRes.status})`);

                                        // 最終定案（包含統計、犯規總和、結束時間與勝方）
                                        const winnerMemberId = (record.winnerIndex !== null)
                                            ? (record.players[record.winnerIndex].memberId || null)
                                            : null;
                                        const finalizeRes = await fetch(`${API_URL}/api/matches/${matchId}/finalize`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                foulTotals: record.foulTotals,
                                                stats: record.stats,
                                                timestamps: { end: record.timestamps.end },
                                                winnerMemberId,
                                            }),
                                        });
                                        if (!finalizeRes.ok) throw new Error(`Finalize 失敗 (${finalizeRes.status})`);

                                        alert('比賽資料已上傳完成');
                                        setEndModalDismissed(true);
                                    } catch (err: any) {
                                        console.error(err);
                                        alert(`上傳失敗：${String(err?.message || err)}`);
                                    }
                                }}
                            >
                                是
                            </button>
                            <button 
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                                onClick={() => setEndModalDismissed(true)}
                            >
                                否
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="w-full max-w-5xl mx-auto">
                <div className="text-center mb-4">
                    <h1 className="text-3xl font-bold tracking-wider">{gameState.settings.matchName}</h1>
                    <p className="text-xl text-gray-400">{gameState.players[0].framesWon} ({gameState.settings.framesRequired}) {gameState.players[1].framesWon}</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center">
                    <p className="text-lg font-semibold">Live View URL</p>
                    <div className="flex items-center justify-center mt-2">
                        <Link to={liveViewUrl} target="_blank" className="text-blue-400 hover:underline break-all">{liveViewUrl}</Link>
                        <button onClick={copyToClipboard} className="ml-4 p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold">Copy</button>
                    </div>
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

                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2 text-center">Balling</h2>
                    <div className="grid grid-cols-7 gap-2">
                        {[1, 2, 3, 4, 5, 6, 7].map(ball => {
                            const isPottingColor = ball > 1;
                            const isPottingRed = ball === 1;
                            const expectedSequence = [2, 3, 4, 5, 6, 7];
                            const nextBallInSequence = expectedSequence[gameState.pottedColors.length];

                            let isDisabled = false;
                            if (gameState.isRespotBlack) {
                                isDisabled = ball !== 7;
                            } else if (gameState.isFreeBall) {
                                isDisabled = false; // All balls are available on a free ball
                            } else if (gameState.isClearingColours) {
                                isDisabled = ball !== nextBallInSequence;
                            } else {
                                isDisabled = (isPottingRed && !gameState.mustPotRed) || (isPottingColor && gameState.mustPotRed);
                            }

                            if (gameState.pottedColors.includes(ball)) {
                                isDisabled = true;
                            }

                            return (
                                <button 
                                    key={ball} 
                                    onClick={() => handlePot(ball)} 
                                    disabled={isDisabled}
                                    className={`p-4 font-bold text-xl text-white disabled:opacity-50 disabled:cursor-not-allowed ball-3d ${ballColors[ball]} border border-white`}
                                >
                                    {ball}
                                </button>
                            );
                        })}
                    </div>
                    {gameState.isRespotBlack && (
                        <p className="text-center text-yellow-400 font-bold mt-2">Re-spot Black</p>
                    )}
                </div>



                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-2 text-center">Fouls</h2>
                    <div className="grid grid-cols-4 gap-2">
                        {[4, 5, 6, 7].map(penalty => (
                            <button key={penalty} onClick={() => handleFoul(penalty)} className="p-4 rounded-lg bg-white hover:bg-gray-200 text-gray-800 font-bold border-2 border-black">Foul {penalty}</button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button onClick={handleSwitchPlayer} className="p-4 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-black font-bold border border-white">Switch Player</button>
                    <button onClick={handleMiss} className="p-4 rounded-lg bg-gray-600 hover:bg-gray-700 font-bold border border-white">Miss</button>
                    <button onClick={handleSafe} className="p-4 rounded-lg bg-blue-500 hover:bg-blue-600 font-bold border border-white">Safe</button>
                    {gameState.isFoulCommitted && (
                        <button onClick={handleToggleFreeBall} className={`p-4 rounded-lg font-bold ${gameState.isFreeBall ? 'bg-yellow-400 hover:bg-yellow-500 border-4 border-white' : 'bg-yellow-700 hover:bg-yellow-800 border border-white'}`}>Free Ball</button>
                    )}
                    <button onClick={handleUndo} className="p-4 rounded-lg bg-gray-500 hover:bg-gray-600 font-bold border border-white">Undo</button>
                    <button onClick={handleConcede} className="p-4 rounded-lg bg-red-800 hover:bg-red-900 font-bold col-span-2 md:col-span-2 border border-white">Concede Frame</button>
                </div>

                {gameState.isFrameOver && (
                    <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center">
                        <div className="bg-gray-800 p-8 rounded-lg text-center">
                            <h2 className="text-4xl font-bold mb-4">Frame Over</h2>
                            <p className="text-2xl mb-6">{gameState.players[0].score > gameState.players[1].score ? gameState.players[0].name : gameState.players[1].name} wins the frame!</p>
                            <button onClick={handleNewFrame} className="p-4 rounded-lg bg-green-600 hover:bg-green-700 font-bold text-xl border border-white">Next Frame</button>
                        </div>
                    </div>
                )}

                {gameState.isMatchOver && (
                    <div className="absolute inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center">
                        <div className="bg-gray-800 p-8 rounded-lg text-center">
                            <h2 className="text-4xl font-bold mb-4">Match Over</h2>
                            <p className="text-2xl mb-6">
                                {(() => {
                                    const winner = gameState.getWinner();
                                    return winner ? `${winner.name} wins the match!` : 'Match Drawn';
                                })()}
                            </p>
                            <button onClick={() => {
                                if (roomId) {
                                    navigate(`/room/${roomId}/live`);
                                }
                            }} className="p-4 rounded-lg bg-blue-600 hover:bg-blue-700 font-bold text-xl border border-white">View Summary</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Scoreboard;