
const LS_STATE_KEY = 'roomCodeState';
const mockLocalStorage = {
    store: {},
    getItem: function(key) { return this.store[key] || null; },
    setItem: function(key, value) { this.store[key] = value; }
};

global.localStorage = mockLocalStorage;

// Copy-paste logic from roomCode.ts (simplified for testing)
function loadState() {
  try {
    const raw = localStorage.getItem(LS_STATE_KEY) || '';
    if (raw) return JSON.parse(raw);
  } catch {}
  return { last: 'AAAAA0000' };
}
function saveState(state) {
  try {
    localStorage.setItem(LS_STATE_KEY, JSON.stringify(state));
  } catch {}
}

function incrementLetters(letters) {
  const arr = letters.split('');
  for (let i = arr.length - 1; i >= 0; i--) {
    const code = arr[i].charCodeAt(0);
    if (code < 90) {
      arr[i] = String.fromCharCode(code + 1);
      for (let j = i + 1; j < arr.length; j++) arr[j] = 'A';
      return arr.join('');
    }
  }
  return 'A'.repeat(letters.length || 5);
}

function nextRoomCode() {
  const st = loadState();
  const patternNew = /^[A-Z]{5}\d{4}$/;
  let last = st.last || 'AAAAA0000';
  if (!patternNew.test(last)) {
    console.log(`[Test] Invalid pattern found: ${last}. Resetting.`);
    last = 'AAAAA0000';
  }
  const letters = last.slice(0, 5);
  const digits = last.slice(5);
  let num = parseInt(digits, 10);
  if (isNaN(num)) {
    st.last = 'AAAAA0000';
    saveState(st);
    return st.last;
  }
  num += 1;
  if (num > 9999) {
    const inc = incrementLetters(letters);
    st.last = `${inc}0000`;
  } else {
    st.last = `${letters}${String(num).padStart(4, '0')}`;
  }
  saveState(st);
  return st.last;
}

// Test Case 1: Fresh Start
console.log("--- Test 1: Fresh Start ---");
localStorage.store = {};
console.log("1:", nextRoomCode());
console.log("2:", nextRoomCode());

// Test Case 2: Old Format in Storage
console.log("\n--- Test 2: Old Format in Storage (AAAA00000) ---");
localStorage.setItem(LS_STATE_KEY, JSON.stringify({ last: 'AAAA00000' })); // 4 letters, 5 digits
console.log("After Reset:", nextRoomCode());

// Test Case 3: Overflow Digits
console.log("\n--- Test 3: Overflow Digits (AAAAA9999) ---");
localStorage.setItem(LS_STATE_KEY, JSON.stringify({ last: 'AAAAA9999' }));
console.log("Overflow:", nextRoomCode());

// Test Case 4: Overflow Letters
console.log("\n--- Test 4: Overflow Letters (AZZZZ9999) ---");
localStorage.setItem(LS_STATE_KEY, JSON.stringify({ last: 'AZZZZ9999' }));
console.log("Letter Overflow:", nextRoomCode());
