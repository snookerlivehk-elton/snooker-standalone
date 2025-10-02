import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from './config';
import { State } from './lib/State';
// StatsEngine not required for overlay rendering; remove unused import

const Overlay: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [socket, setSocket] = useState<Socket | null>(null);
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
    const s = io(SOCKET_URL);
    setSocket(s);
    if (roomId) s.emit('join room', roomId);
    s.on('gameState updated', (newGameState) => {
      try {
        const deserialized = State.fromJSON(newGameState);
        setGameState(deserialized);
      } catch (e) {
        console.warn('Failed to parse gameState for overlay:', e);
      }
    });
    return () => s.disconnect();
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

  const panelStyle: React.CSSProperties = {
    background: 'rgba(0,0,0,0.9)',
    border: '4px solid #f5d000',
    color: '#fff',
    padding: '8px 16px',
    borderRadius: 12,
    minWidth: 320,
    textAlign: 'center',
  };

  const centerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#2a5f2a',
    border: '4px solid #f5d000',
    borderRadius: 12,
    padding: '8px 12px',
    color: '#fff',
  };

  const scoreBox: React.CSSProperties = {
    background: '#000',
    color: '#ffd700',
    borderRadius: 8,
    padding: '4px 12px',
    fontWeight: 800,
    fontSize: 28,
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
      {/* Center overlay bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Left player panel */}
        <div style={panelStyle}>
          <span style={{ fontSize: 28, fontWeight: 700 }}>{nameWithBreak(0)}</span>
        </div>

        {/* Center scores and match name */}
        <div style={centerStyle}>
          <span style={{ fontSize: 16, opacity: 0.9 }}>{gameState.settings.matchName}</span>
          <div style={scoreBox}>{gameState.players[0].score}</div>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#ffd700' }}>▶</span>
          <div style={scoreBox}>{gameState.players[1].score}</div>
        </div>

        {/* Right player panel */}
        <div style={panelStyle}>
          <span style={{ fontSize: 28, fontWeight: 700 }}>{nameWithBreak(1)}</span>
        </div>
      </div>

      {/* Info strip below center */}
      <div
        style={{
          marginTop: 16,
          background: 'rgba(0,0,0,0.7)',
          color: '#b7ffc4',
          padding: '6px 12px',
          borderRadius: 8,
          border: '2px solid #2ea44f',
          fontSize: 16,
        }}
      >
        <span style={{ marginRight: 12 }}>Break: {breakScore}</span>
        <span style={{ marginRight: 12 }}>{leader.name} is {lead} ahead</span>
        <span>Remaining: {remainingPoints}</span>
      </div>
    </div>
  );
};

export default Overlay;