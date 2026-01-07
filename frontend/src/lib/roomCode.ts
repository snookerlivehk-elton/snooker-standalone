const LS_MAP_KEY = 'roomCodes';
const LS_STATE_KEY = 'roomCodeState';

function loadMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LS_MAP_KEY) || '{}';
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveMap(map: Record<string, string>) {
  try {
    localStorage.setItem(LS_MAP_KEY, JSON.stringify(map));
  } catch {}
}
function loadState(): { last: string } {
  try {
    const raw = localStorage.getItem(LS_STATE_KEY) || '';
    if (raw) return JSON.parse(raw);
  } catch {}
  return { last: 'AAAA00000' };
}
function saveState(state: { last: string }) {
  try {
    localStorage.setItem(LS_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function incrementLetters(letters: string): string {
  const arr = letters.split('');
  for (let i = arr.length - 1; i >= 0; i--) {
    const code = arr[i].charCodeAt(0);
    if (code < 90) {
      arr[i] = String.fromCharCode(code + 1);
      for (let j = i + 1; j < arr.length; j++) arr[j] = 'A';
      return arr.join('');
    }
  }
  return 'AAAA';
}

export function nextRoomCode(): string {
  const st = loadState();
  const last = st.last || 'AAAA00000';
  const letters = last.slice(0, 4);
  const digits = last.slice(4);
  let num = parseInt(digits, 10);
  if (isNaN(num)) {
    st.last = 'AAAA00000';
    saveState(st);
    return st.last;
  }
  num += 1;
  if (num > 99999) {
    const inc = incrementLetters(letters);
    st.last = `${inc}00000`;
  } else {
    st.last = `${letters}${String(num).padStart(5, '0')}`;
  }
  saveState(st);
  return st.last;
}

export function setCodeForRoom(roomId: string, code: string) {
  const map = loadMap();
  map[String(roomId)] = String(code);
  saveMap(map);
}
export function getCodeForRoom(roomId?: string | null): string | undefined {
  if (!roomId) return undefined;
  const map = loadMap();
  return map[String(roomId)];
}
export function findRoomIdByCode(code: string): string | undefined {
  const map = loadMap();
  const entries = Object.entries(map);
  for (const [rid, c] of entries) {
    if (String(c) === String(code)) return rid;
  }
  return undefined;
}
