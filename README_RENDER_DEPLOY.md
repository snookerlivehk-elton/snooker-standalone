# Render 雲端驗證與部署步驟

## 目標
- 後端以 Node 20 運行，啟動前自動套用 Prisma 遷移
- 前端為靜態站，於建置時嵌入後端公開 URL 與 Socket 路徑

## 後端
- 在 Render 新增 Web Service
- RootDir: `backend`
- Runtime: `node`
- Build Command: `npm ci && npm run build`
- Start Command: `npm run start:migrate`
- Health Check Path: `/health`
- Env Vars:
  - `NODE_VERSION=20`
  - `DATABASE_URL`（以 Dashboard 設定）
  - `CORS_ORIGIN`（以逗號分隔多網域）
  - `ADMIN_TOKEN`（以 Dashboard 設定）
  - `WRITE_TOKEN`（可選，以 Dashboard 設定）
  - `SOCKET_IO_PATH=/socket.io`

## 前端
- 在 Render 新增 Web Service
- RootDir: `frontend`
- Runtime: `static`
- Build Command:
  - `VITE_SOCKET_URL="https://${BACKEND_HOST}.onrender.com" VITE_API_URL="https://${BACKEND_HOST}.onrender.com" VITE_SOCKET_PATH="/socket.io" node ../scripts/generate-admin-redirect.js && npm ci && npm run build`
- Static Publish Path: `dist`
- Env Vars:
  - `BACKEND_HOST` 來源綁定後端服務 `host` 屬性

## 驗證
- 瀏覽後端 `GET /health` 與 `GET /health/db`
- 以管理員 Token 驗證 `GET /admin/overview`
- 前端頁面開啟並測試 Socket 握手，路徑對齊 `/socket.io`

## 提示
- 秘密請於 Render Dashboard 設定，不存入檔案
- 若使用反向代理，保持 `SOCKET_IO_PATH` 與前端 `VITE_SOCKET_PATH` 一致
