# snooker-standalone 現階段進程（AI 交接檔）

更新日期：2026-06-29（Asia/Hong_Kong）

## 專案定位

SnookerHK Live 系統（與賽馬無關）。用語請避免「跑馬燈」等賽馬相關字眼，統一使用「全站公告／公告／通知」。

## 技術棧與結構

- Backend：Node.js + TypeScript (ESM) + Express + Prisma + PostgreSQL + Socket.io
- Frontend：React + Vite + TypeScript + Tailwind（自訂 cue-* / brand-* CSS variables 設計系統）
- Repo root：
  - `backend/` 後端 API + Prisma schema/migrations
  - `frontend/` 前端 SPA
  - `bun-service/` 額外服務（目前主流程以 frontend/backend 為主）

## 核心概念（已確認需求）

- 比賽（Match）用作即時/房間輔助，不做歷史儲存主依賴
- 「單杆紀錄 / 榜單 / 月累計」為獨立資料模型（場館手動輸入）
- 會員註冊後即時可用（Google-first）
- 場館帳號採同一 `Member` 表（role=ADMIN）但獨立入口/權限（access_expires_at）
- 單杆紀錄會員/場館不可刪改，superadmin 可刪改（soft delete / patch）
- 支援日/夜模式，手機優先 UI

## 已確認的新需求規則（2026-06-29）

- 功能上落架（收費模組）：採「全站總開關」，由 Super admin 後台控制（計分/直播亦需可切換）
- 消費積分：
  - 「積分與金額兌換規則」由每個場館自訂
  - 目標：場館可編輯規則並可用積分扣減台費
- 起鐘計費粒度：每 X 分鐘進位（X 由場館自訂）
- 掃碼流程：會員掃碼開始後，結束支援「會員/場館」兩端；會員每次掃碼需 2 次確認

## 權限與驗證方式

- 會員/一般 API：以 request header `x-member-id` 作身份識別（前端由 localStorage `memberSession` 提供）
- 場館管理：`requireClubAdmin`（member.role=ADMIN + access_expires_at 未過期）
- Superadmin：`ADMIN_TOKEN`
  - 方式：header `x-admin-token` 或 query `?token=...`
  - 由 `backend/index.ts` 的 `adminAuth` middleware 驗證

## 重要資料表（Prisma）

- `Member`：會員/場館帳號（role、is_enabled、access_expires_at）
- `ClubProfile`：場館資料（memberId 1:1）
- `BreakRecord`：單杆紀錄（points/recorded_at/video_url/soft delete 欄位）
- `TableReservation`：預約（含 status，並支援封鎖時段 BLOCKED）
- `LiveAnnouncement`：場館直播通告（並同步推送 ClubMessage）
- `SiteNotice`：全站公告（文字 + 可選 youtubeEmbedUrl）

對應 schema：`backend/prisma/schema.prisma`

## 最新階段性交付（已推送到 GitHub main）

commit：`bbcceed`（feat: add homepage + site notice + global leaderboards）

### 前端：真正主頁（/）

原本 `/` 會 redirect 去 `/members/login`，現已改為真正主頁頁面：

- 檔案：
  - `frontend/src/HomePage.tsx`
  - `frontend/src/App.tsx`（`/` route 指向 `<HomePage />`）
- 主頁包含：
  - 全站公告（文字）+ 可選 YouTube embed
  - 場館搜尋（關鍵字）+ 場館列表
  - 全站龍虎榜（會員/場館：歷史最高單杆 + 本月累計）
  - 各球館直播排程（public live announcements）
  - 會員登入 / 場館登入入口
- YouTube embed 安全限制：
  - 只接受 `https://www.youtube.com/embed/...`

### 前端：superadmin 編輯「全站公告」

已加入到 `frontend/src/AdminOverview.tsx`（路由 `/admin/overview`）：

- 讀取：`GET /api/site/notice`
- 更新：`PUT /api/admin/site/notice`（帶 `?token=` 同時亦會帶 `x-admin-token` header）

### 後端：新增/補齊 API

#### Public 場館 list/search

- `GET /api/club/public?q=&limit=`
- 位置：`backend/routes/club.ts`
- 會過濾：
  - 場館 member.role=ADMIN
  - member.is_enabled=true
  - access_expires_at 仍有效（或為 null）

#### 全站龍虎榜（public）

- 會員：
  - `GET /api/leaderboard/members/highest?limit=`
  - `GET /api/leaderboard/members/monthly?month=YYYY-MM&limit=`
- 場館：
  - `GET /api/leaderboard/clubs/highest?limit=`
  - `GET /api/leaderboard/clubs/monthly?month=YYYY-MM&limit=`

位置：`backend/index.ts`

### DB migration

- 已提交 `SiteNotice` migration：`backend/prisma/migrations/20260625000002_add_site_notice/`
- Railway 建議使用 `start:migrate` 或執行 `prisma migrate deploy` 以確保 production DB 有該 table

## 已落地但要記住的功能點（之前已完成）

- 公開場館頁（`/club/:clubId`）已支援：
  - 加入場館（刷新後會正確顯示已加入）
  - 場館「歷史最高單杆榜」+「本月累計榜」
  - 波鐘計算機（TimeFeeCalculator）
- 場館後台（`/venue/dashboard`）已支援：
  - 入會 QR code 產生/顯示修復
  - 手動預約 + 封鎖時段（BLOCKED reservation）
  - 管理直播通告（create/list/delete）
- 會員頁（`/member/:id`）已支援：
  - 單杆 video_url clickable
  - 場館訊息內容 linkify（可直接點直播連結）

## 線上檢收建議（Railway）

- Frontend：檢查 `https://www.snookerhk.live/` 是否已顯示主頁（不再直去 login）
- Backend：
  - 若 production DB 尚未有 `SiteNotice`：需跑 migration deploy
  - Backend Base URL：`https://api.snookerhk.live`
  - 檢查 `GET https://api.snookerhk.live/api/site/notice` 是否返回資料
  - 健康檢查：`https://api.snookerhk.live/health`、`https://api.snookerhk.live/health/db`

## 下一步候選清單（未必已確認，供後續 AI 對齊）

- 主頁 UI 微調（版面、排序、空狀態、手機可讀性）
- 場館搜尋：目前先做關鍵字；如需要可再加「區域」等維度（要先定義資料欄位/來源）
- 龍虎榜：如需要顯示更多欄位（會員編號、場館 logo），可調整 API response 或前端呈現
- 公告：如需多則公告、排程生效時間、歷史紀錄，需擴展 `SiteNotice` model
- 下一階段（可行報告 + 排程）：見 `NEXT_PHASE_FEASIBILITY_AND_ROADMAP.md`

## 最新已完成：Phase 0（全站功能上落架 / Feature Flags）

目標：每一項功能可由 Super admin 決定是否上線，方便之後逐項收費；同時保留現有計分/直播但加入上落架選項。

### DB（Prisma）

- 新增 `FeatureFlag` table（key/enabled/createdAt/updatedAt）
- 檔案：
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/20260629000000_add_feature_flags/migration.sql`

預置 keys（可按需要再加）：

- `booking`（會員預約）
- `qr_session`（掃碼起鐘及結算）
- `points`（消費積分）
- `highbreak`（單杆統計及排名）
- `tournaments`（比賽報名入口）
- `club_messages`（球會訊息）
- `club_dashboard`（球會主頁管理）
- `system_portal`（系統主頁）
- `member_portal`（會員主頁）
- `scoring`（計分）
- `live`（直播）

### 後端（強制封鎖，非只隱藏 UI）

- Public read：`GET /api/features`
- Admin 管理：
  - `GET /api/admin/features`（需 `ADMIN_TOKEN`：header `x-admin-token` 或 query `?token=`）
  - `PUT /api/admin/features`（批量 updates）
- 位置：`backend/index.ts`
- 已套用封鎖範圍（關閉後會回 `403 { error:'feature_disabled' }`）：
  - `scoring`：`/api/matches*`、`/api/rooms*`、`/rooms/:roomId/*`、`/api/match-verification-code` 等主要計分 API
- 場館模組封鎖：
  - 位置：`backend/routes/club.ts`
  - `booking`：tables/pricing/reservations
  - `highbreak`：breaks/leaderboard
  - `live`：live-announcements
  - `club_messages`：messages/broadcast

### 前端

- Feature flags 讀取/快取（10 秒 TTL + localStorage fallback）：
  - `frontend/src/lib/features.ts`
- 路由閘口（FeatureGate：未開通會導回 `/`）：
  - `frontend/src/App.tsx`
  - 已套用：`/room/*`（scoring/live）、`/rooms`（scoring）、`/me`（member_portal）、`/venue/dashboard`（club_dashboard）、`/admin/breaks`（highbreak）、`/admin/matches`（scoring）
- Super admin UI：
  - `frontend/src/AdminOverview.tsx` 加入「功能上落架」區塊
  - 透過 `frontend/src/lib/api.ts` 新增 `getAdminFeatures/updateAdminFeatures`

### Build 狀態

- `backend npm run build` 已通過
- `frontend npm run build` 已通過

## Phase 1（消費積分核心，為掃碼結算作前置）

### 已完成（2026-06-29）

1) 資料模型（Prisma migration）
- `ClubPointsConfig`：每場館自訂（貨幣代碼、兌換、每 X 分鐘進位、最低計費分鐘）
- `PointsLedger`：積分流水
- `PointsBalance`：會員餘額快取（避免每次聚合 ledger）
- migration：`backend/prisma/migrations/20260629000001_add_points_core/migration.sql`

2) 後端 API（受 `points` feature flag 控制）
- 位置：`backend/routes/club.ts`
- `GET /api/club/points/config`
- `PUT /api/club/points/config`
- `GET /api/club/points/balances`
- `GET /api/club/points/ledger?limit=50`
- `POST /api/club/points/adjust`（場館手動加減分）

3) 場館後台 UI（受 `points` feature flag 控制）
- 位置：`frontend/src/VenueDashboard.tsx`
- 內容：積分設定、會員加減分、餘額列表、最近 50 筆流水

### 尚未完成（留待下一步）

- 會員主頁顯示個人積分（按球會 filter、查看流水）
- Phase 2 掃碼結算接入：結算時計費→換算扣分→寫入 PointsLedger/Balance（並需二次確認流程）

## Phase 2（掃碼起鐘 / 落鐘 / 自動結算）

### 已完成（2026-06-29）

1) 資料模型（Prisma migration）
- `TableQrToken`：每張枱一個 token（可 rotate），用於生成 QR
- `TableSession`：台鐘 session（起鐘/落鐘、結算結果、扣分紀錄 id）
- `TableSessionConfirm`：二次確認用（START/END，2 分鐘有效）
- migration：`backend/prisma/migrations/20260629000002_add_table_sessions_qr/migration.sql`

2) 後端 API
- 會員掃碼（受 `qr_session` 控制；扣分同時受 `points` 控制）
  - `GET /api/qr/table/info?token=...`
  - `POST /api/qr/table/start-init` → `POST /api/qr/table/start-confirm`
  - `POST /api/qr/table/end-init` → `POST /api/qr/table/end-confirm`
- 場館後台（受 `qr_session` 控制）
  - `POST /api/club/tables/:id/qr/rotate`
  - `GET /api/club/sessions/active`
  - `POST /api/club/sessions/:id/end`（場館落鐘＋結算）

3) 前端 UI
- 會員掃碼頁：`/qr/table/:token`（二次確認起鐘/落鐘）
  - 檔案：`frontend/src/TableQrPage.tsx`
  - 未登入會導去 `/members/login?next=/qr/table/:token`
- 場館後台：
  - 球枱列表顯示 QR、複製連結、可「更換 QR」
  - 顯示「進行中台鐘」列表與「落鐘」
  - 檔案：`frontend/src/VenueDashboard.tsx`

### 部署備註（Railway / Production）

- 常用域名：Frontend `https://snookerhk.live`；Backend `https://api.snookerhk.live`
- Prisma migration 故障處理（P3009）：
  - 事故：`20260629000002_add_table_sessions_qr` 曾在 production DB 失敗，導致 `prisma migrate deploy` 之後每次都會因 P3009 停止啟動。
  - 根因：Postgres 不支援 `CREATE TYPE IF NOT EXISTS ...`（enum），已改為 `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` 並推送到 main。
  - 修復步驟：在 Railway DB 的 Database 頁面執行 SQL，將 `_prisma_migrations` 中該 migration 標記為 rolled back（`rolled_back_at`/`finished_at`），之後 redeploy backend 重新 apply 修正版 migration。
  - 狀態：已於 2026-06-29 在 Railway 上完成修正，backend 可正常 redeploy。

### 驗收連結（分站）

- Backend：
  - `https://api.snookerhk.live/health`
  - `https://api.snookerhk.live/api/features`
- Frontend：
  - 場館後台：`https://snookerhk.live/venue/dashboard`
  - 掃碼頁：`https://snookerhk.live/qr/table/<token>`

## 本機開發（快速提示）

- backend：
  - `npm i`
  - `npm run build`
  - `npm run start` 或 `npm run start:migrate`
- frontend：
  - `npm i`
  - `npm run dev` / `npm run build`
