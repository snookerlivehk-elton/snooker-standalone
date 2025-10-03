All notable changes to this project will be documented in this file.

Format
- Follows Keep a Changelog.
- Categories: Added, Changed, Fixed, Removed, Security.

Unreleased
- Added: Postgres service in Compose (port 5433) and `DATABASE_URL`.
- Added: Prisma schema aligned to DB proposal; migrations and client generation.
- Added: `/health/db` endpoint for DB connectivity.
- Added: Environment tools `env:check` and `env:export` with `env.manifest.json`.
- Changed: Backend build fixes for ESM import extension (`envAudit.js`).
- Fixed: TypeScript strict mode issues in env audit.
- Docs: Enhanced backup/restore guidance and changelog practices in `README_ENV_AUDIT.md`.
# Changelog

## 2025-10-04

- Environment
  - Ran `npm run env:check` (status ok) to validate against `backend/env.manifest.json`.
  - Ran `npm run env:export` and saved snapshot to `backend/env-snapshots/`.
  - Confirmed `backend/env-history.jsonl` is active for `.env` change tracking.
- Frontend Overlay
  - Unified center black bar and adjusted capsules spacing/overlap (TV-style).
  - Widened scoreboard bar width (~85vw) without changing height or font.
  - Added left/right yellow triangle indicators with opacity toggle to avoid layout shift.
  - Enlarged central frames font size for readability.
- LiveView/Scoreboard
  - Socket.IO client configured with `transports: ['websocket']` and `path: '/socket.io'` to prevent polling aborts.