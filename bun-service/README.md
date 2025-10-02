# Bun/Hono 服務部署到 Railway（一步一步）

本目錄包含以 Bun + Hono 撰寫的最小服務，可在 Railway 以 Monorepo 方式獨立部署。

## 目錄位置

- Root Directory：`snooker-standalone/bun-service`
  - 入口檔：`index.tsx`
  - 啟動腳本：`package.json` 內的 `start`

## Railway 服務設定

1. 在 Railway Dashboard 按 `New Project` → 選 `GitHub Repository`。
2. 選擇你的 Monorepo，服務來源設定：
   - Root Directory：`snooker-standalone/bun-service`
   - Build Command：`bun install`
   - Start Command：`bun run start`
3. Health Check（HTTP）：
   - 路徑：`/api/health`

## 環境變數（選用）

- `PORT`：Railway 會自動注入；程式使用 `process.env.PORT ?? 3000`。
- `CORS_ORIGIN`：若要限制跨網域，請改用 `cors({ origin: '<你的前端域名>' })`。

## 部署後驗證

1. 於服務 Logs 看到 Bun 啟動且無錯誤。
2. 造訪 `https://<your-service>.railway.app/api/health`，應回 `{"status":"ok"}`。

## 本機開發（可選）

```bash
bun install
bun run dev
# 開啟 http://localhost:3000/api/health
```

## 與既有服務並存

- 此服務可與 `snooker-standalone/backend`（Express/Socket.IO）並存。
- 若需要資料庫，請為本服務也設定 `DATABASE_URL` 並新增對應的健康檢查路由（例如 `/api/health/db`）。