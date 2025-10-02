import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
const LOG_PATH = path.resolve(process.cwd(), 'env-history.jsonl');
const ENV_FILE_PATH = path.resolve(process.cwd(), '.env');
let lastProcessEnv = null;
let lastDotEnv = null;
function computeDiff(prev, curr) {
    const added = [];
    const removed = [];
    const changed = {};
    const prevKeys = new Set(Object.keys(prev || {}));
    const currKeys = new Set(Object.keys(curr));
    for (const k of currKeys) {
        const prevVal = prev ? prev[k] : undefined;
        if (!prevKeys.has(k)) {
            added.push(k);
            changed[k] = { from: null, to: curr[k] ?? null };
        }
        else if (prevVal !== curr[k]) {
            changed[k] = { from: prevVal ?? null, to: curr[k] ?? null };
        }
    }
    for (const k of prevKeys) {
        if (!currKeys.has(k)) {
            removed.push(k);
            changed[k] = { from: prev[k] ?? null, to: null };
        }
    }
    return { added, removed, changed };
}
function appendLog(snapshot) {
    const line = JSON.stringify(snapshot);
    try {
        fs.appendFileSync(LOG_PATH, line + '\n');
    }
    catch (e) {
        // swallow errors: logging should not crash server
        console.warn('envAudit: failed to append log', e);
    }
}
function captureProcessEnv() {
    const values = {};
    for (const k of Object.keys(process.env)) {
        const v = process.env[k];
        if (typeof v === 'string')
            values[k] = v;
    }
    const diff = computeDiff(lastProcessEnv, values);
    const snapshot = {
        timestamp: Date.now(),
        source: 'process.env',
        values,
        ...(lastProcessEnv ? { diffFromPrev: diff } : {}),
    };
    lastProcessEnv = values;
    appendLog(snapshot);
}
function parseDotEnv(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return dotenv.parse(content);
    }
    catch {
        return {};
    }
}
function captureDotEnv() {
    const values = parseDotEnv(ENV_FILE_PATH);
    const diff = computeDiff(lastDotEnv, values);
    const snapshot = {
        timestamp: Date.now(),
        source: '.env',
        values,
        ...(lastDotEnv ? { diffFromPrev: diff } : {}),
    };
    lastDotEnv = values;
    appendLog(snapshot);
}
export function startEnvAudit() {
    // Ensure log file exists
    try {
        if (!fs.existsSync(LOG_PATH))
            fs.writeFileSync(LOG_PATH, '');
    }
    catch { }
    // Initial captures
    captureProcessEnv();
    if (fs.existsSync(ENV_FILE_PATH)) {
        captureDotEnv();
        // Watch for changes to .env
        try {
            fs.watch(ENV_FILE_PATH, { persistent: false }, (eventType) => {
                if (eventType === 'change') {
                    captureDotEnv();
                }
            });
        }
        catch { }
    }
}
export function getEnvHistoryTail(lines = 100) {
    try {
        const content = fs.readFileSync(LOG_PATH, 'utf8');
        const arr = content.split(/\r?\n/).filter(Boolean);
        return arr.slice(Math.max(0, arr.length - lines));
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=envAudit.js.map