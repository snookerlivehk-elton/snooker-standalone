# 部署與維運指南 (Deployment & Operations Guide)

本文件詳細說明目前 Snooker Standalone 系統的部署流程、環境變數設定以及驗證方法。適用於 Railway（後端）與 GitHub Pages（前端）架構。

## 1. 系統架構變更與注意事項 (Recent Changes)

- **Debug Endpoint 移除**：為確保安全性，`/admin/debug/latest-members` 等測試用端點已被移除。
- **舊計分系統已退場**：`/room/*`、`/rooms`、舊 Socket.io 同步、房間 API 與寫入 Token 流程已永久移除。
- **目前重點模組**：會員入口、球會後台、預約/積分/QR session、新聞、排行榜與高桿資料。

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
| `NODE_ENV` | 否 | 執行環境 | `production` |
| `ENABLE_DB_BOOTSTRAP` | 否 | 僅供舊資料庫一次性補表，預設關閉 | `true` |

### 2.2 建置與啟動指令 (Build & Start)

```bash
# 安裝依賴
npm install

# 資料庫遷移 (確保 Schema 最新)
npm run db:deploy

# 僅在舊資料庫需要一次性補 club schema 時才執行
# npm run db:bootstrap:club

# 建置 TypeScript 程式碼
npm run build

# 啟動伺服器
npm start
```

*注意：`npm start` 會執行 `node dist/index.js`，預設不再於啟動時自動修改資料庫 schema。*

### 2.3 驗證方法 (Verification)

部署完成後，請測試以下端點：

1.  **健康檢查**：`GET /health` -> 應回傳 `{"status":"ok"}`
2.  **資料庫連線**：`GET /health/db` -> 應回傳 `{"status":"ok","db":"connected"}`

---

## 3. 前端部署 (Frontend)

適用於 GitHub Pages 或靜態網站託管。

### 3.1 建置設定 (Build Configuration)

前端環境變數需在**建置時 (Build Time)** 注入。

**方法 A：`.env` 檔案 (推薦用於固定部署)**

| 變數名稱 | 說明 | 範例值 |
| :--- | :--- | :--- |
| `VITE_API_URL` | 後端 API 位址 (無結尾斜線) | `https://your-backend.up.railway.app` |

註：前端仍相容舊的 `VITE_API_BASE_URL`，但新部署請統一使用 `VITE_API_URL`。

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
- [ ] 前端首頁 (`/`) 可正常開啟。
- [ ] 管理員登入成功 (使用 `ADMIN_TOKEN`)。
- [ ] `GET /health` 與 `GET /health/db` 均為 `200 OK`。

### ✅ 2. 核心後台測試
- [ ] `/members/login` 可正常登入會員或場館帳號。
- [ ] `/admin/overview` 可正常載入功能設定與概覽。
- [ ] `/venue/dashboard` 可正常載入場館資料、內容、預約與會員管理。

### ✅ 3. 球會功能測試
- [ ] 預約、積分、QR session、高桿或新聞模組可依已開通功能正常載入。
- [ ] 若功能被關閉，前後端應回傳正確的關閉狀態，而非白屏或 500。

---

## 5. 常見問題排除 (Troubleshooting)

- **Q: 顯示 "Network Error" 或無法連線？**
  - A: 檢查 `VITE_API_URL` 是否正確，且後端 `CORS_ORIGIN` 有包含前端網址。
