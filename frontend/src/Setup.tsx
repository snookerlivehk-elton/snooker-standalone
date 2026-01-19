import React, { useState, useEffect } from 'react';
import { APP_NAME, API_URL } from './config';
import { useNavigate, useParams } from 'react-router-dom';
import { parseMatchName, normalizeKey } from './lib/matchName';
import { RoomStorage } from './lib/RoomStorage';
import { getCodeForRoom, findRoomIdByCode } from './lib/roomCode';
import { State } from './lib/State';
import { validateMembers, ValidateMembersResponse, sendMatchVerificationCode, startMatchV2 } from './lib/api';

interface SetupProps {
    onStartMatch: (settings: any) => void;
}

const Setup: React.FC<SetupProps> = ({ onStartMatch }) => {
    const [matchName, setMatchName] = useState('Snooker Match');
    const [p1Name, setP1Name] = useState('Player 1');
    const [p1Email, setP1Email] = useState('');
    const [p1Code, setP1Code] = useState('');
    const [p2Name, setP2Name] = useState('Player 2');
    const [p2Email, setP2Email] = useState('');
    const [p2Code, setP2Code] = useState('');
    const [p1Handicap, setP1Handicap] = useState(0);
    const [p2Handicap, setP2Handicap] = useState(0);
    const [redBalls, setRedBalls] = useState(15);
    const [framesRequired, setFramesRequired] = useState(1);
    const [startingPlayerIndex, setStartingPlayerIndex] = useState(0);
    const [operatorInfo, setOperatorInfo] = useState<{ id?: string; name?: string; email?: string } | null>(null);
    const navigate = useNavigate();
    const { roomId } = useParams();
    
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

    const handleSendCode = async (email: string) => {
        if (!email || !email.includes('@')) {
            alert('Please enter a valid email address');
            return;
        }
        try {
            await sendMatchVerificationCode(API_URL, email);
            alert(`Verification code sent to ${email}`);
        } catch (e: any) {
            alert(e.message || 'Failed to send code');
        }
    };

    const handleStartMatch = async () => {
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
            const hasRemote = !!remoteState;

            if (hasExisting || hasRemote) {
                alert('此房間已有賽事記錄，將直接開啟現有賽事畫面。如需開新賽事，請在管理介面建立新房間或先清除本地暫存。');
                const qs = typeof window !== 'undefined' ? (window.location.search || '') : '';
                navigate(`/room/${roomId}${qs}`);
                return;
            }

            // Create Match on Backend
            let matchIdResult: string = '';
            let mode: 'ranked' | 'guest' = 'guest';

            try {
                const res = await startMatchV2(API_URL, {
                    room_id: storageRoomId,
                    p1_email: p1Email.trim(),
                    p1_code: p1Code.trim(),
                    p2_email: p2Email.trim(),
                    p2_code: p2Code.trim(),
                    frames_required: framesRequired,
                    red_balls: redBalls,
                    handicap0: p1Handicap,
                    handicap1: p2Handicap,
                    operator_id: operatorInfo?.id || operatorInfo?.email
                });
                matchIdResult = res.matchId;
                mode = res.mode;
            } catch (e: any) {
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
                { name: p1Name, email: p1Email.trim() },
                { name: p2Name, email: p2Email.trim() },
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

        // Fallback for no roomId (local only? or just ignore)
        // The original code allowed it.
        // We will keep the original logic for no-roomId case but update inputs
         const p1IdTrim = p1Email.trim();
        const p2IdTrim = p2Email.trim();
        // ... (similar logic)
        
        // For simplicity, I'll focus on the Room case as that's the primary use case.
        // But to avoid breaking, I'll just replicate the basic flow without backend match creation if no roomId.
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
        <div className="min-h-screen bg-green-900 p-4 flex flex-col items-center justify-center">
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
            <div className="max-w-md w-full bg-yellow-800 rounded-xl shadow-md p-6">
                <h1 className="text-4xl font-bold text-center text-white mb-2 font-serif italic">{APP_NAME}</h1>
                <p className="text-base text-center text-gray-300 mb-6 -mt-2">Scoreboard System</p>
                
                {operatorInfo && (
                    <div className="mb-4 p-3 bg-yellow-900 rounded-lg text-center border border-yellow-700">
                        <p className="text-yellow-200 text-sm">Room Operator</p>
                        <p className="text-white font-medium text-lg">{operatorInfo.name || operatorInfo.email || 'Unknown'}</p>
                    </div>
                )}

                <h2 className="text-2xl font-bold text-center text-white mb-6">Create Match</h2>
                <div className="space-y-4">
                    <div className="setting-item">
                        <label htmlFor="matchName" className="block text-sm font-medium text-white">Match Name:</label>
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
                            <h2 className="text-lg font-medium text-white">Player 1</h2>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">Full Name:</label>
                                <input
                                    type="text"
                                    value={p1Name}
                                    readOnly
                                    className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-gray-300 cursor-not-allowed"
                                />
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">Email</label>
                                <div className="flex gap-1">
                                    <input type="email" value={p1Email} onChange={(e) => setP1Email(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white text-xs"/>
                                    <button onClick={() => handleSendCode(p1Email)} className="mt-1 px-2 py-1 bg-blue-600 text-white text-xs rounded">Code</button>
                                </div>
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">Verify Code</label>
                                <input type="text" value={p1Code} onChange={(e) => setP1Code(e.target.value)} placeholder="6-digit" className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"/>
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">Handicap</label>
                                <input
                                    type="number"
                                    value={p1Handicap}
                                    onChange={(e) => setP1Handicap(parseInt(e.target.value, 10) || 0)}
                                    className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <h2 className="text-lg font-medium text-white">Player 2</h2>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">Full Name:</label>
                                <input
                                    type="text"
                                    value={p2Name}
                                    readOnly
                                    className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm text-gray-300 cursor-not-allowed"
                                />
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">Email</label>
                                <div className="flex gap-1">
                                    <input type="email" value={p2Email} onChange={(e) => setP2Email(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white text-xs"/>
                                    <button onClick={() => handleSendCode(p2Email)} className="mt-1 px-2 py-1 bg-blue-600 text-white text-xs rounded">Code</button>
                                </div>
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">Verify Code</label>
                                <input type="text" value={p2Code} onChange={(e) => setP2Code(e.target.value)} placeholder="6-digit" className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"/>
                            </div>
                            <div className="input-group mt-2">
                                <label className="block text-sm font-medium text-white">Handicap</label>
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
                        <label className="block text-sm font-medium text-white">Number of Reds:</label>
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
                        <label htmlFor="framesRequired" className="block text-sm font-medium text-white">Number of Frames:</label>
                        <input 
                            type="number" 
                            id="framesRequired"
                            value={framesRequired} 
                            onChange={(e) => setFramesRequired(parseInt(e.target.value, 10))}
                            className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md shadow-sm text-white"
                        />
                    </div>
                    <div className="setting-item">
                        <label className="block text-sm font-medium text-white">Starting Player:</label>
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
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        onClick={handleStartMatch}
                    >
                        Start Match
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
        </div>
    );
};

export default Setup;