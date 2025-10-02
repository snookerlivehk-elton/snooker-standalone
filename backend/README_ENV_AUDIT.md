Environment Variable Audit Usage

Purpose
- Record snapshots of environment variables at startup and on `.env` changes.
- Provide diff for added/removed/changed keys to aid reliability.

Enable/Disable
- Controlled by `ENV_AUDIT_ENABLED` (default `true`).
- Set `ENV_AUDIT_ENABLED=false` to disable in production if policy requires.

Log Location & Format
- File: `backend/env-history.jsonl` (JSON Lines).
- Entry fields:
  - `timestamp`: ms since epoch
  - `source`: `process.env` or `.env`
  - `values`: key-value map (strings)
  - `diffFromPrev`: `{ added: string[], removed: string[], changed: { [key]: { from: string|null, to: string|null } } }`

Operational Notes
- Startup writes a snapshot of `process.env` and `.env` (if present).
- File changes to `backend/.env` append a new snapshot automatically.
- Fail-safe: logging errors do not crash the server; entries are append-only.

Security Recommendations
- Consider masking sensitive keys (`*_TOKEN`, `*_SECRET`, `*_KEY`) prior to write.
- Restrict access to the log file or mount to secure storage in cloud.
- Disable audit in environments where policies forbid storing raw env values.

Backup & Restore (Enhanced)
- Use `env.manifest.json` to define required keys and types (PORT, CORS_ORIGIN, ENV_AUDIT_ENABLED, DATABASE_URL).
- Validate before backup/restore:
  - `npm run env:check` prints a JSON report and returns non-zero on errors.
  - `npm run env:export` writes a snapshot under `backend/env-snapshots/env_YYYYMMDD_HHMMSS.json`.
- Suggested backup steps:
  1. Run `npm run env:check` and ensure `status=ok`.
  2. Run `npm run env:export` to capture current values.
  3. Backup the whole `snooker-standalone/` folder, including `backend/.env`, `backend/prisma/`, and `backend/.pgdata/`.
  4. Optionally produce a DB logical dump with `pg_dump`.
- Suggested restore steps:
  1. Restore app folder and `.env`.
  2. Start DB and apply migrations: `npm run db:migrate`.
  3. Run `npm run env:check`; compare with `env-snapshots/` if needed.
  4. Verify `GET /health` and `GET /health/db`.

Changelog Guidance
- Maintain `CHANGELOG.md` (Keep a Changelog style) at project root.
- Log environment changes (new/removed keys, default changes) and DB schema changes.
- Include action items (migrations required, rebuild, update `.env`) and rollback notes.