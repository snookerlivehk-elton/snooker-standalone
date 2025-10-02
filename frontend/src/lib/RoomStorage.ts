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
  foulTotals: [number, number]; // index 0: player A, index 1: player B
}

const STORAGE_PREFIX = 'snooker_room_';

function getKey(roomId: string) {
  return `${STORAGE_PREFIX}${roomId}`;
}

function read(roomId: string): RoomData {
  try {
    const raw = localStorage.getItem(getKey(roomId));
    if (!raw) {
      return { events: [], foulTotals: [0, 0] };
    }
    const parsed = JSON.parse(raw);
    // Basic shape guard
    return {
      events: Array.isArray(parsed?.events) ? parsed.events : [],
      foulTotals: Array.isArray(parsed?.foulTotals) && parsed.foulTotals.length === 2
        ? parsed.foulTotals
        : [0, 0],
    };
  } catch {
    return { events: [], foulTotals: [0, 0] };
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

  clearRoom(roomId: string) {
    write(roomId, { events: [], foulTotals: [0, 0] });
  },

  exportRoomData(roomId: string): string {
    return JSON.stringify(read(roomId));
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