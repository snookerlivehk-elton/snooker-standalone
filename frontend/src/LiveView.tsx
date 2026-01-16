import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { State } from './lib/State';
import PlayerCard from './components/PlayerCard';
import { StatsEngine, MatchStats } from './lib/StatsEngine';
import { SOCKET_URL, ENABLE_SOCKET, SOCKET_PATH, ENABLE_SUPABASE } from './config';
import { findRoomIdByCode } from './lib/roomCode';
import { RoomStorage } from './lib/RoomStorage';
import { getRoomChannel } from './lib/supabase';
import { parseMatchName } from './lib/matchName';

const LiveView: React.FC = () => {
    const { roomId: routeRoomId } = useParams<{ roomId: string }>();
    const slugId = routeRoomId;
    const roomId = routeRoomId ? (findRoomIdByCode(routeRoomId) || routeRoomId) : routeRoomId; // 本機 RoomStorage 鍵
    const socketRoom = slugId; // 始終用房間號作為 socket 房間鍵
    // LiveView 銝?閬?銋?摮?socket 撖虫?嚗?雿輻霈霅血?
    const [gameState, setGameState] = useState<State | null>(null);
    const defaultPlayerStats = (idx: number) => ({
        playerIndex: idx,
        totalShots: 0,
        potCount: 0,
        totalPoints: 0,
        potRate: 0,
        potSuccessRate: 0,
        potOverMissRate: 0,
        avgShotTimeMs: 0,
        avgRoundShotTimeMs: 0,
        quickShotCount: 0,
        quickShotRate: 0,
        maxBreakPoints: 0,
        safeCount: 0,
        safeSuccessRate: 0,
        safeNumerator: 0,
        safeDenominator: 0,
        foulCount: 0,
        foulPointsGiven: 0,
        missCount: 0,
        switchCount: 0,
        redSuccessRate: 0,
        colorSuccessRate: 0,
        redNumerator: 0,
        redDenominator: 0,
        colorNumerator: 0,
        colorDenominator: 0,
        entryRate: 0,
        entrySuccessRate: 0,
        entryNumerator: 0,
        entryDenominator: 0,
        pressureRatio: 0,
        potByBall: { red: 0, yellow: 0, green: 0, brown: 0, blue: 0, pink: 0, black: 0 },
        shotTimeBuckets: [0, 0, 0, 0],
        break20_29: 0,
        break30_49: 0,
        break50_79: 0,
        break80_99: 0,
        break100_146: 0,
        break147: 0,
    });
    const [stats, setStats] = useState<MatchStats>(() => roomId ? StatsEngine.compute(roomId) : {
        perPlayer: [defaultPlayerStats(0), defaultPlayerStats(1)],
        eventsCount: 0,
    });
    const [showEndModal, setShowEndModal] = useState(false);
    const [statsPage, setStatsPage] = useState(0);
    const totalPages = 1;
    // 隤輯岫嚗＊蝷箸?唬?皞???????
    const [connStatus, setConnStatus] = useState<'init' | 'socket_connected' | 'socket_error' | 'socket_disconnected'>('init');
    const [updateSource, setUpdateSource] = useState<'none' | 'storage' | 'socket'>('none');
    const [lastUpdateTs, setLastUpdateTs] = useState<number | null>(null);
    const [eventsRevision, setEventsRevision] = useState(0);
    // 憓?????蝡舫???剁?隞乩噶 LiveView 銋??銝血誨??
    const socketRef = useRef<any>(null);
    const supabaseChannelRef = useRef<any>(null);
    // 蝘駁??摰儔嚗ormatTime 撌脣銝摰??
    const debug = useMemo(() => {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('debug') === 'true';
        } catch { return false; }
    }, []);
    // socket 憭望???頛芾岷?
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
                    try { setEventsRevision(RoomStorage.getEvents(roomId!).length); } catch {}
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
        // ?誑?祆??脣?????箏?憪＊蝷綽??喃蝙??socket 璅∪?嚗??踹??活??輸????翰??
        if (roomId) {
            const raw = RoomStorage.getState(roomId!);
            if (raw) {
                try {
                    const deserializedState = State.fromJSON(raw);
                    setGameState(deserializedState);
                    setUpdateSource('storage');
                    setLastUpdateTs(Date.now());
                    try { setEventsRevision(RoomStorage.getEvents(roomId!).length); } catch {}
                } catch {}
            }
        }
        // ??socket 璅∪?銝???撣豢?頛芾岷嚗??storage 鈭辣?冽?鈭憓閫貊???湔瞍
        startPolling();
        // ??socket 璅∪?銋??storage 鈭辣嚗Ⅱ靽 Scoreboard ?函敺垢璅∪??湔?砍?脣???LiveView 隞?芸??湔
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
                    try { setEventsRevision(RoomStorage.getEvents(roomId!).length); } catch {}
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

        if (socketRoom) {
            newSocket.emit('join room', socketRoom);
        }

        socketRef.current = newSocket;

        newSocket.on('gameState updated', (newGameState) => {
            // 隞?State.fromJSON 甇?Ⅱ????嚗?遣瑽???賊??航炊???any
            const deserializedState = State.fromJSON(newGameState);
            setGameState(deserializedState);
            setUpdateSource('socket');
            setLastUpdateTs(Date.now());
                    try { setEventsRevision(RoomStorage.getEvents(roomId!).length); } catch {}
        });

        // ????????銝??迫頛芾岷嚗?
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
            socketRef.current = null;
            stopPolling();
            window.removeEventListener('storage', onStorage);
        };
    }, [roomId]);

    // Supabase Realtime嚗陛???敺垢璅∪?銝??脩垢?郊嚗?
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
                // ?活閮???交??暹????撱?銝甈∩??嗡?閬?????
                if (gameState) {
                    try { ch.send({ type: 'broadcast', event: 'state', payload: gameState.toJSON() }); } catch {}
                }
            }
        }).on('broadcast', { event: 'state' }, (payload: any) => {
            try {
                const deserialized = State.fromJSON(payload?.payload ?? payload);
                setGameState(deserialized);
                // 銝??updateSource ?嚗????蝔桐?皞?閮?
                setLastUpdateTs(Date.now());
                    try { setEventsRevision(RoomStorage.getEvents(roomId!).length); } catch {}
            } catch {}
        });
        return () => {
            try { ch.unsubscribe(); } catch {}
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roomId, ENABLE_SUPABASE]);

    const updateAndBroadcastState = (newState: State) => {
        // Socket 撱?
        if (socketRef.current) {
            try { socketRef.current.emit('update gameState', { roomId: socketRoom, newState }); } catch {}
        }
        // Supabase 撱?嚗敺垢?陛?芋撘?
        if (ENABLE_SUPABASE && supabaseChannelRef.current) {
            try { supabaseChannelRef.current.send({ type: 'broadcast', event: 'state', payload: newState.toJSON() }); } catch {}
        }
        // ?砍????
        setGameState(newState);
        // ????砍靘?Overlay/LiveView 頛芾岷
        if (roomId) {
            try { RoomStorage.setState(roomId!, newState.toJSON()); } catch {}
        }
    };

    

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    // Hooks 敹??其遙雿?賜? return 銋??箏??澆??
    // 雿輻??葉??isMatchOver嚗? State.checkMatchOver ??蝢拐???
    const isMatchOver = useMemo(() => gameState?.isMatchOver ?? false, [gameState?.isMatchOver]);

    useEffect(() => {
        if (!roomId) return;
        // ?寧撣?state ??蝞??嚗Ⅱ靽?⊥璈?events ?郊???單??湔
        setStats(StatsEngine.compute(roomId, gameState));
    }, [
        roomId,
        eventsRevision,
        gameState?.shotHistory.length,
        gameState?.currentPlayerIndex,
        gameState?.players[0].score,
        gameState?.players[1].score,
    ]);

    // ?芸?頛芣蝯梯??嚗? 8 蝘?
    useEffect(() => {
        const timer = setInterval(() => {
            setStatsPage((p) => (p + 1) % totalPages);
        }, 8000);
        return () => clearInterval(timer);
    }, [totalPages]);

    // Disable end-of-match summary popup for Live Link
    // useEffect(() => {
    //     if (isMatchOver) setShowEndModal(true);
    // }, [isMatchOver]);

    if (!gameState) {
        return (
            <div className="min-h-screen bg-gray-900 text-white flex justify-center items-center">
                {slugId && (
          <div
            className="fixed left-3 bottom-3 z-50 pointer-events-none"
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

    const nameRaw = gameState.settings.matchName || '';
    const parsed = parseMatchName(nameRaw);
    const codeFromState = gameState.settings.matchCode || parsed.codePart || null;
    const displayCode = (() => {
        if (!slugId) return codeFromState;
        const pattern = /^[A-Z]{5}\d{4}$/;
        if (pattern.test(slugId)) return slugId;
        return codeFromState || slugId;
    })();
    const displayTitle = (() => {
        const namePart = parsed.namePart || nameRaw || 'Snooker Match';
        if (displayCode) return `[${displayCode}] ${namePart}`;
        return namePart;
    })();

    return (
        <>
        <div className="live-stage-viewport bg-transparent text-white">
            {/* 避免 Tailwind 的 p-2 覆蓋自訂的 padding-top，改用 px/pb */}
            <div className="live-stage-1920 px-2 pb-2">
            {/* 還原主內容容器外距，改以父容器 padding-top 控制 */}
            <div className="w-full max-w-[1680px] mx-auto">
                <div className="text-center mb-2">
                    <h1
                        className="text-3xl font-extrabold tracking-widest drop-shadow-md"
                        style={{
                            WebkitTextStroke: '2px #f5d000',
                            textShadow:
                                '1px 1px 0 #f5d000, -1px 1px 0 #f5d000, 1px -1px 0 #f5d000, -1px -1px 0 #f5d000',
                        }}
                    >
                        {displayTitle}
                    </h1>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                    {gameState.players.map((player, index) => (
                        <div className="scale-90">
                            <PlayerCard
                                key={player.memberId}
                                player={player}
                                isCurrentPlayer={gameState.currentPlayerIndex === index}
                                isFreeBall={gameState.isFreeBall && gameState.currentPlayerIndex === index}
                            />
                        </div>
                    ))}
                </div>
                {/* Fouls/Miss/Safe 已移到 PlayerCard，移除雙側統計列以縮減高度 */}

                <div className="bg-gray-800 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between">
                        <div className="text-center w-1/3">
                            <p className="text-gray-400">Frame Time</p>
                            <p className="font-bold text-base">{formatTime(gameState.timers.frameTime)}</p>
                        </div>
                        <div className="text-center">
                            <div className="bg-black text-yellow-300 font-extrabold text-xl rounded px-4 py-1.5 inline-flex items-center gap-4">
                                <span>{gameState.players[0].framesWon}</span>
                                <span>({gameState.settings.framesRequired})</span>
                                <span>{gameState.players[1].framesWon}</span>
                            </div>
                        </div>
                        <div className="text-center w-1/3">
                            <p className="text-gray-400">Match Time</p>
                            <p className="font-bold text-base">{formatTime(gameState.timers.matchTime)}</p>
                        </div>
                    </div>
                    {lastShot && (
                        <p className="text-sm font-semibold text-gray-300 mt-2 text-center">
                            Last: {`${gameState.players[lastShot.player].memberId}: ${lastShot.type} ${lastShot.ball ? `(Ball ${lastShot.ball})` : ''} - ${lastShot.points} pts`}
                        </p>
                    )}
                </div>

                

                {/* 撌脣? Frame Time ??Match Time 雿萄銝蝯梯?蝢斤? */}

                {/* Live Stats (carousel) */}
                <div className="w-full max-w-[1920px] mx-auto mb-2 bg-gray-800/60 rounded-lg p-3">
                    <h2 className="text-xl font-bold tracking-wider mb-3 text-center">Live Stats — {gameState.settings.matchName}</h2>
                    <div className="flex items-baseline justify-between mb-5">
                        <div className="flex-1 text-right text-lg font-bold tracking-wide">
                            {gameState.players[0].name}
                            {(() => {
                                const mid = (gameState.players[0].memberId || '').trim();
                                return mid ? <span className="ml-2 text-base text-gray-300 font-semibold">({mid})</span> : null;
                            })()}
                        </div>
                        <div className="mx-8 text-lg text-gray-300 tracking-wide">vs</div>
                        <div className="flex-1 text-left text-lg font-bold tracking-wide">
                            {gameState.players[1].name}
                            {(() => {
                                const mid = (gameState.players[1].memberId || '').trim();
                                return mid ? <span className="ml-2 text-base text-gray-300 font-semibold">({mid})</span> : null;
                            })()}
                        </div>
                    </div>

                    {(() => {
                        const s0 = stats.perPlayer[0];
                        const s1 = stats.perPlayer[1];
                        const rows: { label: string; left: string | number; right: string | number }[] = [
                            { label: '單杆最高', left: s0.maxBreakPoints, right: s1.maxBreakPoints },
                            { label: '總罰分', left: s0.foulPointsGiven, right: s1.foulPointsGiven },
                            { label: '平均出杆時間', left: `${(s0.avgShotTimeMs / 1000).toFixed(2)}s`, right: `${(s1.avgShotTimeMs / 1000).toFixed(2)}s` },
                            { label: '連杆平均出杆時間', left: `${(s0.avgRoundShotTimeMs / 1000).toFixed(2)}s`, right: `${(s1.avgRoundShotTimeMs / 1000).toFixed(2)}s` },
                            { label: '進球成功率', left: `${(s0.potSuccessRate * 100).toFixed(1)}% (${s0.potCount}/${s0.potCount + s0.missCount})`, right: `${(s1.potSuccessRate * 100).toFixed(1)}% (${s1.potCount}/${s1.potCount + s1.missCount})` },
                            { label: 'Safe成功率', left: `${(s0.safeSuccessRate * 100).toFixed(1)}% (${s0.safeNumerator}/${s0.safeDenominator})`, right: `${(s1.safeSuccessRate * 100).toFixed(1)}% (${s1.safeNumerator}/${s1.safeDenominator})` },
                            { label: '彩球成功率', left: `${(s0.colorSuccessRate * 100).toFixed(1)}% (${s0.colorNumerator}/${s0.colorNumerator + s0.colorDenominator})`, right: `${(s1.colorSuccessRate * 100).toFixed(1)}% (${s1.colorNumerator}/${s1.colorNumerator + s1.colorDenominator})` },
                            { label: '紅球成功率', left: `${(s0.redSuccessRate * 100).toFixed(1)}% (${s0.redNumerator}/${s0.redNumerator + s0.redDenominator})`, right: `${(s1.redSuccessRate * 100).toFixed(1)}% (${s1.redNumerator}/${s1.redNumerator + s1.redDenominator})` },
                            { label: '上手成功率', left: `${(s0.entrySuccessRate * 100).toFixed(1)}% (${s0.entryNumerator}/${s0.entryDenominator})`, right: `${(s1.entrySuccessRate * 100).toFixed(1)}% (${s1.entryNumerator}/${s1.entryDenominator})` },
                        ];
                        return (
                            <>
                                <div className="space-y-2">
                                    {rows.map((row) => (
                                        <div key={row.label} className="flex items-center justify-between">
                                            <div className="flex-1 text-right text-2xl font-semibold tracking-wider">{row.left}</div>
                                            <div className="mx-10 text-xl font-bold tracking-wider">{row.label}</div>
                                            <div className="flex-1 text-left text-2xl font-semibold tracking-wider">{row.right}</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        );
                    })()}
                </div>
                </div>
            </div>
            </div>
            {displayCode && (
                <div
                    className="fixed left-3 bottom-3 z-50 pointer-events-none"
                    style={{ opacity: 0.65 }}
                >
                    <span
                        className="text-white font-bold tracking-widest"
                        style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}
                    >
                        {displayCode}
                    </span>
                </div>
            )}
            {/* End-of-match summary modal removed to avoid TS build errors and per request */}
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

