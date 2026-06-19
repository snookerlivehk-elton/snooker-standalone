All notable changes to this project will be documented in this file.

Format
- Follows Keep a Changelog.
- Categories: Added, Changed, Fixed, Removed, Security.

Unreleased
- Added: `SessionSettlement`, `SessionSettlementAttempt`, and `DomainEventOutbox` Prisma models plus migration `20260620000001_add_session_settlement` for the new settlement orchestration layer.
- Added: Backend `settlement` plugin with member/admin APIs for querying and confirming settlements.
- Changed: `qr-session` no longer writes `PointsLedger` / `PointsBalance` directly; settlement completion now delegates point charging through `settlement -> points`.
- Changed: Member QR end flow becomes two-step settlement confirmation. `POST /api/qr/table/end-confirm` now prepares a quote, and `POST /api/settlements/:id/confirm` performs the actual point deduction.
- Changed: Frontend `TableQrPage` now shows settlement quote details before final point deduction confirmation.
- Added: Architecture note `QR_SESSION_SETTLEMENT_POINTS_FLOW.md` documenting the new `qr-session -> settlement -> points` contract.
- Changed: Backend enters plugin-oriented modularization checkpoint for `booking`, `qr-session`, `points`, `live`, `club-messages`, `members`, `tournaments`, `highbreak`, and admin/system modules.
- Added: Core helper layers under `backend/src/core/booking`, `backend/src/core/club`, `backend/src/core/live`, and `backend/src/core/qr-session`.
- Added: `service` / `repository` split for `booking`, `points`, and `qr-session` plugins to reduce business logic concentration in `backend/index.ts` and `backend/routes/club.ts`.
- Changed: `backend/index.ts` and `backend/routes/club.ts` now mainly act as composition/gateway layers by mounting plugin routers instead of directly owning large business flows.
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
- Legacy scoring stack
  - Historical note only: previous Overlay / LiveView / Scoreboard socket tuning has been superseded because the entire legacy scoring flow was removed in 2026-06.
