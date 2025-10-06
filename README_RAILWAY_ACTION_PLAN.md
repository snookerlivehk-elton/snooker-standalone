Railway 設定與重部署行動手冊（snookerhk.live）

目的
- 修復線上後端不可連線，完成健康端點與 Admin 概覽驗證，恢復人工實測能力。

後端服務設定（Railway）
- Source → Root Directory：`backend`
- Build → Builder：`Nixpacks`（或使用 `backend/Dockerfile`，Node 20）
- Build → Build Command：`npm ci && npm run build`
- Build → Start Command：`npm start`
- Variables（不要手動設定 `PORT`）：
  - `DATABASE_URL`：填入 Railway Postgres 連線字串（例如 `postgresql://USER:PASSWORD@HOST:PORT/DB?schema=public`）。
  - `CORS_ORIGIN`：`https://snookerhk.live,http://localhost:5173,http://localhost:8080`
  - 可選：`SOCKET_IO_PATH`（預設 `/socket.io`）、`ENV_AUDIT_ENABLED=true`（如需關閉可設為 `false`）。

重部署流程
1) 在 Railway 後端服務頁更新上述設定與變數。
2) 清除快取（Clear cache），執行 Redeploy。
3) 於 Deploy Logs 確認：
   - `prisma generate` 執行成功。
   - 出現 `listening on 0.0.0.0:`（平台注入的 `PORT`）。

驗證（完成部署後）
- 瀏覽器直接打開（不受 CORS 限制）：
  - `https://snookerhk.live/health`
  - `https://snookerhk.live/health/db`
  - `https://snookerhk.live/admin/overview?token=wwww5678`
- Windows PowerShell（位於本專案 scripts）：
  - `& .\snooker-standalone\scripts\ops-verify.ps1 -BackendCustomUrl "https://snookerhk.live" -AdminToken "wwww5678"`
  - （如需同時檢查 Railway 子網域）`& .\snooker-standalone\scripts\ops-verify.ps1 -BackendSubdomainUrl "https://<你的後端>.up.railway.app" -BackendCustomUrl "https://snookerhk.live" -AdminToken "wwww5678"`
- 成功標準：所有健康端點 `200 OK`，無 `X-Railway-Fallback`；Admin 概覽返回 JSON 並顯示 `db.status: ok`。

常見故障與快速修復
- `X-Railway-Fallback: true` 或 404：
  - 檢查 `Root=backend`、`Build/Start` 指令是否正確、是否使用 Node 20。
  - 重新部署並確認 Logs 有 `node dist/index.js` 與 `listening on 0.0.0.0:`。
- Prisma/DB 錯誤：
  - 確保 `backend/prisma/schema.prisma` 存在並成功 `prisma generate`。
  - `DATABASE_URL` 指向可達的 Postgres，測試 `GET /health/db` 應為 200。
- CORS 錯誤（前端 fetch 失敗）：
  - 將所有前端公開網址加入 `CORS_ORIGIN`（多域用逗號分隔）。

Socket.IO 反向代理（Nginx）
- 若前端在 Nginx 背後，需啟用 WebSocket 升級並代理到後端：
```
location /socket.io/ {
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_http_version 1.1;
  proxy_pass https://snookerhk.live/socket.io/; # 或後端服務 URL
}
```
- 保持 SPA fallback 將非實體檔案請求導向 `index.html`；避免將 `/test` 代理回前端造成自我回圈。

前端 `/test` 部署與驗收
- 採用靜態檔案模式：
  - 確保存在 `frontend/public/test/index.html`（已建立）。
  - 執行 `npm run build` 後，檢查 `frontend/dist/test/index.html` 是否存在。
  - 部署時將 `dist/` 内容放到前端 Nginx 的 `/usr/share/nginx/html`，保持 `test/` 目錄結構。
- 或改用後端 `/test` 路由（在 `backend/index.ts`）：
  - 確保前端 Nginx 未攔截 `/test` 導致回圈；必要時移除對 `/test` 的代理規則，讓請求直達後端。
- 驗收：
  - `https://snookerhk.live/test` 正常顯示目錄版測試頁。
  - 若使用後端路由，`https://snookerhk.live/test` 返回後端提供的測試頁內容。

人工實測清單（線上）
- 後端：`/health`、`/health/db`、`/admin/overview?token=wwww5678` 均為 `200`。
- Socket：`/socket.io/?EIO=4&transport=polling` 握手返回 200/開局 JSON。
- 前端：`/test` 可用，Admin 入口可透過直接開啟方式查看（不受 CORS）。

交付說明
- 本手冊已根據本專案與域名 `snookerhk.live` 客製化；完成上述設定與重部署後，請回報驗證結果，我可再進一步協助追蹤故障或優化設定。