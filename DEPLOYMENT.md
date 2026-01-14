# 部署與維運指南 (Deployment & Operations Guide)

本文件詳細說明 Snooker Scoreboard 系統的部署流程、環境變數設定以及驗證方法。適用於 Railway（後端）與 GitHub Pages（前端）架構。

## 1. 系統架構變更與注意事項 (Recent Changes)

- **Debug Endpoint 移除**：為確保安全性，`/admin/debug/latest-members` 等測試用端點已被移除。
- **嚴格寫入權限 (Write Auth)**：前端計分板在結束比賽時，必須透過 `x-write-token` 標頭驗證權限。請確保前後端 `WRITE_TOKEN` 設定一致。
- **Socket 連線**：即時比分同步依賴 Socket.io，請確保前端能正確連線至後端 Socket 埠。

---

## 2. 後端部署 (Backend)

適用於 Railway、Docker 或任何 Node.js 託管環境。

### 2.1 環境變數 (Environment Variables)

請在部署平台的設定介面或 `.env` 檔案中設定以下變數：

| 變數名稱 | 必填 | 說明 | 範例值 |
| :--- | :--- | :--- | :--- |
| `PORT` | 否 | 伺服器監聽埠號 (預設 3000) | `8080` |
| `DATABASE_URL` | **是** | PostgreSQL 資料庫連線字串 | `postgresql://user:pass@host:5432/db` |
| `CORS_ORIGIN` | **是** | 允許的前端來源 (包含 Protocol) | `https://your-username.github.io` |
| `ADMIN_TOKEN` | **是** | 管理員後台登入 Token | `secret_admin_token_123` |
| `WRITE_TOKEN` | **是** | 計分板寫入權限 Token (需與前端一致) | `secret_write_token_456` |
| `NODE_ENV` | 否 | 執行環境 | `production` |

### 2.2 建置與啟動指令 (Build & Start)

```bash
# 安裝依賴
npm install

# 資料庫遷移 (確保 Schema 最新)
npm run db:deploy

# 建置 TypeScript 程式碼
npm run build

# 啟動伺服器
npm start
```

*注意：`npm start` 會執行 `node dist/index.js`。*

### 2.3 驗證方法 (Verification)

部署完成後，請測試以下端點：

1.  **健康檢查**：`GET /health` -> 應回傳 `{"status":"ok"}`
2.  **資料庫連線**：`GET /health/db` -> 應回傳 `{"status":"ok","db":"connected"}`

---

## 3. 前端部署 (Frontend)

適用於 GitHub Pages 或靜態網站託管。

### 3.1 建置設定 (Build Configuration)

前端環境變數需在**建置時 (Build Time)** 注入，或透過 URL 參數動態覆寫。

**方法 A：`.env` 檔案 (推薦用於固定部署)**

| 變數名稱 | 說明 | 範例值 |
| :--- | :--- | :--- |
| `VITE_API_URL` | 後端 API 位址 (無結尾斜線) | `https://your-backend.up.railway.app` |
| `VITE_SOCKET_URL` | Socket 伺服器位址 (通常同 API) | `https://your-backend.up.railway.app` |
| `VITE_ENABLE_SOCKET` | 是否啟用 Socket 連線 | `true` |
| `VITE_WRITE_TOKEN` | **重要** 寫入權限 Token (需與後端一致) | `secret_write_token_456` |

**方法 B：URL 參數 (推薦用於靈活測試)**

可直接在瀏覽器網址列附加參數來覆寫設定：
`?apiUrl=https://...&socketUrl=https://...&writeToken=...`

### 3.2 部署指令 (GitHub Pages)

**使用 `gh-pages` 套件手動部署：**

```bash
# 1. 確保 package.json 中的 homepage 欄位正確 (若非根目錄)
# "homepage": "https://<username>.github.io/<repo-name>/"

# 2. 建置並部署
npm run deploy
```

**使用 GitHub Actions (自動化)：**
推送到 `main` 分支後，GitHub Actions 會自動執行建置與部署流程。

---

## 4. 重部署後驗證清單 (Post-Deployment Checklist)

完成前後端更新後，請依序執行以下測試以確保系統運作正常：

### ✅ 1. 基礎載入測試
- [ ] 前端首頁 (`/admin`) 可正常開啟。
- [ ] 管理員登入成功 (使用 `ADMIN_TOKEN`)。

### ✅ 2. 賽事建立測試
- [ ] 進入 `/room/test-01/setup` (或使用 Admin 介面建立)。
- [ ] 輸入球員名稱，點擊 "Start Match"。
- [ ] 成功跳轉至計分板 (`/room/test-01`)。

### ✅ 3. 即時同步測試 (Socket)
- [ ] 開啟兩個瀏覽器視窗，進入同一個房間。
- [ ] 在視窗 A 點擊進球。
- [ ] **預期**：視窗 B 應在 1 秒內自動更新比分。
- [ ] **若失敗**：檢查 Console 是否有 Socket 連線錯誤 (CORS 或 URL 錯誤)。

### ✅ 4. 賽事結束與存檔測試 (API)
- [ ] 在計分板點擊 "End Match" -> "Confirm End Match"。
- [ ] 系統顯示 "Uploading match data..."。
- [ ] **預期**：成功跳轉至 Live View 或顯示上傳成功訊息。
- [ ] **若失敗**：檢查 Network Tab 的 `/api/matches/.../finalize` 請求，確認是否回傳 `403 Forbidden` (Token 錯誤) 或 `500 Error`。

---

## 5. 常見問題排除 (Troubleshooting)

- **Q: 顯示 "Network Error" 或無法連線？**
  - A: 檢查 `VITE_API_URL` 是否正確，且後端 `CORS_ORIGIN` 有包含前端網址。

- **Q: Socket 連線失敗 (Polling/WebSocket error)？**
  - A: 確認後端支援 Sticky Sessions (若有多實例)，或檢查防火牆/Proxy 設定是否擋住了 WebSocket。Railway 預設支援。

- **Q: 結束比賽時顯示 "Permission Denied"？**
  - A: 前端 `VITE_WRITE_TOKEN` 與後端 `WRITE_TOKEN` 不一致。請重新設定並重新建置前端，或在 URL 加上 `&writeToken=正確值` 暫時修正。
