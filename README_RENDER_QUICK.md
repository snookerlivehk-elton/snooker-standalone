# Render 部署一鍵快查清單（不再使用 Railway）

目標：用 `render.yaml` Blueprint 在 Render 一次建立 Postgres 與後端服務，後端以 Dockerfile 啟動 `npm run start:migrate`（自動套用 Prisma migrations），避免 Railway 的 UI 與快取問題。

## 1. 準備與匯入 Blueprint
- 登入 Render → 左側選單選 `Blueprints` → `New Blueprint`
- 將本倉庫 `render.yaml` 內容貼上（或指向 GitHub 存放的同檔案）。
- 按 `Apply` 建立資源。

Blueprint 內容（重點）：
- 不含 `databases`：改用你現有的 Render Postgres External Connection String。
- `services.snooker-backend`：Node 20 以 `npm run start:migrate` 啟動，`healthCheckPath=/health`。
- `services.snooker-frontend`：Static runtime，`staticPublishPath: dist`。
- `envVars`：
  - `DATABASE_URL`：請填入 External Connection String（如需 SSL 加上 `?sslmode=require`）。
  - `CORS_ORIGIN`：填入你的前端公開網址（逗號分隔多域）。
  - `ADMIN_TOKEN`：手動設定隨機安全字串。

## 2. 啟動流程（Node 20）
- Blueprint 使用 Node runtime：`buildCommand: npm ci && npm run build`、`startCommand: npm run start:migrate`。
- 在建置過程包含 Prisma 資源，`postinstall/prestart` 會執行 `prisma generate`，確保 Prisma 客戶端生成。
- Render 會自動注入 `PORT`；請不要手動設定 `PORT`。

## 3. 部署與日誌檢查
- 建立後 Render 會自動部署；在服務頁面檢查 `Deploy logs`：
  - 基底 Node 版本為 `node:20*`。
  - `prisma generate` 成功，無 `Could not find Prisma Schema` 或 `libssl` 錯誤。
  - 啟動命令為 `npm run start:migrate`，並顯示 `Listening on 0.0.0.0:<PORT>`。

## 4. 設定變數（必要）
- `ADMIN_TOKEN`：請在 Render 服務的 `Environment`/`Env Vars` 設為安全字串（例如隨機 32 位）。
- `CORS_ORIGIN`：改為你的前端公開網址（可逗號分隔多域）。
- `SOCKET_IO_PATH`（如需）：預設 `/socket.io`。

## 5. 部署後健康檢查（Windows PowerShell）
```powershell
curl.exe -i -v https://<你的-render-服務>.onrender.com/health
curl.exe -i    https://<你的-render-服務>.onrender.com/health/db
curl.exe -i    https://<你的-render-服務>.onrender.com/admin/overview -H "x-admin-token: <你的ADMIN_TOKEN>"
```

成功標準：所有端點 `200 OK`、無 404；`/admin/overview` 返回 JSON 且 `db.status: ok`。

## 6. 常見故障與快速修復
- `Prisma schema not found`：確保 Dockerfile 在 `npm ci` 前已 `COPY prisma/**`；並使用 Node 20。
- 連線資料庫錯誤：確認 `DATABASE_URL` 來自 Render Databases 的 External Connection String（必要時加 `?sslmode=require`）；檢查 `/health/db`。
- CORS 錯誤：將所有前端公開域名加入 `CORS_ORIGIN`（逗號分隔）。

## 7. 我可代管操作
- 若你願意，我可代你在 Render 貼上 Blueprint、設定變數並監看 Logs；請提供欲使用的前端域名與要設定的 `ADMIN_TOKEN`（可先給測試值）。

---

## 8. 以 GitHub Actions 觸發 Render 重新部署（可選，推薦）

若你偏好在推送到 `main` 時自動讓 Render 重新部署，可在本倉庫使用內建的工作流：`.github/workflows/render-redeploy.yml`。

步驟：
- 在 GitHub Repo → Settings → Secrets → Actions，新增：
  - `RENDER_API_KEY`：你的 Render API Key（於 Render Dashboard → Account → API Keys 取得）。
- 確認工作流中的 Service ID（預設已填）為你的服務：
  - `RENDER_BACKEND_SERVICE_ID`
  - `RENDER_FRONTEND_SERVICE_ID`
- 觸發方式：
  - Push 到 `main`，或手動 `Actions → Render Redeploy → Run workflow`。

工作流行為：
- 依序呼叫 Render API：`POST /v1/services/<SERVICE_ID>/deploys`，觸發後端、前端兩個服務的 redeploy。
- 在 Render → Services → Deploy logs 觀察建置與啟動過程。

注意：
- 此工作流不包含環境變數的設定；請先在 Render 服務頁面設定 `DATABASE_URL`、`CORS_ORIGIN`、`ADMIN_TOKEN`、`SOCKET_IO_PATH` 等必要值。
- 若希望只在特定路徑改動時觸發，可自行在 YAML 中加入 `paths:` 篩選。