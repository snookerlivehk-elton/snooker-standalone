export type RoomEventType =
  | 'pot'
  | 'foul'
  | 'miss'
  | 'safe'
  | 'switch'
  | 'newFrame'
  | 'concede'
  | 'freeBallToggle';

export interface RoomEvent {
  type: RoomEventType;
  playerIndex: number; // 0 or 1
  playerMemberId: string;
  ballName?: 'red' | 'yellow' | 'green' | 'brown' | 'blue' | 'pink' | 'black';
  points?: number; // positive for pot; foul points recorded as positive here
  timestamp?: number; // ms since epoch
  shotTimeMs?: number; // time since previous event in ms
}

export interface RoomData {
  events: RoomEvent[];
  foulTotals: [number, number];
  state?: any;
  locked?: boolean;
  lockedAt?: number | null;
  matchId?: string | null;
  uploadedEventsCount?: number;
  acceptedMemberIds?: string[] | null;
}

const STORAGE_PREFIX = 'snooker_room_';

function getKey(roomId: string) {
  return `${STORAGE_PREFIX}${roomId}`;
}

function read(roomId: string): RoomData {
  try {
    const raw = localStorage.getItem(getKey(roomId));
    if (!raw) {
      return {
        events: [],
        foulTotals: [0, 0],
        locked: false,
        lockedAt: null,
        matchId: null,
        uploadedEventsCount: 0,
        acceptedMemberIds: null,
      };
    }
    const parsed = JSON.parse(raw);
    return {
      events: Array.isArray(parsed?.events) ? parsed.events : [],
      foulTotals: Array.isArray(parsed?.foulTotals) && parsed.foulTotals.length === 2
        ? parsed.foulTotals
        : [0, 0],
      state: parsed?.state,
      locked: Boolean(parsed?.locked),
      lockedAt: typeof parsed?.lockedAt === 'number' ? parsed.lockedAt : null,
      matchId: typeof parsed?.matchId === 'string' ? parsed.matchId : null,
      uploadedEventsCount: typeof parsed?.uploadedEventsCount === 'number' ? parsed.uploadedEventsCount : 0,
      acceptedMemberIds: Array.isArray(parsed?.acceptedMemberIds) ? parsed.acceptedMemberIds : null,
    };
  } catch {
    return {
      events: [],
      foulTotals: [0, 0],
      locked: false,
      lockedAt: null,
      matchId: null,
      uploadedEventsCount: 0,
      acceptedMemberIds: null,
    };
  }
}

function write(roomId: string, data: RoomData) {
  try {
    localStorage.setItem(getKey(roomId), JSON.stringify(data));
  } catch {
    // Swallow storage errors; this is best-effort temporary storage.
  }
}

export const RoomStorage = {
  getRoomData(roomId: string): RoomData {
    return read(roomId);
  },

  getEvents(roomId: string): RoomEvent[] {
    return read(roomId).events;
  },

  getFoulTotals(roomId: string): [number, number] {
    return read(roomId).foulTotals;
  },

  getMatchId(roomId: string): string | null {
    const data = read(roomId);
    return data.matchId ?? null;
  },

  setMatchId(roomId: string, matchId: string | null) {
    const data = read(roomId);
    data.matchId = matchId ?? null;
    write(roomId, data);
  },

  getUploadedEventsCount(roomId: string): number {
    const data = read(roomId);
    return typeof data.uploadedEventsCount === 'number' ? data.uploadedEventsCount : 0;
  },

  setUploadedEventsCount(roomId: string, count: number) {
    const data = read(roomId);
    data.uploadedEventsCount = count >= 0 ? count : 0;
    write(roomId, data);
  },

  getAcceptedMemberIds(roomId: string): string[] {
    const data = read(roomId);
    return Array.isArray(data.acceptedMemberIds) ? data.acceptedMemberIds : [];
  },

  setAcceptedMemberIds(roomId: string, ids: string[]) {
    const data = read(roomId);
    data.acceptedMemberIds = Array.isArray(ids) ? ids.slice() : [];
    write(roomId, data);
  },

  // Serialized State helpers for no-backend mode
  getState(roomId: string): any | null {
    return read(roomId).state ?? null;
  },

  setState(roomId: string, state: any) {
    const data = read(roomId);
    data.state = state;
    write(roomId, data);
  },

  appendEvent(roomId: string, event: RoomEvent) {
    const data = read(roomId);
    const now = Date.now();
    const lastTs = data.events.length ? (data.events[data.events.length - 1].timestamp ?? now) : now;
    const finalized: RoomEvent = {
      ...event,
      timestamp: event.timestamp ?? now,
      shotTimeMs: Math.max(0, (event.timestamp ?? now) - lastTs),
    };
    data.events.push(finalized);
    write(roomId, data);
  },

  incrementFoulTotal(roomId: string, playerIndex: number, points: number) {
    const data = read(roomId);
    const idx = playerIndex === 0 ? 0 : 1;
    data.foulTotals[idx] = (data.foulTotals[idx] ?? 0) + Math.max(0, points);
    write(roomId, data);
  },

  decrementFoulTotal(roomId: string, playerIndex: number, points: number) {
    const data = read(roomId);
    const idx = playerIndex === 0 ? 0 : 1;
    data.foulTotals[idx] = Math.max(0, (data.foulTotals[idx] ?? 0) - Math.max(0, points));
    write(roomId, data);
  },

  clearRoom(roomId: string) {
    write(roomId, {
      events: [],
      foulTotals: [0, 0],
      state: undefined,
      locked: false,
      lockedAt: null,
      matchId: null,
      uploadedEventsCount: 0,
      acceptedMemberIds: null,
    });
  },

  lockRoom(roomId: string, endedAt?: number | null) {
    const data = read(roomId);
    data.locked = true;
    data.lockedAt = endedAt ?? Date.now();
    write(roomId, data);
  },

  exportRoomData(roomId: string): string {
    return JSON.stringify(read(roomId));
  },

  popLastEvent(roomId: string): RoomEvent | null {
    const data = read(roomId);
    if (!data.events.length) return null;
    const ev = data.events.pop() || null;
    write(roomId, data);
    return ev;
  },

  // Query helpers
  findNthRedPot(roomId: string, n: number): { index: number; event: RoomEvent } | null {
    const events = read(roomId).events;
    let count = 0;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.type === 'pot' && e.ballName === 'red') {
        count++;
        if (count === n) return { index: i, event: e };
      }
    }
    return null;
  },

  getEventsAfterIndex(roomId: string, index: number): RoomEvent[] {
    const events = read(roomId).events;
    if (index < -1) return events;
    return events.slice(index + 1);
  },

  getEventsAfterNthRed(roomId: string, n: number): RoomEvent[] {
    const res = this.findNthRedPot(roomId, n);
    if (!res) return [];
    return this.getEventsAfterIndex(roomId, res.index);
  },
};
