import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL, API_URL, ENABLE_SOCKET, SOCKET_PATH, SIMPLE_MODE, DEFAULT_ROOM_ID, ENABLE_SUPABASE } from './config';
import { getWriteToken } from './lib/auth';
import { createMatch, appendEvents, finalizeMatch, validateMembers, createMatchStrict, createMatchPartial } from './lib/api';
import { RoomStorage } from './lib/RoomStorage';
import { State } from './lib/State';
import PlayerCard from './components/PlayerCard';
import { StatsEngine } from './lib/StatsEngine';
import { getRoomChannel } from './lib/supabase';
import { findRoomIdByCode } from './lib/roomCode';

interface ScoreboardProps {
    gameState: State | null;
    setGameState: React.Dispatch<React.SetStateAction<State | null>>;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ gameState, setGameState }) => {
    const { roomId: routeRoomId } = useParams<{ roomId: string }>();
    const slugId = SIMPLE_MODE ? DEFAULT_ROOM_ID : routeRoomId;
    const roomId = slugId ? (findRoomIdByCode(slugId) || slugId) : slugId; // 用於本機 RoomStorage
    const socketRoom = slugId; // 始終用房間號作為 socket 房間鍵，確保跨設備一致
    const navigate = useNavigate();
    const [socket, setSocket] = useState<Socket | null>(null);
    const supabaseChannelRef = useRef<any>(null);
    const [endModalDismissed, setEndModalDismissed] = useState(false);
    const [showFoulMenu, setShowFoulMenu] = useState(false);
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

        if (slugId) {
            newSocket.emit('join room', slugId);
        }

        newSocket.on('chat message', (msg) => {
            console.log(msg);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [roomId]);

    // Supabase Realtime channel（簡化版或無後端模式下的雲端同步）
    useEffect(() => {
        if (!roomId || !ENABLE_SUPABASE) {
            if (supabaseChannelRef.current) {
                try { supabaseChannelRef.current.unsubscribe(); } catch {}
            }
            supabaseChannelRef.current = null;
            return;
        }
        const ch = getRoomChannel(roomId);
        if (!ch) return;
        supabaseChannelRef.current = ch;
        ch.subscribe((status: string) => {
            if (status === 'SUBSCRIBED') {
                // 初次訂閱時，若有現有狀態，廣播一次供其他視圖初始化
                if (gameState) {
                    try { ch.send({ type: 'broadcast', event: 'state', payload: gameState.toJSON() }); } catch {}
                }
            }
        }).on('broadcast', { event: 'state' }, (payload: any) => {
            try {
                const deserialized = State.fromJSON(payload?.payload ?? payload);
                setGameState(deserialized);
            } catch {}
        });
        return () => {
            try { ch.unsubscribe(); } catch {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, ENABLE_SUPABASE]);

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

    // 當沒有後端同步且本地已有房間狀態時，嘗試從 RoomStorage 載入初始狀態
    useEffect(() => {
        if (!gameState && roomId) {
            try {
                const raw = RoomStorage.getState(roomId);
                if (raw) {
                    const restored = State.fromJSON(raw);
                    setGameState(restored);
                }
            } catch {}
        }
    }, [roomId, gameState, setGameState]);

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
                    socket.emit('update gameState', { roomId: socketRoom, newState: next });
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
            socket.emit('update gameState', { roomId: socketRoom, newState });
        }
        if (ENABLE_SUPABASE && supabaseChannelRef.current) {
            try { supabaseChannelRef.current.send({ type: 'broadcast', event: 'state', payload: newState.toJSON() }); } catch {}
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

    const handleToggleNewRules = () => {
        if (!gameState) return;
        const next = gameState.clone();
        next.settings.newRulesEnabled = !next.settings.newRulesEnabled;
        updateAndBroadcastState(next);
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

    const handleFoulRed = (count: number) => {
        if (!gameState) return;
        // Disable in clearing colours or respot black or when insufficient reds
        if (gameState.isClearingColours || gameState.isRespotBlack || gameState.redsRemaining < count) {
            return;
        }
        const newState = gameState.clone();
        newState.foulRed(count);
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

    // Manual adjust reds remaining (admin override), does not change scores
    const handleAdjustReds = (delta: number) => {
        if (!gameState) return;
        if (gameState.isFrameOver) return;
        const newState = gameState.clone();
        const nextValue = Math.max(0, Math.min(newState.settings.redBalls, newState.redsRemaining + delta));
        newState.adminAdjustRedsRemaining(nextValue);
        updateAndBroadcastState(newState);
    };

    const handlePotMultipleReds = (count: number) => {
        if (!gameState) return;
        // Allow only when reds are on table and a red is required, and not in special phases
        const invalid = gameState.isClearingColours || gameState.isRespotBlack || gameState.isFreeBall || !gameState.mustPotRed || gameState.redsRemaining < count;
        if (invalid) return;
        const newState = gameState.clone();
        // Implemented as a single cumulative pot event
        (newState as any).potMultipleReds?.(count);
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
        return (
            <div className="min-h-screen bg-green-900 text-white p-4 flex flex-col items-center justify-center">
                {slugId && (
                    <div
                        className="fixed left-3 bottom-3 z-40 pointer-events-none"
                        style={{ opacity: 0.65 }}
                    >
                        <span
                            className="text-white font-bold tracking-widest"
                            style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}
                        >
                            {slugId}
                        </span>
                    </div>
                )}
                <div className="bg-yellow-800 p-6 rounded-lg shadow-xl text-center max-w-md w-full">
                    <h2 className="text-2xl font-bold mb-2">尚未有比賽狀態</h2>
                    <p className="mb-4 text-sm text-gray-200">請先於 Setup 建立比賽，或等待同步來源提供狀態。</p>
                    {roomId && (
                        <button
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                            onClick={() => {
                                const qs = typeof window !== 'undefined' ? (window.location.search || '') : '';
                                navigate(`/room/${roomId}/setup${qs}`);
                            }}
                        >
                            前往 Setup
                        </button>
                    )}
                </div>
            </div>
        );
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

    // Compact mobile layout toggle via ?style=compact/mobile
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '') : null;
    const styleParam = params?.get('style') || undefined;
    const isCompactMobile = false;
    
    if (isCompactMobile) {
        return (
            <div className="min-h-screen bg-green-900 text-white p-3 flex flex-col">
                {slugId && (
                    <div
                        className="fixed left-3 bottom-3 z-40 pointer-events-none"
                        style={{ opacity: 0.65 }}
                    >
                        <span
                            className="text-white font-bold tracking-widest"
                            style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}
                        >
                            {slugId}
                        </span>
                    </div>
                )}
                {gameState.isFreeBall && (
                    <div className="fixed top-2 right-2 z-50 pointer-events-none">
                        <div className="bg-purple-600 text-white text-sm font-extrabold px-3 py-1.5 rounded-full shadow-lg ring-2 ring-purple-300 animate-pulse">
                            Free Ball
                        </div>
                    </div>
                )}
                {/* Current player */}
                <div className="flex items-center justify-between mb-2">
                    <div className="text-cyan-300 font-bold">
                        Scoring For: {gameState.players[gameState.currentPlayerIndex].name}
                    </div>
                    {gameState.isFreeBall && (
                        <div className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                            Free Ball
                        </div>
                    )}
                </div>
    
                {/* Ball buttons: FOUL + 1..7 */}
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <button
                    onClick={() => setShowFoulMenu(v => !v)}
                    className="p-3 rounded-lg bg-white hover:bg-gray-200 text-gray-900 font-bold border-2 border-black"
                  >
                    FOUL
                  </button>
                  {/* Reds and colours */}
                  {[1,2,3,4,5,6,7].map(ball => {
                    const isPottingColor = ball > 1;
                    const isPottingRed = ball === 1;
                    const expectedSequence = [2,3,4,5,6,7];
                    const nextBallInSequence = expectedSequence[gameState.pottedColors.length];
                
                    let isDisabled = false;
                    if (gameState.isRespotBlack) {
                      isDisabled = ball !== 7;
                    } else if (gameState.isFreeBall) {
                      // 自由球：
                      // - 紅球階段：可選任意彩球，禁用紅球
                      // - 清彩階段：禁用紅球；若仍有自由選彩，任何彩球可選；否則僅能選下一顆彩球
                      if (gameState.isClearingColours) {
                        if (gameState.isClearingColoursFreeChoicePending) {
                          isDisabled = (ball === 1);
                        } else {
                          isDisabled = (ball === 1) || (ball !== nextBallInSequence);
                        }
                      } else {
                        isDisabled = (ball === 1);
                      }
                    } else if (gameState.isClearingColours) {
                      if (gameState.isClearingColoursFreeChoicePending) {
                        isDisabled = (ball === 1);
                      } else {
                        isDisabled = ball !== nextBallInSequence;
                      }
                    } else {
                      isDisabled = (isPottingRed && !gameState.mustPotRed) || (isPottingColor && gameState.mustPotRed);
                    }
                    if (gameState.pottedColors.includes(ball)) {
                      isDisabled = true;
                    }
                
                    return (
                      <button
                        key={`ball-${ball}`}
                        onClick={() => handlePot(ball)}
                        disabled={isDisabled}
                        className={`p-3 font-bold text-lg text-white disabled:opacity-50 disabled:cursor-not-allowed ball-3d ${ballColors[ball]} border border-white`}
                      >
                        {ball}
                      </button>
                    );
                  })}
                </div>
                {showFoulMenu && (
                  <div className="mb-2">
                    <div className="grid grid-cols-4 gap-2">
                      {[4,5,6,7].map(penalty => (
                        <button
                          key={`foul-${penalty}`}
                          onClick={() => { setShowFoulMenu(false); handleFoul(penalty); }}
                          className="p-3 rounded-lg bg-white hover:bg-gray-200 text-gray-900 font-bold border-2 border-black"
                        >
                          {penalty}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Info: Reds Left + Break */}
                <div className="flex items-center justify-between mb-2">
                    <div className="text-yellow-300 font-extrabold">Reds Left {gameState.redsRemaining}</div>
                    <div className="text-yellow-300 font-extrabold">Break {gameState.breakScore}</div>
                </div>

                {/* Compact actions: Miss / Safety / Concede */}
                <div className={`grid ${gameState.isFoulCommitted ? 'grid-cols-4' : 'grid-cols-3'} gap-2 mb-2`}>
                    <button onClick={handleMiss} className="p-2 rounded-md bg-gray-600 hover:bg-gray-700 text-white font-bold border border-white">Miss</button>
                    <button onClick={handleSafe} className="p-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-bold border border-white">Safety</button>
                    <button onClick={handleConcede} className="p-2 rounded-md bg-red-800 hover:bg-red-900 text-white font-bold border border-white">Concede</button>
                    {gameState.isFoulCommitted && (
                        <button
                          onClick={handleToggleFreeBall}
                          className={`p-2 rounded-md font-bold ${gameState.isFreeBall ? 'bg-yellow-400 hover:bg-yellow-500 border-2 border-white text-black' : 'bg-yellow-700 hover:bg-yellow-800 border border-white text-white'}`}
                        >
                          Free Ball
                        </button>
                    )}
                </div>

                {/* Bottom scoreboard bar */}
                <div className="mt-auto">
                    <div className="flex items-center justify-between bg-black/60 rounded px-3 py-2">
                        <div className={`flex-1 font-bold ${gameState.currentPlayerIndex===0 ? 'bg-yellow-600 text-black rounded px-2 py-1' : ''}`}>\
                            {gameState.players[0].name} ({gameState.players[0].framesWon})
                        </div>
                        <div className="text-2xl font-extrabold px-4">
                            {gameState.players[0].score}
                        </div>
                        <div className="text-2xl font-extrabold px-4">
                            {gameState.players[1].score}
                        </div>
                        <div className={`flex-1 text-right font-bold ${gameState.currentPlayerIndex===1 ? 'bg-yellow-600 text-black rounded px-2 py-1' : ''}`}>\
                            {gameState.players[1].name} ({gameState.players[1].framesWon})
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-green-900 text-white p-4 flex flex-col items-center">
            {slugId && (
                <div
                    className="fixed left-3 bottom-3 z-40 pointer-events-none"
                    style={{ opacity: 0.65 }}
                >
                    <span
                        className="text-white font-bold tracking-widest"
                        style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}
                    >
                        {slugId}
                    </span>
                </div>
            )}
            {!SIMPLE_MODE && gameState.isMatchOver && !endModalDismissed && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-yellow-800 p-8 rounded-lg shadow-xl text-center">
                        <h2 className="text-2xl font-bold mb-4">比賽結束</h2>
                        <p className="mb-6">是否上傳本房間的所有比賽結果與記錄到資料庫？</p>
                        <div className="flex justify-center space-x-4">
                            <button 
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                                onClick={async () => {
                                    const qs = typeof window !== 'undefined' ? (window.location.search || '') : '';
                                    const target = roomId ? `/room/${roomId}/live${qs}` : `/room/preview/live${qs}`;
                                    if (!roomId) {
                                        alert('缺少房間 ID，無法上傳');
                                        // 不上傳但仍導向 Live
                                        setEndModalDismissed(true);
                                        navigate(target);
                                        return;
                                    }
                                    const p1Id = (gameState.players[0].memberId || '').trim();
                                    const p2Id = (gameState.players[1].memberId || '').trim();
                                    const hasP1 = !!p1Id;
                                    const hasP2 = !!p2Id;
                                    if (!hasP1 && !hasP2) {
                                        alert('已跳過上傳：雙方皆無 MEMBER ID');
                                        setEndModalDismissed(true);
                                        navigate(target);
                                        return;
                                    }

                                    try {
                                        const record = StatsEngine.buildMatchRecord(roomId!, gameState);
                                        const uploadRoomId = slugId || roomId!;

                                        const idsToCheck = [p1Id, p2Id].filter(Boolean) as string[];
                                        const check = idsToCheck.length ? await validateMembers(API_URL, idsToCheck) : { exists: {} as Record<string, boolean> };
                                        const validIds = idsToCheck.filter(id => check.exists[id]);
                                        if (validIds.length === 0) {
                                            alert('已跳過上傳：無有效的 MEMBER ID');
                                            setEndModalDismissed(true);
                                            navigate(target);
                                            return;
                                        }

                                        const playersPayload = record.players.map((p, i) => ({
                                            name: p.name,
                                            memberId: i === 0 ? (validIds.includes(p1Id || '') ? p1Id! : null) : (validIds.includes(p2Id || '') ? p2Id! : null),
                                        }));

                                        const writeToken = getWriteToken();
                                        const { matchId, acceptedMemberIds } = await createMatchPartial(
                                            API_URL,
                                            uploadRoomId,
                                            record.match,
                                            playersPayload,
                                            { start: record.timestamps.start },
                                            writeToken,
                                        );

                                        // 追加事件
                                        const filteredEvents = record.events.filter(e => acceptedMemberIds.includes(String(e.playerMemberId || '')));
                                        await appendEvents(
                                            API_URL,
                                            matchId,
                                            filteredEvents.map(e => ({
                                                type: e.type,
                                                playerIndex: e.playerIndex,
                                                playerMemberId: e.playerMemberId,
                                                ballName: e.ballName,
                                                points: e.points,
                                                timestamp: e.timestamp,
                                                shotTimeMs: e.shotTimeMs,
                                            })),
                                            writeToken,
                                        );

                                        // 最終定案（包含統計、犯規總和、結束時間與勝方）
                                        const winnerMemberId = (record.winnerIndex !== null)
                                            ? (acceptedMemberIds.includes(String(record.players[record.winnerIndex].memberId || '')) ? (record.players[record.winnerIndex].memberId || null) : null)
                                            : null;
                                        await finalizeMatch(
                                            API_URL,
                                            matchId,
                                            {
                                                foulTotals: record.foulTotals,
                                                stats: record.stats,
                                                timestamps: { end: record.timestamps.end },
                                                winnerMemberId,
                                                playersFinal: record.players,
                                                match: record.match,
                                            },
                                            writeToken,
                                        );

                                        alert('比賽資料已上傳完成');
                                        setEndModalDismissed(true);
                                        navigate(target);
                                    } catch (err: any) {
                                        console.error(err);
                                        alert(`上傳失敗：${String(err?.message || err)}`);
                                        // 失敗仍導向 Live
                                        setEndModalDismissed(true);
                                        navigate(target);
                                    }
                                }}
                            >
                                是
                            </button>
                            <button 
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                                onClick={() => {
                                    const qs = typeof window !== 'undefined' ? (window.location.search || '') : '';
                                    const target = roomId ? `/room/${roomId}/live${qs}` : `/room/preview/live${qs}`;
                                    setEndModalDismissed(true);
                                    navigate(target);
                                }}
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

                {/* 已移除 Live View URL 與新規則（試驗）區塊，以保持最小化畫面 */}

                <div className="grid grid-cols-2 gap-6 mb-6">
                    {gameState.players.map((player, index) => (
                        <PlayerCard
                            key={player.memberId}
                            player={player}
                            isCurrentPlayer={gameState.currentPlayerIndex === index}
                            isFreeBall={gameState.isFreeBall && gameState.currentPlayerIndex === index}
                            handicapRaw={Array.isArray(gameState.settings.handicaps) ? gameState.settings.handicaps[index] : undefined}
                        />
                    ))}
                </div>


                
                {/* 移除 Frame Time / Match Time 區塊 */}
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
                                // 自由球規則：
                                // - 紅球階段：可選任意彩球作為紅球，不能選紅球
                                // - 清彩階段：不能選紅球；若仍有「自由選彩」機會，任何彩球皆可；否則僅能選序列的下一顆彩球
                                if (gameState.isClearingColours) {
                                    if (gameState.isClearingColoursFreeChoicePending) {
                                        isDisabled = (ball === 1);
                                    } else {
                                        isDisabled = (ball === 1) || (ball !== nextBallInSequence);
                                    }
                                } else {
                                    // 紅球仍在：自由球僅允許彩球
                                    isDisabled = (ball === 1);
                                }
                            } else if (gameState.isClearingColours) {
                                // 修正：最後紅球後的第一桿可自由選彩球（不可紅）
                                if (gameState.isClearingColoursFreeChoicePending) {
                                    isDisabled = (ball === 1);
                                } else {
                                    isDisabled = ball !== nextBallInSequence;
                                }
                            } else {
                                isDisabled = (isPottingRed && !gameState.mustPotRed) || (isPottingColor && gameState.mustPotRed);
                            }

                            // 已在清彩序列中被移除的彩球不可再選（自由球亦不可選擇已清掉的彩球）
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
                    <div className="grid grid-cols-7 gap-2">
                        {[4, 5, 6, 7].map(penalty => (
                            <button key={penalty} onClick={() => handleFoul(penalty)} className="p-4 rounded-lg bg-white hover:bg-gray-200 text-gray-800 font-bold border-2 border-black">Foul {penalty}</button>
                        ))}
                    </div>
                </div>

                {/* Multi-Red（同桿）按鍵移至底部不常用區塊 */}

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

                {/* 將不常用的按鍵移至底部：Red ×2 / ×3；取消 Foul Red，改為手動調整紅球餘數 */}
                <div className="mt-6">
                    <div className="grid grid-cols-2 gap-4 justify-items-center">
                        <button
                            onClick={() => handlePotMultipleReds(2)}
                            disabled={gameState.isClearingColours || gameState.isRespotBlack || gameState.isFreeBall || !gameState.mustPotRed || gameState.redsRemaining < 2}
                            className="p-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold border border-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Red ×2
                        </button>
                        <button
                            onClick={() => handlePotMultipleReds(3)}
                            disabled={gameState.isClearingColours || gameState.isRespotBlack || gameState.isFreeBall || !gameState.mustPotRed || gameState.redsRemaining < 3}
                            className="p-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-bold border border-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Red ×3
                        </button>
                    </div>
                    <div className="mt-4 p-3 border rounded">
                        <div className="mb-2 font-semibold text-center">調整紅球餘數（不影響分數）</div>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                className="px-3 py-1.5 rounded font-semibold bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleAdjustReds(-1)}
                                disabled={gameState.redsRemaining <= 0 || gameState.isFrameOver}
                            >
                                -1
                            </button>
                            <div className="text-lg font-bold">目前：{gameState.redsRemaining}</div>
                            <button
                                className="px-3 py-1.5 rounded font-semibold bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleAdjustReds(1)}
                                disabled={gameState.redsRemaining >= gameState.settings.redBalls || gameState.isFrameOver}
                            >
                                +1
                            </button>
                        </div>
                    </div>
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

                {/* Match Over overlay disabled: Scoreboard now auto-redirects to Live */}
            </div>
        </div>
    );
};

export default Scoreboard;
