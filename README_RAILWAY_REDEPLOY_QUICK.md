# Railway 重部署一鍵快查清單（極簡版）

目標：讓後端服務在 Railway 以正確 Dockerfile（Node 20、在 `npm ci` 前複製 `prisma/**`、安裝 `openssl`）建置並啟動，避免 `EBADENGINE`、`Prisma schema not found` 與 `X-Railway-Fallback`。

## 1. 指向正確的 Dockerfile
- 進入 Railway 專案 → 選擇你的 Backend 服務。
- 開啟 `Settings → Build`。
- Builder：選 `Dockerfile`。
- Dockerfile 路徑二擇一（推薦第一個）：
  - `backend/Dockerfile`
  - 專案根目錄的 `Dockerfile`（此檔僅建置 `./backend`，並已鎖 Node 20、先複製 prisma）

注意：不要在 Variables 手動設定 `PORT`（Railway 會自動注入）。程式端已使用 `process.env.PORT || 3000`。

## 2. 設定必要變數
- 開啟 `Settings → Variables`，新增或確認：
  - `DATABASE_URL`：Railway Postgres 的連線字串（於 DB 服務的 `Settings → Connect` 複製）。
  - `CORS_ORIGIN`：前端公開網址，支援多域以逗號分隔，例如：`https://snookerhk.live,https://www.snookerhk.live`。
  - 可選：`ADMIN_TOKEN`（管理入口保護）。

## 3. 清理快取並重部署
- 在服務頁面 `Deployments` 或 `Settings`：
  - `Stop`（若正在執行）→ `Clear cache`（若 UI 有）→ `Redeploy`。

### 找不到 Stop / Clear cache / Redeploy？（替代點選路徑）
- 進入你的 Backend 服務頁後，嘗試以下任一路徑：
  - 路徑 A（最常見）：左側選單點 `Deployments` → 在最新一筆部署卡片上，按 `Redeploy`（或 `Re-deploy`）。
  - 路徑 B：左側選單點 `Build` → 按 `Trigger Deploy`（有些 UI 版本此處提供觸發重建）。
  - 路徑 C：頁面右上角的 `...`（Actions 或更多）選單 → 找 `Redeploy` 或 `Restart`。
  - 路徑 D：`Settings → Build` 區塊 → 若看得到 `Clear cache` 按鈕，先按一次再 `Trigger Deploy` 或回到 `Deployments` 做 `Redeploy`。
- 說明：
  - `Stop` 並非所有服務都會顯示；若沒有 `Stop`，直接使用 `Redeploy` 或 `Trigger Deploy` 即可。
  - `Clear cache` 在部分 UI 或方案下不顯示；若沒有，仍可 `Redeploy`，通常在你已改用 `node:20*` 的 Dockerfile 後，平台會拉取新基底鏡像並重建依賴。
  - 若仍懷疑使用到舊快取，可於 `Settings → Build` 先把 Dockerfile Path 切到根 `Dockerfile` 按 `Save`，再切回 `backend/Dockerfile` 按 `Save`，最後 `Deployments → Redeploy`（此為觸發重建的替代手法）。

## 4. 建置日誌檢查（必看）
在 Deploy Logs 逐條確認：
- 基底鏡像為 `node:20*`（非 18）。
- 在 `npm ci` 前有 `COPY prisma/**`，並且 `postinstall` 有執行 `prisma generate`，無 `Could not find Prisma Schema` 或 `libssl` 相關錯誤。
- 最終啟動輸出有 `Listening on 0.0.0.0:<PORT>`（`<PORT>` 為 Railway 注入）。

## 5. 綁定自訂網域（如有）
- 開啟 `Settings → Domains`，綁定 `snookerhk.live`（如需 `www` 一併綁定）。
- 依 UI 顯示的 DNS 指示建立記錄（根域可能需要 CNAME flattening 或平台提供的 A/AAAA）。
- 等待憑證簽發完成（顯示 Active/綠色鎖）。

## 6. 一鍵驗證指令（Windows PowerShell）
子網域：
```
curl.exe -i -v https://snooker-standalone-backend-production.up.railway.app/health
curl.exe -i https://snooker-standalone-backend-production.up.railway.app/health/db
curl.exe -i https://snooker-standalone-backend-production.up.railway.app/admin/overview -H "x-admin-token: wwww5678"
```

自訂網域（憑證完成後）：
```
curl.exe -i -v https://snookerhk.live/health
```

也可直接執行腳本：
```
& .\snooker-standalone\scripts\verify-backend.ps1 -BackendUrl "https://<你的後端>.up.railway.app"
& .\snooker-standalone\scripts\ops-verify.ps1 -BackendSubdomainUrl "https://<你的後端>.up.railway.app" -BackendCustomUrl "https://snookerhk.live"
```

成功標準：所有健康端點 `200 OK`，無 `X-Railway-Fallback`；Socket 探測不再連線錯誤。

## 7. 常見錯誤與快速修復
- `EBADENGINE Unsupported engine`：基底應使用 `node:20*`，非 18。
- `Prisma schema not found`：在 `npm ci` 前需先 `COPY prisma/**`；並安裝 `openssl`。
- `X-Railway-Fallback: true` 或 `404 Application not found`：服務尚未啟動或路由未指向正確應用；檢查 Builder、Dockerfile 路徑、Build/Start 指令與變數、並重部署。

### Prisma 建置錯誤快速修復（schema 與 OpenSSL）
若在 Deploy Logs 看到：

```
Prisma failed to detect libssl... Defaulting to openssl-1.1.x
Error: Could not find Prisma Schema that is required for this command.
Checked following paths: prisma/schema.prisma: file not found
```

請確認 Dockerfile 的「建置順序」如下（關鍵：在 `npm ci` 前先複製 `prisma/**`，並安裝 `openssl`）：

```
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# 先複製 Prisma schema，讓 postinstall 能找到
COPY prisma ./prisma
COPY tsconfig.json ./
# Prisma 需要 OpenSSL
RUN apk add --no-cache openssl
# 安裝依賴（此時 postinstall -> prisma generate 能成功）
RUN npm ci
# 之後再複製其餘原始碼並建置
COPY . .
RUN npm run build
```

> 你的專案已在 `backend/package.json` 設定 `"prisma": { "schema": "./prisma/schema.prisma" }`，以及 `postinstall: prisma generate`、`prestart: prisma generate`。只要 Dockerfile 的複製順序正確，`prisma generate` 便會成功。

若 Railway 仍拉到舊的 Dockerfile（例如在 `COPY . .` 之後才出現 `npm ci`）：
- 於 `Settings → Build` 確認 `Builder=Dockerfile` 且 Path 指向 `backend/Dockerfile`。
- 嘗試「切到根 `Dockerfile` → Save → 切回 `backend/Dockerfile` → Save」，再到 `Deployments → Redeploy`，以強制重新解析路徑並清除舊快取。
- 若 UI 提供 `Clear cache`，先清快取再 `Redeploy`。

更多關於 Prisma schema 位置的說明，請參考官方文件（包含 `--schema`、`package.json prisma.schema` 等配置方式）：
https://pris.ly/d/prisma-schema-location