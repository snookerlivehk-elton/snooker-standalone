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