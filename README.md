# Snooker Scoreboard — 環境設定與啟動說明

本文件說明如何設定必要的環境變數，以及如何在本機啟動前後端服務。

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

- 若出現 `Unexpected end of JSON input`，請確認後端正在運行、`GET /api/rooms` 能回傳有效 JSON，並檢查 `CORS_ORIGIN` 是否正確設定。
- 若編譯 TypeScript 失敗，請確認 `backend/tsconfig.json` 的 `include`、`exclude` 設定，以及已將測試檔案排除在建置之外。