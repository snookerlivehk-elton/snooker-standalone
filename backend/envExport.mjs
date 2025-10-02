import fs from 'fs';
import path from 'path';

const root = process.cwd();
const manifestPath = path.join(root, 'env.manifest.json');
const snapshotsDir = path.join(root, 'env-snapshots');

function loadManifest() {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) + '_' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function main() {
  const manifest = loadManifest();
  const keys = Object.keys(manifest);
  const snapshot = {};
  for (const k of keys) {
    snapshot[k] = process.env[k] ?? null;
  }
  if (!fs.existsSync(snapshotsDir)) fs.mkdirSync(snapshotsDir);
  const outPath = path.join(snapshotsDir, `env_${nowStamp()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot written: ${outPath}`);
}

main();