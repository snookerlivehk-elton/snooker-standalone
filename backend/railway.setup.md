# Railway 極簡部署（不用 Docker）

此指南提供最簡單的部署方式：使用 Railway 的 Nixpacks（Railpack）直接從 `backend` 啟動 Node.js，而不需要理解或編寫 Dockerfile。

## 0. 準備資料庫（Railway Postgres）
- 在 Railway 專案中新增一個資料庫服務（PostgreSQL）。
- 進入該資料庫服務的 `Settings → Connect`，複製 `PostgreSQL Connection URL`。
- 稍後在後端服務的 `Variables` 內貼上此連線字串作為 `DATABASE_URL`。
  - 典型格式：`postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public`
  - 若 Railway 提供 `sslmode=require`，可保留；Prisma 亦能處理。

## 1. 設定服務來源
- 打開 Railway 專案 → 你的服務 → `Settings`。
- 在右側 `Source` 區塊：
  - `Root Directory` 填入：`backend`。

## 2. 切換建置器為 Nixpacks（Railpack）
- 在 `Settings → Build`：
  - 將 `Builder` 選為 `Nixpacks`（或 `Build with Nixpacks`）。
  - `Build Command`：`npm ci && npm run build`
  - `Start Command`：`npm start`

提示與相容性：
- 專案目前已在 `backend/package.json` 設定：
  - `prestart: prisma generate`（確保在啟動前生成 Prisma Client）
  - `postinstall: prisma generate`（確保建置過程亦會生成 Prisma Client）
- 因此無論是 Nixpacks（免 Docker）或 Dockerfile，都能自動生成 Prisma Client，避免 `@prisma/client did not initialize yet`。

> 若 UI 顯示「Dockerfile Automatically Detected」且無法切換：
> - 仍可保留 Dockerfile（不需刪檔），但建議按一下 Builder 選單改為 Nixpacks；若你的方案無法切換，直接使用 Dockerfile 也可行（本專案已修正 Prisma 生成）。

## 3. 設定環境變數
- `Variables` 中新增或確認：
  - `DATABASE_URL`：你的 PostgreSQL 連線，例如 `postgresql://user:pass@host:5432/db?schema=public`
  - `CORS_ORIGIN`：前端公開網址，可多域以逗號分隔，如 `https://your-frontend.app,https://overlay.app`
  - 可選：`SOCKET_IO_PATH`（預設 `/socket.io`）、`ENV_AUDIT_ENABLED`（預設 `true`）

注意：
- 不要手動設定 `PORT`；Railway 會自動注入 `PORT`，後端程式已使用 `process.env.PORT` 監聽對應埠。
- `DATABASE_URL` 建議直接使用剛剛在資料庫服務 `Connect` 頁面複製的 URL，避免手動拼接錯誤。

> 已在 `backend/package.json` 加入 `prestart: prisma generate` 與 `postinstall: prisma generate`，並將 `prisma` 置於 `dependencies`；因此 Nixpacks 與 Docker 兩種模式都能自動生成 Prisma Client。

## 4. 重新部署與驗證
- 觸發 `Deploy`，在 `Logs` 檢查：
  - 有 `Prisma Client` 生成成功（或顯示已存在）。
  - 進程以 `node dist/index.js` 啟動且無錯誤。
  - 出現 `listening on 0.0.0.0:XXXX` 字樣（`XXXX` 為 Railway 注入的 `PORT`）。
- 瀏覽器驗證：
  - `GET /health` 應回 `{ status: 'ok' }`
  - `GET /health/db` 應回 200；若失敗，檢查 `DATABASE_URL` 與資料庫可達性。
  - 若前端（WebSocket）握手失敗，先確認 `CORS_ORIGIN` 是否包含前端完整公開網址。

## 5. 常見狀況
- 仍看到「@prisma/client did not initialize yet」：
  - 確認 `Build Command` 有跑 `npm ci && npm run build`，且 `postinstall` 有被執行（Nixpacks 會跑 lifecycle）。
  - 確認 `backend/prisma/schema.prisma` 存在；若用 Dockerfile，runner 階段需複製 `prisma/` 並執行 `npx prisma generate`（已設定）。
- CORS 錯誤：把前端公開網址加到 `CORS_ORIGIN`，多域用逗號分隔。
- `PORT` 相關錯誤：不要在 Railway Variables 手動設 `PORT`；讓平台注入正確值即可。

## 6. 前端部署（可選，簡單版）
- 建議獨立建立一個前端服務，Root 設為 `frontend`：
  - Builder：`Nixpacks`
  - Build：`npm ci && npm run build`
  - Start：使用靜態託管（如 Nginx），或改用 Cloudflare Pages/Netlify 更簡單。
  - `VITE_SOCKET_URL`：指向後端公開 URL（例如 `https://your-backend.railway.app`）。

完成以上步驟，即可用最簡方式在 Railway 部署後端，不需要理解 Docker 細節。

## 7. 快速排查清單（故障時）
- 打開 `Deploy Logs`，搜尋 `prisma generate` 與 `listening on 0.0.0.0:` 是否出現。
- 確認 `Variables`：`DATABASE_URL` 來源為 Railway Postgres 連線字串；`CORS_ORIGIN` 含你的前端公開網址（可多域逗號分隔）。
- 嘗試 `GET /health` 與 `GET /health/db`；若 DB 健康檢查失敗，先在 Railway DB 服務頁確認可連線（如 `psql` 或 DataGrip）。
- 若 UI 無法切換至 Nixpacks，直接使用現有 Dockerfile（已在 runner 階段 `npx prisma generate`）。

## 8. UI 對照（Railway）
- `Settings → Source → Root Directory`：填 `backend`
- `Settings → Build → Builder`：選 `Nixpacks`
- `Settings → Build → Build Command`：`npm ci && npm run build`
- `Settings → Build → Start Command`：`npm start`
- `Settings → Variables`：新增 `DATABASE_URL`、`CORS_ORIGIN`（不要手動設 `PORT`）