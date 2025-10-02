import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const root = process.cwd();
const manifestPath = path.join(root, 'env.manifest.json');
const envFilePath = path.join(root, '.env');

function loadManifest() {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function loadDotEnv() {
  try {
    const raw = fs.readFileSync(envFilePath, 'utf8');
    return dotenv.parse(raw);
  } catch {
    return {};
  }
}

function asBool(v) {
  if (typeof v !== 'string') return undefined;
  const s = v.trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
}

function validate(manifest, env) {
  const errors = [];
  const report = {};
  for (const [key, def] of Object.entries(manifest)) {
    const raw = env[key] ?? process.env[key];
    let ok = true;
    let parsed = raw;
    switch (def.type) {
      case 'number': {
        const n = raw !== undefined ? Number(raw) : undefined;
        ok = raw !== undefined && !Number.isNaN(n);
        parsed = n;
        break;
      }
      case 'boolean': {
        const b = asBool(raw);
        ok = b !== undefined;
        parsed = b;
        break;
      }
      case 'string': {
        ok = typeof raw === 'string' && raw.length > 0;
        parsed = raw;
        break;
      }
      default:
        ok = true;
    }
    if (def.required && (raw === undefined || !ok)) {
      errors.push(`${key}: missing or invalid (${def.type})`);
    }
    report[key] = { value: raw ?? null, type: def.type, valid: ok };
  }
  return { errors, report };
}

function main() {
  const manifest = loadManifest();
  const dotEnv = loadDotEnv();
  const { errors, report } = validate(manifest, dotEnv);
  const out = {
    status: errors.length === 0 ? 'ok' : 'error',
    errors,
    report,
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(errors.length === 0 ? 0 : 1);
}

main();