import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { SOCKET_URL, ENABLE_SOCKET, SOCKET_PATH } from './config';
import { RoomStorage } from './lib/RoomStorage';
import { State } from './lib/State';
// StatsEngine not required for overlay rendering; remove unused import

const Overlay: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [gameState, setGameState] = useState<State | null>(null);

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
    if (!ENABLE_SOCKET) {
      // No-backend mode: poll RoomStorage for serialized State
      const updateFromStorage = () => {
        if (!roomId) return;
        const raw = RoomStorage.getState(roomId!);
        if (raw) {
          try {
            const deserialized = State.fromJSON(raw);
            setGameState(deserialized);
          } catch (e) {
            // ignore parse errors
          }
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
    const s = io(SOCKET_URL, { transports: ['websocket'], path: SOCKET_PATH });
    if (roomId) s.emit('join room', roomId);
    s.on('gameState updated', (newGameState) => {
      try {
        const deserialized = State.fromJSON(newGameState);
        setGameState(deserialized);
      } catch (e) {
        console.warn('Failed to parse gameState for overlay:', e);
      }
    });
    return () => {
      s.disconnect();
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

  const nameWithBreak = (pi: number) => {
    const name = gameState.players[pi].name;
    return gameState.currentPlayerIndex === pi && breakScore > 0 ? `${name} (${breakScore})` : name;
  };

  // Removed unused panelStyle to satisfy TypeScript noUnusedLocals

  const matchNameBox: React.CSSProperties = {
    background: '#2a5f2a',
    border: '4px solid #f5d000',
    color: '#fff',
    // 寬度增加一倍、高度增加 50%（以 padding 調整）
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 28px',
    borderRadius: 16,
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 0.5,
    textAlign: 'center',
    zIndex: 1,
  };

  // Removed unused centerBandStyle to satisfy TypeScript noUnusedLocals

  const scoreBoxYellow: React.CSSProperties = {
    background: '#ffd700',
    color: '#000',
    borderRadius: 8,
    padding: '6px 16px',
    fontWeight: 900,
    fontSize: 34,
  };

  const framesBox: React.CSSProperties = {
    background: '#000',
    color: '#ffffff',
    borderRadius: 8,
    padding: '4px 10px',
    fontWeight: 700,
    fontSize: 24,
    opacity: 0.95,
  };

  // Unified black bar (merge left panel + center band + right panel)
  const unifiedBarStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    background: '#000000',
    border: '4px solid #f5d000',
    borderRadius: 16,
    padding: '8px 12px',
    color: '#fff',
    // 拓寬整個計分條（高度與字體不變），貼近電視轉播樣式
    width: '85vw',
    maxWidth: 1700,
    justifyContent: 'space-between',
    // 讓上方綠色膠囊與黑色組別邊框重疊
    marginTop: -4,
  };

  // Yellow triangle indicator style (current player at table)
  const indicatorStyle: React.CSSProperties = {
    fontSize: 22,
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
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        fontFamily:
          'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif',
      }}
    >
      {/* Match name (green) + unified black bar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={matchNameBox}>{gameState.settings.matchName}</div>
        <div style={unifiedBarStyle}>
          {/* Left name */}
          <span style={{ fontSize: 28, fontWeight: 700 }}>{nameWithBreak(0)}</span>
          {/* Center scores */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flex: 1 }}>
            <span style={{ ...indicatorStyle, opacity: gameState.currentPlayerIndex === 0 ? 1 : 0 }}>◀</span>
            <div style={scoreBoxYellow}>{gameState.players[0].score}</div>
            <div style={framesBox}>{gameState.players[0].framesWon} ({gameState.settings.framesRequired}) {gameState.players[1].framesWon}</div>
            <div style={scoreBoxYellow}>{gameState.players[1].score}</div>
            <span style={{ ...indicatorStyle, opacity: gameState.currentPlayerIndex === 1 ? 1 : 0 }}>▶</span>
          </div>
          {/* Right name */}
          <span style={{ fontSize: 28, fontWeight: 700 }}>{nameWithBreak(1)}</span>
        </div>
      </div>

      {/* Info strip below center (green capsule) */}
      <div
        style={{
          // 讓綠色膠囊與上方黑色組別的黃色描邊重疊
          marginTop: -4,
          background: '#2a5f2a',
          color: '#ffffff',
          padding: '6px 12px',
          borderRadius: 12,
          border: '4px solid #f5d000',
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
          zIndex: 1,
        }}
      >
        <span>Break: {breakScore}</span>
        <span>{leader.name} is {lead} ahead</span>
        <span>Remaining: {remainingPoints}</span>
      </div>
    </div>
  );
};

export default Overlay;