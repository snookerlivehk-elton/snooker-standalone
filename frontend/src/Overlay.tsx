import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { SOCKET_URL, ENABLE_SOCKET, SOCKET_PATH, SIMPLE_MODE, DEFAULT_ROOM_ID, ENABLE_SUPABASE } from './config';
import { RoomStorage } from './lib/RoomStorage';
import { State } from './lib/State';
import { getRoomChannel } from './lib/supabase';
// StatsEngine not required for overlay rendering; remove unused import

const Overlay: React.FC = () => {
  const { roomId: routeRoomId } = useParams<{ roomId: string }>();
  const roomId = SIMPLE_MODE ? DEFAULT_ROOM_ID : routeRoomId;
  const [gameState, setGameState] = useState<State | null>(null);
  const [scale] = useState(1);

  useEffect(() => {
    // Make the whole page transparent for OBS Browser Source
    const prevBodyBg = document.body.style.background;
    const prevHtmlBg = (document.documentElement as HTMLElement).style.background;
    const prevOverflow = document.body.style.overflow;
    document.body.style.background = 'transparent';
    (document.documentElement as HTMLElement).style.background = 'transparent';
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.background = prevBodyBg;
      (document.documentElement as HTMLElement).style.background = prevHtmlBg;
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    // Hybrid: 即使在 socket 模式，也先嘗試從 RoomStorage 初始化一次（同瀏覽器場景更快顯示）
    const updateFromStorage = () => {
      if (!roomId) return;
      const raw = RoomStorage.getState(roomId!);
      if (raw) {
        try {
          const deserialized = State.fromJSON(raw);
          setGameState(deserialized);
        } catch {}
      }
    };

    if (!ENABLE_SOCKET && !ENABLE_SUPABASE) {
      // No-backend mode: poll RoomStorage for serialized State
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

    // 初始化一次快照
    updateFromStorage();

    // 優先使用 Supabase Realtime（簡化版或無後端）；否則使用 Socket
    let s: any = null;
    let ch: any = null;
    if (ENABLE_SUPABASE && roomId) {
      ch = getRoomChannel(roomId);
      if (ch) {
        ch.subscribe();
        ch.on('broadcast', { event: 'state' }, (payload: any) => {
          try {
            const deserialized = State.fromJSON(payload?.payload ?? payload);
            setGameState(deserialized);
          } catch (e) {
            console.warn('Failed to parse Supabase broadcast payload:', e);
          }
        });
      }
    } else {
      s = io(SOCKET_URL, { transports: ['websocket', 'polling'], path: SOCKET_PATH });
      if (roomId) s.emit('join room', roomId);
      s.on('gameState updated', (newGameState: any) => {
        try {
          const deserialized = State.fromJSON(newGameState);
          setGameState(deserialized);
        } catch (e) {
          console.warn('Failed to parse gameState for overlay:', e);
        }
      });
    }

    // 同步輪詢與 storage 事件，避免漏接
    const id = setInterval(updateFromStorage, 500);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || !roomId) return;
      if (e.key.includes(`snooker_room_${roomId}`)) updateFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      try { s && s.disconnect(); } catch {}
      try { ch && ch.unsubscribe(); } catch {}
      clearInterval(id);
      window.removeEventListener('storage', onStorage);
    };
  }, [roomId]);

  if (!gameState) {
    // 顯示置中提示，方便現場對齊與確認連線狀態
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'transparent',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif',
        }}
      >
        <div
          style={{
            background: 'rgba(0,0,0,0.6)',
            color: '#b7ffc4',
            padding: '10px 16px',
            borderRadius: 10,
            border: '2px solid #2ea44f',
            fontSize: 18,
          }}
        >
          等待房間資料…（請在計分板操作一次）
        </div>
      </div>
    );
  }

  const lead = Math.abs(gameState.players[0].score - gameState.players[1].score);
  const leader = gameState.players[0].score >= gameState.players[1].score ? gameState.players[0] : gameState.players[1];
  const remainingPoints = gameState.getRemainingPoints();
  const breakScore = gameState.breakScore;

  const nameWithBreak = (index: number) => {
    const name = gameState.players[index].name;
    const isOnTable = gameState.currentPlayerIndex === index;
    const breakDisplay = isOnTable && breakScore > 0 ? ` [${breakScore}]` : '';
    return `${name}${breakDisplay}`;
  };

  const matchNameBox: React.CSSProperties = {
    background: '#f5d000',
    border: '4px solid #f5d000',
    color: '#000',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    padding: '0 24px',
    borderRadius: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 0, // remove bottom rounding per request
    borderBottomRightRadius: 0, // remove bottom rounding per request
    fontSize: 22,
    lineHeight: 22,
    fontWeight: 700,
    letterSpacing: 0.5,
    textAlign: 'center',
    zIndex: 1,
    borderBottomWidth: 0, // flush with black group top edge
  };

  const scoreBoxYellow: React.CSSProperties = {
    background: '#ffd700',
    color: '#000',
    borderRadius: 8,
    padding: '3px 16px', // 20% reduction from 4px -> ~3px
    fontWeight: 900,
    fontSize: 27, // 20% reduction from 34 -> ~27
  };

  const framesBox: React.CSSProperties = {
    background: '#000',
    color: '#ffffff',
    borderRadius: 8,
    padding: '2px 10px', // 20% reduction from 3px -> ~2px
    fontWeight: 700,
    fontSize: 19, // 20% reduction from 24 -> ~19
    opacity: 0.95,
  };

  // Unified black bar (merge left panel + center band + right panel)
  const unifiedBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 13, // 20% reduction from 16 -> ~13
    background: '#000000',
    border: '4px solid #f5d000',
    borderRadius: 16,
    padding: '5px 10px', // horizontal padding also -20% (12 -> ~10)
    color: '#fff',
    width: '68vw', // 80% of previous 85vw
    maxWidth: 1360, // 80% of previous 1700
    justifyContent: 'space-between',
    marginTop: 0, // keep flush with top capsule
  };

  const indicatorStyle: React.CSSProperties = {
    fontSize: 18, // 20% reduction from 22 -> ~18
    fontWeight: 900,
    color: '#ffd700',
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'transparent',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'fixed',
          width: 1920,
          height: 1080,
          left: '50%',
          bottom: 20,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'bottom center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif',
        }}
      >
        {/* Match name (green) above unified black bar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {/* Match name capsule above, tightly attached */}
          <div style={{ marginBottom: -4, zIndex: 2 }}>
            <div style={matchNameBox}>{gameState.settings.matchName}</div>
          </div>

          {/* Unified black bar */}
          <div style={unifiedBarStyle}>
            {/* Left name */}
            <span style={{ fontSize: 22, fontWeight: 700 }}>{nameWithBreak(0)}</span>

            {/* Center scores */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flex: 1 }}>
              <span style={{ ...indicatorStyle, opacity: gameState.currentPlayerIndex === 0 ? 1 : 0 }}>◀</span>
              <div style={scoreBoxYellow}>{gameState.players[0].score}</div>
              <div style={framesBox}>{gameState.players[0].framesWon} ({gameState.settings.framesRequired}) {gameState.players[1].framesWon}</div>
              <div style={scoreBoxYellow}>{gameState.players[1].score}</div>
              <span style={{ ...indicatorStyle, opacity: gameState.currentPlayerIndex === 1 ? 1 : 0 }}>▶</span>
            </div>

            {/* Right name */}
            <span style={{ fontSize: 22, fontWeight: 700 }}>{nameWithBreak(1)}</span>
          </div>

          {/* Info strip below score bar (green capsule) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 4,
          }}>
            <div style={{ background: '#4caf50', color: '#102a12', borderRadius: 12, padding: '4px 8px', fontWeight: 700, fontSize: 18 }}>
              Lead: {lead}
            </div>
            <div style={{ background: '#4caf50', color: '#102a12', borderRadius: 12, padding: '4px 8px', fontWeight: 700, fontSize: 18 }}>
              Remaining: {remainingPoints}
            </div>
            <div style={{ background: '#4caf50', color: '#102a12', borderRadius: 12, padding: '4px 8px', fontWeight: 700, fontSize: 18 }}>
              Leader: {leader.name}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overlay;