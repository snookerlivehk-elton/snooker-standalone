import React, { useState, useEffect } from 'react';
import { APP_NAME, API_URL } from './config';
import { useNavigate, useParams } from 'react-router-dom';
import { parseMatchName, normalizeKey } from './lib/matchName';
import { RoomStorage } from './lib/RoomStorage';
import { getCodeForRoom, findRoomIdByCode } from './lib/roomCode';
import { State } from './lib/State';
import { validateMembers, startMatchV2 as startMatch, sendMatchInvites, getRoomInvites } from './lib/api';
import { t } from './lib/i18n';

interface SetupProps {
    onStartMatch: (settings: any) => void;
}

const Setup: React.FC<SetupProps> = ({ onStartMatch }) => {
    const [matchName, setMatchName] = useState('Snooker Match');
    const [p1Name, setP1Name] = useState('Player 1');
    const [p1Email, setP1Email] = useState('');
    const [p2Name, setP2Name] = useState('Player 2');
    const [p2Email, setP2Email] = useState('');
    const [p1Handicap, setP1Handicap] = useState(0);
    const [p2Handicap, setP2Handicap] = useState(0);
    const [redBalls, setRedBalls] = useState(15);
    const [framesRequired, setFramesRequired] = useState(1);
    const [startingPlayerIndex, setStartingPlayerIndex] = useState(0);
    const [operatorInfo, setOperatorInfo] = useState<{ id?: string; name?: string; email?: string } | null>(null);
    const [showExistingMatchModal, setShowExistingMatchModal] = useState(false);
    const navigate = useNavigate();
    const { roomId } = useParams();

    const handleResume = async () => {
        if (roomId) {
             const storageRoomId = findRoomIdByCode(roomId) || roomId;
             try {
                const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/state`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.state) {
                        RoomStorage.setState(storageRoomId, data.state);
                    }
                }
             } catch {}
        }
        const qs = typeof window !== 'undefined' ? (window.location.search || '') : '';
        navigate(`/room/${roomId}${qs}`);
    };

    const handleOverwriteAndStart = async () => {
        if (!roomId) return;
        const storageRoomId = findRoomIdByCode(roomId) || roomId;
        RoomStorage.clearRoom(storageRoomId);
        try {
            await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/reset`, { method: 'POST' });
        } catch (e) { console.error(e); }
        
        setShowExistingMatchModal(false);
        setTimeout(() => handleStartMatch(), 200);
    };
    
    const matchId = (() => {
        const slug = roomId || '';
        if (!slug) return '';
        const pattern = /^[A-Z]{5}\d{4}$/;
        if (pattern.test(slug)) return slug;
        const fromMap = getCodeForRoom(slug);
        return fromMap || slug;
    })();

    // Fetch room/operator info
    useEffect(() => {
        if (!roomId) return;
        (async () => {
            try {
                const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/state`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.operator) {
                        setOperatorInfo(data.operator);
                    }
                }
            } catch (e) {
                console.error(e);
            }
        })();
    }, [roomId]);

    // Poll accepted invites to auto-fill players
    useEffect(() => {
        if (!roomId) return;
        let cancelled = false;
        const tick = async () => {
            try {
                const data = await getRoomInvites(API_URL, roomId);
                if (cancelled) return;
                const accepted = (data.invites || []).filter((x: any) => String(x.status) === 'ACCEPTED');
                for (const inv of accepted) {
                    const mem = inv.member;
                    if (!mem || !mem.email) continue;
                    if (!p1Email.trim()) {
                        setP1Email(mem.email);
                        if (mem.name) setP1Name(mem.name);
                    } else if (!p2Email.trim() && mem.email !== p1Email.trim()) {
                        setP2Email(mem.email);
                        if (mem.name) setP2Name(mem.name);
                    }
                }
            } catch {}
        };
        const id = setInterval(tick, 1500);
        tick();
        return () => { cancelled = true; clearInterval(id); };
    }, [roomId, p1Email, p2Email]);

    // Name resolution effect
    useEffect(() => {
        const p1IdTrim = p1Email.trim();
        const p2IdTrim = p2Email.trim();
        const idsToCheck = [p1IdTrim, p2IdTrim].filter(Boolean) as string[];
        
        if (idsToCheck.length === 0) {
            setP1Name('Player 1');
            setP2Name('Player 2');
            return;
        }
        
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const validation = await validateMembers(API_URL, idsToCheck);
                if (cancelled) return;
                
                const existsMap = validation?.exists || {};
                const namesMap = validation?.names || {};
                
                if (p1IdTrim) {
                    const p1Valid = !!existsMap[p1IdTrim];
                    const displayName = p1Valid ? (namesMap[p1IdTrim] || 'Player 1') : 'GUEST_1';
                    setP1Name(displayName);
                } else {
                    setP1Name('Player 1');
                }
                
                if (p2IdTrim) {
                    const p2Valid = !!existsMap[p2IdTrim];
                    const displayName = p2Valid ? (namesMap[p2IdTrim] || 'Player 2') : 'GUEST_2';
                    setP2Name(displayName);
                } else {
                    setP2Name('Player 2');
                }
            } catch {
                // ignore
            }
        }, 400);
        
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [p1Email, p2Email]);

    const handleStartMatch = async () => {
        const p1EmailTrim = p1Email.trim();
        const p2EmailTrim = p2Email.trim();
        if (!p1EmailTrim && !p2EmailTrim) {
            alert('請至少輸入一位球員的 Email 後再開始比賽。');
            return;
        }
        if (roomId) {
            const storageRoomId = findRoomIdByCode(roomId) || roomId;
            const existing = RoomStorage.getRoomData(storageRoomId);
            
            // Check remote state
            let remoteState: any = null;
            try {
                const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomId)}/state`);
                if (res.ok) {
                    const data = await res.json();
                    remoteState = data?.state ?? null;
                }
            } catch {
                // ignore
            }

            if (existing.locked) {
                alert('此房間上一場比賽已結束並鎖定，無法再次從此房間開始新賽事。請在 Admin 介面建立新房間，或先清除本地暫存後改用新房間。');
                return;
            }

            const hasExisting =
                (existing.events && existing.events.length > 0) ||
                !!existing.state ||
                (Array.isArray(existing.foulTotals) &&
                    (existing.foulTotals[0] > 0 || existing.foulTotals[1] > 0));
            const hasRemote = !!remoteState && Object.keys(remoteState).length > 0;

            if (hasExisting || hasRemote) {
                setShowExistingMatchModal(true);
                return;
            }

            // Create Match on Backend
            let matchIdResult: string | null = null;
            let mode = 'guest';
            let p1MemberId: string | null = null;
            let p2MemberId: string | null = null;

            try {
                const res = await startMatch(API_URL, {
                    room_id: roomId || '',
                    p1_email: p1Email.trim(),
                    p2_email: p2Email.trim(),
                    frames_required: framesRequired,
                    red_balls: redBalls,
                    handicap0: p1Handicap,
                    handicap1: p2Handicap,
                    operator_id: operatorInfo?.id || undefined
                });
                matchIdResult = res.matchId;
                mode = res.mode;
                p1MemberId = res.p1MemberId;
                p2MemberId = res.p2MemberId;
            } catch (e: any) {
                // If 400 error (e.g. invalid code), alert and stop
                alert(`Failed to start match: ${e.message}`);
                return;
            }

            if (mode === 'guest') {
                // alert('Starting as Guest Match (no ranking points)');
            } else {
                // alert('Starting as Ranked Match');
            }

            // Proceed with local setup
            const { namePart, codePart } = parseMatchName(matchName);
            const matchKeyNormalized = normalizeKey(namePart);
            const slug = roomId || '';
            const pattern = /^[A-Z]{5}\d{4}$/;
            const fromMap = slug ? getCodeForRoom(slug) || null : null;
            const codeValue = pattern.test(slug) ? slug : fromMap;
            const codePrefix = codeValue ? `[${codeValue}] ` : '';
            
            const settings = {
                matchName: `${codePrefix}${matchName}`,
                redBalls,
                framesRequired,
                matchNamePart: namePart,
                matchKeyNormalized,
                matchCode: codeValue ?? codePart ?? null,
                handicaps: [p1Handicap || 0, p2Handicap || 0],
                matchId: matchIdResult, // Store matchId in settings
                mode // Store mode
            };
            
            // Explicitly set matchId in RoomStorage so Scoreboard knows about it
            if (matchIdResult) {
                RoomStorage.setMatchId(storageRoomId, matchIdResult);
                // Also reset uploaded events count for new match
                RoomStorage.setUploadedEventsCount(storageRoomId, 0);
            }

            const playersInfo = [
                { name: p1Name, email: p1Email.trim(), memberId: p1MemberId || p1Email.trim() || undefined },
                { name: p2Name, email: p2Email.trim(), memberId: p2MemberId || p2Email.trim() || undefined },
            ];
            
            onStartMatch({
                playersInfo,
                settings,
                startingPlayerIndex,
            });

            try {
                const initialState = new State({
                    playersInfo,
                    settings,
                    startingPlayerIndex,
                });
                RoomStorage.setState(storageRoomId, initialState.toJSON());
            } catch {
                // ignore
            }
            
            const qs = typeof window !== 'undefined' ? (window.location.search || '') : '';
            navigate(`/room/${roomId}${qs}`);
            return;
        }

        onStartMatch({
            playersInfo: [
                { name: p1Name, email: p1Email.trim() },
                { name: p2Name, email: p2Email.trim() },
            ],
            settings: {
                matchName: matchName,
                redBalls,
                framesRequired,
                handicaps: [p1Handicap || 0, p2Handicap || 0],
            },
            startingPlayerIndex,
        });
    };

    return (
        <div className="brand-page text-white p-4 flex flex-col items-center justify-center">
            {matchId && (
                <div
                    className="fixed left-3 bottom-3 z-50 pointer-events-none"
                    style={{ opacity: 0.65 }}
                >
                    <span
                        className="text-white font-bold tracking-widest"
                        style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}
                    >
                        {matchId}
                    </span>
                </div>
            )}
            <div className="max-w-md w-full glass rounded-xl p-6">
                <h1 className="text-4xl font-bold text-center accent-yellow mb-2">{APP_NAME}</h1>
                <p className="text-base text-center text-gray-300/80 mb-6 -mt-2">{t('setup.tagline')}</p>
                
                {operatorInfo && (
                    <div className="mb-4 p-3 bg-black/40 border border-white/10 rounded-lg text-center">
                        <p className="text-gray-300/80 text-sm">{t('setup.roomOperator')}</p>
                        <p className="text-white font-medium text-lg">{operatorInfo.name || operatorInfo.email || '未知'}</p>
                    </div>
                )}

                <h2 className="text-2xl font-bold text-center text-white mb-6">{t('setup.create')}</h2>
                <div className="space-y-4">
                    <div className="setting-item">
                        <label htmlFor="matchName" className="block text-sm font-medium text-white">{t('setup.matchName')}</label>
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
                            <h2 className="text-lg font-medium text-white">球員 1</h2>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">{t('setup.fullName')}</label>
                                <input
                                    type="text"
                                    value={p1Name}
                                    readOnly
                                    className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-gray-300 cursor-not-allowed"
                                />
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">{t('setup.email')}</label>
                                <div className="flex gap-1">
                                    <input type="email" value={p1Email} onChange={(e) => setP1Email(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white text-xs"/>
                                    <button
                                      onClick={async () => {
                                        if (!roomId || !p1Email.trim()) { alert('請先輸入 Email'); return; }
                                        try {
                                          const r = await sendMatchInvites(API_URL, roomId, operatorInfo?.id, [p1Email.trim()]);
                                          const notFound = (r as any)?.notFound || [];
                                          if (notFound.length) {
                                            alert(`此 Email 尚未註冊會員：${notFound.join(', ')}`);
                                          } else {
                                            alert('已發送比賽通知');
                                          }
                                        } catch (e: any) {
                                          alert(e.message || '發送失敗');
                                        }
                                      }}
                                      className="mt-1 px-2 py-1 bg-green-600 text-white text-xs rounded"
                                    >
                                      發送比賽通知
                                    </button>
                                </div>
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">{t('setup.handicap')}</label>
                                <input
                                    type="number"
                                    value={p1Handicap}
                                    onChange={(e) => setP1Handicap(parseInt(e.target.value, 10) || 0)}
                                    className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-lg font-medium text-white">球員 2</h2>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">{t('setup.fullName')}</label>
                                <input
                                    type="text"
                                    value={p2Name}
                                    readOnly
                                    className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-gray-300 cursor-not-allowed"
                                />
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">{t('setup.email')}</label>
                                <div className="flex gap-1">
                                    <input type="email" value={p2Email} onChange={(e) => setP2Email(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white text-xs"/>
                                    <button
                                      onClick={async () => {
                                        if (!roomId || !p2Email.trim()) { alert('請先輸入 Email'); return; }
                                        try {
                                          const r = await sendMatchInvites(API_URL, roomId, operatorInfo?.id, [p2Email.trim()]);
                                          const notFound = (r as any)?.notFound || [];
                                          if (notFound.length) {
                                            alert(`此 Email 尚未註冊會員：${notFound.join(', ')}`);
                                          } else {
                                            alert('已發送比賽通知');
                                          }
                                        } catch (e: any) {
                                          alert(e.message || '發送失敗');
                                        }
                                      }}
                                      className="mt-1 px-2 py-1 bg-green-600 text-white text-xs rounded"
                                    >
                                      發送比賽通知
                                    </button>
                                </div>
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">{t('setup.handicap')}</label>
                                <input
                                    type="number"
                                    value={p2Handicap}
                                    onChange={(e) => setP2Handicap(parseInt(e.target.value, 10) || 0)}
                                    className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="setting-item">
                        <label className="block text-sm font-medium text-white">{t('setup.reds')}</label>
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
                        <label htmlFor="framesRequired" className="block text-sm font-medium text-white">{t('setup.frames')}</label>
                        <input 
                            type="number" 
                            id="framesRequired"
                            value={framesRequired} 
                            onChange={(e) => setFramesRequired(parseInt(e.target.value, 10))}
                            className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"
                        />
                    </div>
                    <div className="setting-item">
                        <label className="block text-sm font-medium text-white">{t('setup.starting')}</label>
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
                        className="w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium brand-button text-black"
                        onClick={handleStartMatch}
                    >
                        {t('setup.startMatch')}
                    </button>
                </div>
            </div>
            {roomId && (
                <div
                    className="fixed left-3 bottom-3 z-50 pointer-events-none"
                    style={{ opacity: 0.65 }}
                >
                    <span
                        className="text-white font-bold tracking-widest"
                        style={{ fontSize: 'clamp(18px, 2.2vw, 28px)' }}
                    >
                        {getCodeForRoom(roomId) || roomId}
                    </span>
                </div>
            )}

            {showExistingMatchModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-xl text-center max-w-md w-full border border-gray-700">
                        <h2 className="text-2xl font-bold mb-4 text-white">發現現有賽事</h2>
                        <p className="mb-6 text-gray-300">此房間已有正在進行或未清除的賽事記錄。</p>
                        <div className="flex flex-col space-y-3">
                            <button 
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition duration-200"
                                onClick={handleResume}
                            >
                                繼續現有賽事 (Resume)
                            </button>
                            <button 
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition duration-200"
                                onClick={handleOverwriteAndStart}
                            >
                                開始新賽事並覆蓋 (Overwrite)
                            </button>
                            <button 
                                className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition duration-200 mt-2"
                                onClick={() => setShowExistingMatchModal(false)}
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Setup;
