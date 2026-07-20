# Snooker Standalone — 環境設定與啟動說明

> **📢 最新部署指南**：關於詳細的生產環境部署、重部署步驟與驗證清單，請參閱 [DEPLOYMENT.md](./DEPLOYMENT.md)。
>
> **📌 任務交接 / 專案現況摘要**：若是新開任務或要快速接手目前進度，請先看 [PROJECT_STATUS_SUMMARY.md](./PROJECT_STATUS_SUMMARY.md)。

本文件主要說明目前系統的開發環境設定。舊版房間計分、LiveView、Overlay 與 Socket 即時同步流程已永久移除。

## 後端（backend）

環境變數（請在 `backend/.env` 建立，可參考 `backend/.env.example`）

- `PORT`：後端伺服器埠號，預設 `3000`。
- `CORS_ORIGIN`：允許的前端來源，例如 `http://localhost:5173`。

安裝與啟動

1. 安裝依賴：`npm install`
2. 建置：`npm run build`（會輸出到 `backend/dist`）
3. 啟動：`npm start`（執行 `node dist/index.js`）

## 前端（frontend）

若使用 Vite 代理（預設於 `vite.config.ts`），前端可直接透過相對路徑呼叫 `/api/...`。
如需指定 API 來源，請建立 `frontend/.env` 並設定：

- `VITE_API_BASE_URL`：例如 `http://localhost:3000`

啟動前端：

1. 安裝依賴：`npm install`
2. 開發模式：`npm run dev`（預設在 `http://localhost:5173`）

## 常見問題

- 若前端 API 呼叫失敗，請確認後端正在運行，並檢查 `GET /health`、`GET /health/db` 以及 `CORS_ORIGIN` 是否正確設定。
- 若編譯 TypeScript 失敗，請確認 `backend/tsconfig.json` 的 `include`、`exclude` 設定，以及已將測試檔案排除在建置之外。

## 前端部署（GitHub Pages 專案頁）

已定稿：統一使用 GitHub Actions（`.github/workflows/deploy-pages.yml`）部署前端到專案頁（`https://<你的帳號>.github.io/<repo>/`）。

- 路徑設定：Actions 會將 `BASE_PATH` 動態設為 `/${{ github.event.repository.name }}/`，確保資產與路由在專案頁子路徑下正確載入。
- SPA 404：部署流程已在建置後自動將 `dist/index.html` 複製為 `dist/404.html`，支援 GitHub Pages 的 SPA Fallback。
- 觸發條件：預設在 `main` 分支 `push` 與手動 `workflow_dispatch`。

使用步驟：
1. 在 GitHub Repo → Settings → Pages，Source 選擇「GitHub Actions」。
2. 推送到 `main` 分支（或手動觸發 Workflow）。
3. 約數十秒後，於 Actions 看見「Deploy to GitHub Pages」成功；造訪 `https://<你的帳號>.github.io/<repo>/` 驗證首頁、會員與場館路由能正常載入。

備用方案（不使用 Actions）：
- 仍保留 `frontend/package.json` 的 `predeploy`、`deploy`、`deploy:root` 腳本；若需直接用 `gh-pages` 發佈，先設定 `BASE_PATH` 為 `/snooker-standalone/`（專案頁）或 `/`（使用者首頁），再執行：
  - `npm run predeploy && npm run deploy`（專案頁）
  - `npm run predeploy && npm run deploy:root`（使用者/組織首頁）

問題排查：
- 資產 404 或白頁：確認 `BASE_PATH` 是否與實際部署子路徑一致（專案頁需為 `/<repo>/`）。
- 子路徑跳轉錯誤：確認已存在 `404.html`（Actions 已自動生成）。
- 後端 API 連線問題：檢查 `VITE_API_BASE_URL` 或 Nginx/反向代理設定是否正確，並驗證 `/health`、`/health/db`。
