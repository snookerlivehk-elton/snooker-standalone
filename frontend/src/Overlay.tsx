import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { SOCKET_URL, ENABLE_SOCKET, SOCKET_PATH, SIMPLE_MODE, DEFAULT_ROOM_ID, ENABLE_SUPABASE, API_URL } from './config';
import { RoomStorage } from './lib/RoomStorage';
import { State } from './lib/State';
import { getRoomChannel } from './lib/supabase';
import { findRoomIdByCode } from './lib/roomCode';
// StatsEngine not required for overlay rendering; remove unused import

const Overlay: React.FC = () => {
  const { roomId: routeRoomId } = useParams<{ roomId: string }>();
  const slugId = SIMPLE_MODE ? DEFAULT_ROOM_ID : routeRoomId;
  const paramsRaw = typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '') : null;
  const overrideSocketRoom = paramsRaw?.get('socketRoom') || undefined;
  const roomId = slugId ? (findRoomIdByCode(slugId) || slugId) : slugId; // 用於本機 RoomStorage
  const socketRoom = (overrideSocketRoom && overrideSocketRoom.trim()) || slugId || roomId; // 用於 socket 加入房間鍵
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
    // 允許以查詢參數強制指定 socket 傳輸方式（OBS 兼容：polling）
    const transportParam = paramsRaw?.get('socketTransport') || undefined;
    const transports = transportParam === 'polling' ? ['polling'] : ['websocket', 'polling'];
    const enablePollFallback = (paramsRaw?.get('enablePoll') === 'true' || paramsRaw?.get('enablePoll') === '1');

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
      s = io(SOCKET_URL, {
        transports,
        path: SOCKET_PATH,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 8000,
        timeout: 10000,
      });
      s.on('connect', () => {
        if (socketRoom) s.emit('join room', socketRoom);
      });
      s.on('reconnect', () => {
        if (socketRoom) s.emit('join room', socketRoom);
      });
      s.on('connect_error', () => {
        // 讓 OBS 長時間靜止後也可自行恢復：不報錯、不中斷、依賴 socket.io 自動重連
      });
      s.on('disconnect', () => {
        // 等待自動重連；重連成功會在上方 on('reconnect') 重新加入房間
      });
      s.on('gameState updated', (newGameState: any) => {
        try {
          const deserialized = State.fromJSON(newGameState);
          setGameState(deserialized);
        } catch (e) {
          console.warn('Failed to parse gameState for overlay:', e);
        }
      });
      let pollId: any = null;
      const startPoll = () => {
        if (!enablePollFallback) return;
        if (!socketRoom) return;
        const url = `${API_URL.replace(/\/$/,'')}/rooms/${encodeURIComponent(String(socketRoom))}/state`;
        pollId = setInterval(async () => {
          try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.status === 404) { clearInterval(pollId); pollId = null; return; }
            if (res.ok) {
              const data = await res.json();
              if (data && data.state) {
                try {
                  const deserialized = State.fromJSON(data.state);
                  setGameState(deserialized);
                } catch {}
              }
            }
          } catch {}
        }, 1000);
      };
      startPoll();
      return () => { try { clearInterval(pollId); } catch {} try { s && s.disconnect(); } catch {} try { ch && ch.unsubscribe(); } catch {} };
    }

    // 在無後端模式下才啟用本地輪詢與 storage 事件；避免與 socket/supabase 更新互相覆蓋造成跳動
    if (!ENABLE_SOCKET && !ENABLE_SUPABASE) {
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
    }
    return () => {
      try { s && s.disconnect(); } catch {}
      try { ch && ch.unsubscribe(); } catch {}
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
        {slugId && (
          <div
            style={{
              position: 'fixed',
              left: 24,
              bottom: 24,
              color: '#ffffff',
              opacity: 0.65,
              fontSize: 'clamp(18px, 2.2vw, 28px)',
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            {slugId}
          </div>
        )}
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

  const renderNameWithHandicap = (index: number) => {
    const name = gameState.players[index].name;
    const rawAny: any = Array.isArray(gameState.settings.handicaps) ? (gameState.settings.handicaps as any)[index] : undefined;
    const isBlank = rawAny === null || rawAny === undefined || (typeof rawAny === 'string' && rawAny.trim() === '');
    const showH = !isBlank;
    const n = typeof rawAny === 'number' ? rawAny : Number(rawAny);
    const signed = isNaN(n) ? String(rawAny) : (n > 0 ? `+${n}` : `${n}`);
    return (
      <span style={getNameStyle(index)}>
        {name}
        {showH && (
          <span style={{ marginLeft: 6, fontSize: 'clamp(14px, 1.6vw, 22px)', fontWeight: 600, color: '#cfe3cf' }}>
            ({signed})
          </span>
        )}
      </span>
    );
  };

  // 樣式切換參數（預設 legacy）
  const paramsUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const styleParam = paramsUrl?.get('style') || paramsUrl?.get('styleVersion') || 'legacy';
  const isCompact = styleParam === 'compact';

  // 工具：時間格式化（Break Time 等）
  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    return `${m}:${ss}`;
  };

  const matchNameBox: React.CSSProperties = {
    background: '#ffd700',
    color: 'black',
    border: '2px solid #ffd700',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: isCompact ? 0 : 16,
    borderBottomRightRadius: isCompact ? 0 : 16,
    borderBottomWidth: isCompact ? 0 : undefined,
    padding: isCompact ? '6px 16px' : '8px 18px',
    fontWeight: 700,
    fontSize: isCompact ? 20 : 22,
    letterSpacing: 0.2,
    marginBottom: isCompact ? -2 : 4,
  };

  // 合併黑區與資訊列的統一容器
  const blackContainerStyle: React.CSSProperties = {
    background: "#111",
    color: "#f6f7f9",
    borderRadius: isCompact ? 10 : 12,
    padding: isCompact ? "3px 8px" : "6px 10px",
    boxSizing: "border-box",
    position: "relative",
    boxShadow: "0 1px 10px rgba(0,0,0,0.5)",
    display: "flex",
    flexDirection: "column",
    gap: isCompact ? 3 : 4,
    // 將上方黑色主分牌寬度與下方綠色區塊一致
    width: isCompact ? '68vw' : '85vw',
    maxWidth: isCompact ? 1400 : 1700,
  };

  // 第一行（姓名/星號/分數/局數）
  const sideBarWidth = 14;
  const headerRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: isCompact ? 8 : 10,
    position: "relative",
    zIndex: 2,
    paddingLeft: sideBarWidth,
    paddingRight: sideBarWidth,
  };
  const leftBarStyle: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    width: sideBarWidth,
    background: '#ffd700',
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    transition: 'opacity 200ms ease',
    zIndex: 1,
    opacity: 0
  };
  const rightBarStyle: React.CSSProperties = {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    width: sideBarWidth,
    background: '#ffd700',
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    transition: 'opacity 200ms ease',
    zIndex: 1,
    opacity: 0
  };
  const centerClusterStyle: React.CSSProperties = {
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: isCompact ? 10 : 14,
    minWidth: 360,
    justifyContent: 'center',
    zIndex: 3,
    whiteSpace: 'nowrap'
  };

  // 第二行資訊列（放置 Lead/Remaining/Break/Break Time/Reds Left）
  const infoRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: isCompact ? "1px 0" : "2px 0",
  };

  // 底部獨立資訊方塊（含 Lead / Remaining / Break / Break Time）
  const bottomInfoBlockStyle: React.CSSProperties = {
    marginTop: isCompact ? 6 : 8,
    background: '#2a5f2a',
    color: '#ffffff',
    padding: isCompact ? '6px 12px' : '8px 14px',
    borderRadius: 12,
    border: '3px solid #f5d000',
    fontSize: isCompact ? 19 : 21,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isCompact ? 16 : 20,
    flexWrap: 'wrap',
    overflow: 'hidden',
    width: isCompact ? '68vw' : '85vw',
    maxWidth: isCompact ? 1400 : 1700,
  };

  const bottomInfoItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    fontWeight: 700,
    flex: '1 1 24%',
    minWidth: 0,
    justifyContent: 'center',
    whiteSpace: 'nowrap'
  };

  // 純文字資訊項：不使用膠囊背景
  const infoItemTextStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 6,
    fontSize: isCompact ? 16 : 18,
    fontWeight: 600,
    color: '#e6e6e6',
  };

  const nameBox: React.CSSProperties = {
    display: 'flex', flexDirection: 'row', alignItems: 'center', gap: isCompact ? 8 : 10,
    padding: isCompact ? '4px 12px' : '4px 14px',
  };

  const getNameStyle = (idx: number): React.CSSProperties => ({
    fontSize: 'clamp(18px, 2.2vw, 28px)',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 0.2,
    lineHeight: 1.1,
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis'
  });

  const scoreBoxYellow: React.CSSProperties = {
    background: '#ffd700', color: 'black', borderRadius: 12,
    padding: isCompact ? '3px 16px' : '4px 20px',
    fontWeight: 700,
    fontSize: isCompact ? 26 : 32,
    minWidth: isCompact ? 60 : 72,
    textAlign: 'center',
  };

  const framesBox: React.CSSProperties = {
    background: '#ffd700', color: 'black', borderRadius: 12,
    padding: isCompact ? '3px 10px' : '3px 12px',
    fontWeight: 600,
    fontSize: isCompact ? 17 : 22,
    minWidth: isCompact ? 44 : 54,
    textAlign: 'center',
  };

  const indicatorStyle: React.CSSProperties = {
    fontSize: isCompact ? 16 : 20,
    fontWeight: 700,
    color: '#7fffd4',
    minWidth: 26,
    textAlign: 'center',
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
        {/* Match name (yellow) above unified black bar */}
        <div style={matchNameBox}>
          <span style={{ fontWeight: 800 }}>{gameState.settings.matchName}</span>
        </div>

        <div style={blackContainerStyle}>
          <div style={{ ...leftBarStyle, opacity: gameState.currentPlayerIndex === 0 ? 1 : 0 }} />
          <div style={{ ...rightBarStyle, opacity: gameState.currentPlayerIndex === 1 ? 1 : 0 }} />
          <div style={headerRowStyle}>
            {/* Left name */}
            <div style={{ 
              ...nameBox, 
              width: '40%', 
              flex: '0 0 40%', 
              minWidth: 0, 
              paddingLeft: sideBarWidth + 16, 
              overflow: 'hidden',
              boxSizing: 'border-box',
              position: 'relative',
              zIndex: 3
            }}>
              {renderNameWithHandicap(0)}
            </div>

            {/* Score boxes */}
            <div style={centerClusterStyle}>
              <div style={scoreBoxYellow}>{gameState.players[0].score}</div>
              <div style={framesBox}>{gameState.players[0].framesWon}</div>
              <div style={{ color: '#ddd', fontSize: isCompact ? 20 : 24, fontWeight: 600, whiteSpace: 'nowrap', minWidth: isCompact ? 40 : 56, textAlign: 'center' }}>({gameState.settings.framesRequired})</div>
              <div style={framesBox}>{gameState.players[1].framesWon}</div>
              <div style={scoreBoxYellow}>{gameState.players[1].score}</div>
            </div>

            {/* Right name */}
            <div style={{ 
              ...nameBox, 
              width: '40%', 
              flex: '0 0 40%', 
              justifyContent: 'flex-end', 
              minWidth: 0, 
              paddingRight: sideBarWidth + 16, 
              textAlign: 'right',
              overflow: 'hidden',
              boxSizing: 'border-box',
              position: 'relative',
              zIndex: 3
            }}>
              {renderNameWithHandicap(1)}
            </div>
          </div>

          {/* Info row under header inside the same black container (pure text) */}
          <div style={infoRowStyle}>
            {gameState?.isFreeBall && (
              <div style={{
                background: '#7c3aed',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: isCompact ? 16 : 18,
                alignSelf: 'center',
                border: '2px solid #e9d5ff'
              }}>
                Free Ball
              </div>
            )}
          </div>
        </div>

        {/* Bottom independent info block (moved outside black container to avoid overlap) */}
        <div style={bottomInfoBlockStyle}>
          <div style={bottomInfoItemStyle}>
            <span style={{ color: '#cfe3cf', whiteSpace: 'nowrap' }}>Lead</span>
            <span style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{leader.name} +{lead}</span>
          </div>
          <div style={bottomInfoItemStyle}>
            <span style={{ color: '#cfe3cf', whiteSpace: 'nowrap' }}>Remaining</span>
            <span style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{remainingPoints}</span>
          </div>
          <div style={bottomInfoItemStyle}>
            <span style={{ color: '#cfe3cf', whiteSpace: 'nowrap' }}>Break</span>
            <span style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{gameState.breakScore}</span>
          </div>
          <div style={bottomInfoItemStyle}>
            <span style={{ color: '#cfe3cf', whiteSpace: 'nowrap' }}>Break Time</span>
            <span style={{ color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{formatTime(gameState.breakTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Overlay;
