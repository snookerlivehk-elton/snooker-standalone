# 專案現狀摘要（Project Status Summary）

更新日期：2026-07-16（Asia/Hong_Kong）

## 1. 這份文件的用途

- 這是一份給「新任務 / 新對話 / 新接手者」使用的快速交接文件。
- 目標是用最少上下文，說清楚目前專案已完成什麼、核心檔案在哪裡、正在進行什麼、下一步原本打算做什麼。
- 這份文件不取代：
  - `README.md`：環境與啟動
  - `PROJECT_PROGRESS.md`：完整時序開發日誌
  - 各類 blueprint / checklist：設計背景與規則定義

## 2. 專案定位

- 專案名稱：`snooker-standalone`
- 產品定位：桌球場館營運與會員平台
- 主要角色：
  - `Super Admin`
  - `Venue Admin`
  - `Member`
  - `Public Visitor`
- 主站網域：
  - 前端：`https://snookerhk.live`
  - 後端：`https://api.snookerhk.live`

## 3. 技術棧與整體架構

- Frontend：
  - React
  - TypeScript
  - Vite
  - Tailwind + 自訂品牌樣式
- Backend：
  - Node.js
  - TypeScript
  - Express
  - Prisma
  - PostgreSQL
- Repo 主要目錄：
  - `frontend/`：前端 SPA
  - `backend/`：後端 API、Prisma schema/migrations
  - `bun-service/`：額外服務，非目前主流程核心
  - `.github/workflows/`：CI / deploy workflow

## 4. 目前已完成的主要功能

### 4.1 基礎平台與模組中心

- 已完成模組化單體（modular monolith）方向的第一輪落地。
- `Super Admin` 已有模組中心，可控制：
  - 全局啟用
  - 公開可見
  - 首頁可見
  - 是否允許場館啟用
- `Venue Admin` 已有模組中心與獨立模組管理頁。
- 已完成的模組設定頁包括：
  - `booking`
  - `tournaments`
  - `points`
  - `club_messages`
  - `live`
  - `members`

### 4.2 會員系統

- 已支援：
  - Email 註冊 / 登入
  - 手機註冊 / 登入
  - Google 登入
  - Email 驗證
  - `BASIC / VERIFIED` 會員分層
- `booking.create` 與 `tournament.signup` 已可受會員層級控制。
- 會員中心已可顯示：
  - 會員層級
  - email 驗證狀態
  - resend verification

### 4.3 場館模組

- `Venue Dashboard` 已拆成較清晰的模組頁面。
- 已抽離或強化的場館模組包括：
  - `VenueMembersModule`
  - `VenueLiveModule`
  - `VenueClubMessagesModule`
  - `VenuePointsModule`
  - `VenueHighbreakModule`
  - `VenueTournamentsModule`
- 場館後台已可管理：
  - 會員
  - 直播公告
  - 場館訊息
  - 消費積分
  - Highbreak
  - 賽事

### 4.4 Booking / Points / QR Session / Settlement

- 已完成場館預約（booking）主流程。
- 已完成 booking email 通知第一版。
- 已完成 points 核心資料模型與場館管理操作。
- 已完成 QR 台鐘掃碼起鐘 / 落鐘流程。
- 已完成 `qr-session -> settlement -> points` 二段式結算主線。
- `frontend/src/TableQrPage.tsx` 已接 settlement quote + confirm 流程。

### 4.5 Highbreak 與會員履歷

- 已完成 `BreakRecord.record_type = VENUE | TOURNAMENT` 的資料分流。
- 已完成 unified highbreak 查詢來源與 `minPoints` 支援。
- 已完成：
  - `20+ / 30+ / 40+ / 50+` 門檻切換
  - `ALL / VENUE / TOURNAMENT` scope 切換
  - 影片補錄 / 編輯
- 會員頁、場館頁、首頁排行榜都已支援動態門檻與 scope。

### 4.6 Tournament 主線

- `tournaments` 已從報名工具升級為場館賽事工作台。
- 已支援：
  - `Knockout`
  - `League`
- 已完成：
  - 報名 -> 正式參賽名單
  - seed mode（`MANUAL / RANKING / RANDOM`）
  - Knockout 賽程生成
  - League round-robin
  - frame 級記分
  - tournament `20+` 紀錄
  - 工作台可用性與流程引導優化
  - 列印 / PDF 匯出
- 已加入 `Method Z` 測試工具與權限閘。

### 4.7 Public / Homepage / Club Public

- `/home` 已改成模組驅動首頁。
- `ClubPublicPage` 已完成多輪結構拆分與可用性優化。
- 公開頁 tournament 相關已完成：
  - 詳情 modal 拆分
  - participant lookup / detail / directory 分離
  - live board shell 分離
  - 海報預覽 / lightbox

## 5. 海報與賽況展示目前已完成的成果

### 5.1 分享海報引擎

- 核心不是第三方插件，而是前端自製的 Canvas renderer。
- 核心檔案：
  - `frontend/src/venue/modules/TournamentShareCards.ts`
- 已支援：
  - 聯賽海報
  - 淘汰賽海報
  - 場館名稱 / 頭像 / 品牌 Logo
  - 高 DPI 預覽與下載
  - 公開頁與後台共用同一套產圖邏輯

### 5.2 視覺與版型規則

- 聯賽海報維持直向。
- 淘汰賽海報改為橫向 `1920x1080`。
- 公開頁與後台的海報展示已經過多輪對齊修正。
- 已加入 lightbox 放大檢視與多張切換。

### 5.3 大型淘汰賽處理

- 64 人或以上的大型淘汰賽，已改為：
  - 多張初期分組海報
  - 一張後段總覽海報
- 公開頁與後台均已支援多張預覽與切換。

## 6. 金銀杯（Gold / Silver Cup）目前狀態

### 6.1 已完成

- 已新增賽制 `GOLD_SILVER_CUP`。
- 已完成後端雙 bracket 生成主線：
  - `GOLD_MAIN`
  - `GOLD_THIRD_PLACE`
  - `SILVER_QUALIFIER`
  - `SILVER_MAIN`
  - `SILVER_THIRD_PLACE`
- 已支援非 `2^n` 人數：
  - 金杯高 seed bye
  - 銀杯局部 bye / 部分直接晉級
- 已完成後台雙分區工作台：
  - `金杯進級表`
  - `銀杯進級表`
- 已完成前端 podium summary：
  - `金杯三甲`
  - `銀杯三甲`
- 已完成公開頁輪次 label / 雙 bracket / podium 基本展示。
- 已完成金銀杯海報與大規模海報拆分的多輪修正。

### 6.2 最近已完成且已在 `main`

- `9cf10ec`
  - refined grouped gold silver cup posters
- `662ff32`
  - align gold silver cup poster previews
- `752de43`
  - split oversized silver cup share posters

### 6.3 仍需持續驗證

- 大型 `64+` 金銀杯不同輪次下的海報閱讀性仍值得持續實測。
- 金 / 銀杯的最終海報分組策略雖已多輪修正，但仍應用真實賽例再驗證。

## 7. WhatsApp OTP 註冊目前狀態

### 7.1 已在本機完成但尚未提交

- 已新增 Prisma model：
  - `PhoneVerification`
- 已新增 migration：
  - `backend/prisma/migrations/20260716000000_add_phone_verification_table/`
- 已新增 WhatsApp 發碼 helper：
  - `backend/src/core/notifications/whatsapp.ts`
- 已新增後端 API：
  - `POST /api/members/request-whatsapp-register-code`
  - `POST /api/members/register-with-whatsapp-code`
- 已擴充 members module settings：
  - `whatsappOtpEnabled`
- 已在前端會員註冊頁加入：
  - `WhatsApp 註冊` tab
- 已新增前端 API wrapper：
  - `requestRegisterWhatsappCode()`
  - `registerMemberWithWhatsappCode()`

### 7.2 目前尚未完成

- 這批 WhatsApp OTP 改動**仍在本機工作樹，尚未 commit / push**。
- migration 也**尚未正式 deploy 到資料庫**。
- 正式發送仍依賴外部 Meta 設定：
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_OTP_TEMPLATE_NAME`
  - 可選 `WHATSAPP_OTP_TEMPLATE_LANG`

### 7.3 Meta 外部狀態

- 已確認可以進入 WhatsApp Business / Developer App 流程。
- 已完成：
  - 電話號碼註冊
  - 付款方式新增
  - 訊息範本建立流程
- 商家驗證仍顯示處理中。
- 仍需最終確認：
  - 正式 WABA vs Test WABA
  - `Access Token`
  - `Phone Number ID`
  - OTP template 名稱與狀態

## 8. 目前核心檔案與資料夾

### 8.1 Repo Root

- `README.md`
  - 環境設定與啟動說明
- `PROJECT_PROGRESS.md`
  - 大型 chronological 開發日誌
- `PROJECT_STATUS_SUMMARY.md`
  - 本文件，交接入口
- `CHANGELOG.md`
  - notable changes，但目前不是最完整的最新狀態來源

### 8.2 Backend 核心

- `backend/prisma/schema.prisma`
  - 所有核心資料模型
- `backend/prisma/migrations/`
  - migration 歷史
- `backend/index.ts`
  - system composition / bootstrap
- `backend/routes/club.ts`
  - club gateway route composition
- `backend/src/plugins/`
  - 各模組 router / service / repository
- `backend/src/core/modules/`
  - module registry / module settings / config
- `backend/src/core/notifications/`
  - email / whatsapp

### 8.3 Frontend 核心

- `frontend/src/App.tsx`
  - route 與入口閘口
- `frontend/src/HomePage.tsx`
  - 系統首頁
- `frontend/src/ClubPublicPage.tsx`
  - 場館公開頁
- `frontend/src/MemberRegister.tsx`
  - 會員註冊頁，含最新 WhatsApp 註冊本機改動
- `frontend/src/lib/api.ts`
  - 前端 API wrapper
- `frontend/src/venue/modules/`
  - 場館模組主體
- `frontend/src/club-public/tournaments/`
  - 公開賽事展示與海報 preview 相關元件

### 8.4 Tournament / Poster 核心檔案

- `frontend/src/venue/modules/TournamentShareCards.ts`
  - 海報核心 renderer / preview plan
- `frontend/src/venue/modules/useTournamentStageViewData.ts`
  - stage label / bracket columns / podium summary
- `frontend/src/lib/tournamentPodium.ts`
  - 一般淘汰賽與金銀杯 podium 邏輯
- `frontend/src/club-public/tournaments/publicTournamentPosterHelpers.ts`
  - 公開頁海報資料組裝
- `frontend/src/components/TournamentPosterLightbox.tsx`
  - 共用海報燈箱

## 9. 目前工作樹狀態（重要）

目前 `main` HEAD 為：

- `68ec7a5`
  - `Revert "feat: render public tournament posters with html"`

也就是說：

- **公開頁 HTML/CSS 直接海報化的 commit 已被回退**
- 現在遠端 `main` 的穩定狀態，仍以 **Canvas 海報 + preview/lightbox** 為主

但目前本機工作樹仍有未提交修改，主要包括：

- Backend
  - `backend/prisma/schema.prisma`
  - `backend/src/core/modules/adminModuleSettings.ts`
  - `backend/src/core/modules/membersSettings.ts`
  - `backend/src/plugins/members/router.ts`
  - `backend/src/core/notifications/whatsapp.ts`（新檔）
  - `backend/prisma/migrations/20260716000000_add_phone_verification_table/`（新檔）
- Frontend
  - `frontend/src/MemberRegister.tsx`
  - `frontend/src/lib/api.ts`
  - `frontend/src/club-public/tournaments/ClubPublicTournamentLiveBoard.tsx`
  - `frontend/src/club-public/tournaments/ClubPublicTournamentLiveBoardCard.tsx`
  - `frontend/src/club-public/tournaments/publicTournamentPosterHelpers.ts`
  - `frontend/src/venue/modules/TournamentShareCards.ts`
- 其他
  - `TOURNAMENT_DISPLAY_SHARE_BLUEPRINT.md`（未追蹤 / 本機版本）
  - `backend/dist/*`
  - `frontend/dist/index.html`

## 10. 目前正在進行、尚未完成的功能

### 10.1 WhatsApp OTP 註冊

- 已做到本機可接線階段，但未完成正式提交與部署。
- 尚未完成正式 Meta token / phone number id / template 接入。
- 尚未做 webhook / 雙向互動。

### 10.2 金銀杯海報持續驗證

- 核心邏輯已大致落地。
- 但大型真實賽例仍值得持續驗證：
  - 金杯 / 銀杯分組清晰度
  - 後段總覽資訊密度
  - 不同人數下分組策略

### 10.3 文件整理

- `README.md` 目前偏環境說明，不是接手文件。
- `PROJECT_PROGRESS.md` 很完整，但已過長，不適合作為第一入口。
- `CHANGELOG.md` 有價值，但目前混有較舊階段與未完整對齊最新 7 月狀態。

## 11. 下一步原本計劃要做什麼

若從產品 / 開發連續性來看，原本最自然的下一步是：

### 優先級 P1

- 完成 WhatsApp OTP 註冊這一批：
  - 檢查本機未提交修改
  - 跑 build / diagnostics
  - 乾淨 commit
  - deploy migration
  - 接正式 Meta env

### 優先級 P1

- 進一步把 WhatsApp 從「註冊」延伸到：
  - OTP 登入
  - 通知
  - webhook
  - 關鍵字互動

### 優先級 P2

- 繼續驗證 / 微調金銀杯大型海報
- 補更多實賽 case 測試與 checklist

### 優先級 P2

- 視需要重新評估「公開頁 HTML 海報化」
- 這方向曾做過實驗並已回退，不應直接當成目前穩定功能

## 12. 文件整理建議（是否需要合併）

目前**不建議**把所有 `.md` 直接合併成單一超大文件，因為用途不同：

- 保留：
  - `README.md`
    - 作為環境與啟動入口
  - `PROJECT_PROGRESS.md`
    - 作為歷史開發日誌
  - 各 blueprint / checklist
    - 作為設計背景與規則依據
- 新增：
  - `PROJECT_STATUS_SUMMARY.md`
    - 作為新任務 / 新對話的第一入口

### 建議後續整理方式

- `README.md`
  - 保持簡潔，只放環境、啟動、部署入口與重要連結
- `PROJECT_PROGRESS.md`
  - 繼續記錄時序開發日誌
- `PROJECT_STATUS_SUMMARY.md`
  - 每完成一批重要功能時更新
- blueprint 類文件
  - 保留，不與狀態摘要混合

## 13. 新開任務時建議先看的文件順序

1. `PROJECT_STATUS_SUMMARY.md`
2. `README.md`
3. `PROJECT_PROGRESS.md`
4. 與當前任務直接相關的 blueprint / checklist，例如：
   - `GOLD_SILVER_CUP_BATCH0_CHECKLIST.md`
   - `TOURNAMENT_DISPLAY_SHARE_BLUEPRINT.md`
   - `TOURNAMENTS_APP_DESIGN.md`

## 14. 給下一個任務的簡短接手提示

- 先確認目前是要接：
  - `WhatsApp OTP 註冊`
  - 還是 `金銀杯海報 / 公開頁展示`
- 若接 WhatsApp：
  - 先檢查本機未提交修改與 migration
  - 再核對 Meta Cloud API 參數
- 若接金銀杯海報：
  - 以 `main` 現狀 + `PROJECT_PROGRESS.md` 近段落為準
  - 再檢查本機 poster 相關未提交檔案是否只是實驗性變更

