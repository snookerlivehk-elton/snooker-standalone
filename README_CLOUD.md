Cloud Deployment Readiness Guide

Overview
- Backend and frontend are containerized for cloud deployment.
- Compose provided for local orchestration; adapt to ECS/Kubernetes.
- Environment audit can be toggled via `ENV_AUDIT_ENABLED`.

Prerequisites
- Docker 24+, Docker Compose v2
- Node 18 (optional for local builds)

Build & Run Locally (Production-like)
- `docker compose up --build -d`
- Frontend: `http://localhost:8080/`
- Backend: `http://localhost:3000/` and health `GET /health`

Environment Variables
- Backend
  - `PORT` (default: 3000)
  - `CORS_ORIGIN` (default: `http://localhost:8080`)
  - `ENV_AUDIT_ENABLED` (default: `true`)
- Persist audit log by mounting `./backend/env-history.jsonl`.

Cloud Quick Start (Backend-first)
- Copy `backend/.env.cloud.example` to cloud host and fill values (`PORT`, `CORS_ORIGIN`, `DATABASE_URL`, `SOCKET_IO_PATH`).
- Ensure DB connectivity and open port 3000 or place behind reverse proxy.
- Start backend via Compose override: `docker compose -f docker-compose.yml -f docker-compose.override.cloud.yml up -d backend`.
- Keep existing local Overlay for now; set `frontend/.env.cloud.example` -> `VITE_SOCKET_URL` to cloud backend URL.

Docker Compose Override (example)
- Use `docker-compose.override.cloud.yml` to inject environment variables and expose ports in cloud.
- Command: `docker compose -f docker-compose.yml -f docker-compose.override.cloud.yml up -d`.

Reverse Proxy Notes
- Align `SOCKET_IO_PATH` (default `/socket.io`) and enable WebSocket upgrade.
- Example Nginx config:
```
location /socket.io/ {
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_http_version 1.1;
  proxy_pass http://backend:3000/socket.io/;
}
```

Production Checklist
- `CORS_ORIGIN` includes all public domains (frontend, overlay).
- `VITE_SOCKET_URL` points to backend public URL.
- DB reachable and schema/migrations applied.
- Ports opened or reverse proxy configured with TLS.

Cloud Targets
- AWS ECS Fargate
  - Push images to ECR.
  - Service: backend on 3000, frontend behind ALB or CloudFront (Nginx).
  - Secrets: AWS Secrets Manager for environment variables.
  - DB: RDS (PostgreSQL) for match records.
- Alternatives
  - Render/Railway for backend, Cloudflare Pages/Netlify for frontend.

CI/CD
- GitHub Actions `.github/workflows/ci.yml` builds both apps.
- Extend workflow to build/push Docker images and deploy.

Health, Observability, Security
- Health endpoint: `/health` returns status/uptime.
- Logs: container stdout; environment audit JSONL persisted when enabled.
- CORS: set `CORS_ORIGIN` to your frontend domain.
- Secrets: disable audit in production if policy requires (`ENV_AUDIT_ENABLED=false`).

Next Steps
- Choose cloud provider and provision repository/container registry.
- Add deploy steps to CI (ECR login, docker buildx, push, ECS service update).
- Define DB schema and migration tooling (e.g., Prisma/Knex) for master database.