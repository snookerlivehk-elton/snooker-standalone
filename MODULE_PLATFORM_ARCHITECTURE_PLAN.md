# Module Platform Architecture Plan

更新日期：2026-06-20（Asia/Hong_Kong）

## 目標

本方案的目標，不是把系統做成可任意安裝第三方外掛的重型 plugin platform，而是把現有系統整理成：

- 模組化單體（modular monolith）
- 帶有模組註冊中心（module registry / manifest）
- 具備全局與場館雙層開關
- 具備模組級資料 ownership
- 具備模組級後台設定頁

這樣可以在不引入過高複雜度的前提下，達成以下需求：

- 各功能可獨立運作
- 各功能所得資料能按會員 / 場館獨立儲存
- Superadmin 可控制全局開放 / 關閉
- 場館可按授權啟用個別模組
- `/home` 與公開頁可依模組狀態動態顯示或隱藏
- 每個模組能有自己的後台管理版面

## 結論

對目前 `snooker-standalone` 最合適的方向是：

- 保持 `modular monolith`
- 補上 `module registry / manifest`
- 建立 `global module config + club module config`
- 讓首頁與後台都改為模組驅動

不建議現在走真正重型插件化，原因如下：

- 系統功能數量有限，沒有第三方插件生態需求
- 所有功能仍共享會員、場館、權限、首頁、後台等核心上下文
- 真正插件化會帶來動態載入、版本兼容、安裝 / 拔除、依賴管理等額外成本
- 目前更需要的是治理清晰，而不是極度動態化

## 核心設計原則

### 1. 功能獨立，但不脫離核心上下文

每個模組應只負責自己的業務與資料，不直接跨模組改寫對方資料表。

建議維持以下責任邊界：

- `booking`：預約
- `qr-session`：起鐘 / 落鐘 / 計時
- `settlement`：交易狀態與支付協調
- `points`：積分換算、餘額、流水
- `tournaments`：比賽
- `highbreak`：單杆與榜單
- `content`：新聞 / 內容
- `live`：直播公告
- `club-messages`：場館訊息

模組之間如有業務交互，應走：

- service contract
- orchestration service
- domain event / outbox

不應直接互相寫表。

### 2. 資料獨立以 ownership 為主，不以多資料庫為目標

現階段最適合的做法不是每個模組分一個 database，而是：

- 同一個 PostgreSQL
- 每個模組有自己的資料表與 repository
- 每筆資料帶清晰 ownership 欄位

建議模組資料表盡量具備：

- `clubId`
- `memberId`（如適用）
- `createdBy`
- `updatedBy`
- `status`
- `createdAt`
- `updatedAt`

這樣已足夠支撐：

- 場館隔離查詢
- 會員個人紀錄查詢
- 模組邏輯邊界
- 後續 audit / reporting

### 3. 開關控制採雙層策略

每個模組應至少有兩層控制：

1. 全局層（Superadmin）
2. 場館層（授權 / 啟用）

判斷規則：

- 若模組被全局關閉：
  - `/home` 不顯示該模組區塊
  - 對應公開頁不顯示
  - 場館後台不顯示
  - API 可直接回傳 disabled / forbidden
- 若模組全局開啟但某場館未授權：
  - 該場館不可使用該模組
  - 該場館資料不可被納入公開聚合內容

## 模組設定模型

建議在現有 feature flag 基礎上，進一步升級為正式模組設定體系。

### A. `SystemModule`

定義系統有哪些模組，例如：

- `booking`
- `qr_session`
- `settlement`
- `points`
- `tournaments`
- `highbreak`
- `content`
- `live`
- `club_messages`

建議欄位：

- `code`
- `name`
- `description`
- `category`
- `isSystem`
- `createdAt`
- `updatedAt`

### B. `SystemModuleConfig`

管理全局設定。

建議欄位：

- `moduleCode`
- `enabledGlobally`
- `publicVisible`
- `homeVisible`
- `allowClubEnable`
- `sortOrder`
- `settingsJson`
- `updatedAt`

### C. `ClubModuleConfig`

管理場館級設定與授權。

建議欄位：

- `clubId`
- `moduleCode`
- `enabledForClub`
- `publicVisible`
- `settingsJson`
- `updatedAt`

### D. 保留既有 `FeatureFlag`

短期內可保留 `FeatureFlag` 作兼容層，逐步把功能上落架責任轉移至模組設定表。

## Module Registry / Manifest

每個模組都應提供自己的 manifest，讓系統知道它具備哪些能力。

建議 manifest 至少包含：

- `code`
- `name`
- `hasPublicRoutes`
- `hasVenueAdminPage`
- `hasSuperAdminPage`
- `supportsHomeSection`
- `supportsClubEnable`
- `defaultGlobalConfig`
- `defaultClubConfig`

可再擴充：

- public route mount info
- admin navigation info
- homepage section provider
- permissions metadata

## `/home` 的模組驅動化規則

首頁不應再手動硬編碼所有版塊，而應改為依模組設定動態組裝。

某模組能否顯示在 `/home`，建議統一依以下條件判斷：

- `enabledGlobally = true`
- `publicVisible = true`
- `homeVisible = true`
- 場館授權有效
- 模組有可公開資料

例如：

- `tournaments` 全局開啟且場館授權有效時：
  - `/home` 顯示近期比賽區塊
  - 比賽分頁可見
- `tournaments` 全局關閉時：
  - `/home` 不顯示
  - 比賽分頁與入口不顯示
  - 該模組公開 API 可封鎖

## 後台架構建議

### 1. Superadmin 後台

建立「模組中心」頁面，按模組管理：

- 全局啟用 / 關閉
- 是否可公開
- 是否出現在首頁
- 是否允許場館啟用
- 模組排序
- 模組全局設定

### 2. Venue Admin 後台

按場館授權後顯示模組入口，每個模組有自己的設定頁。

例如：

- `points`：
  - 兌換率
  - 計費規則
  - 餘額與流水
- `tournaments`：
  - 比賽列表
  - 報名設定
  - 公開顯示設定
- `booking`：
  - 時段設定
  - 預約規則
  - 封鎖時段

### 3. Admin UI 導航

管理後台應由模組自己提供 navigation metadata，而不是把所有設定硬塞進單一大頁。

## Backend 分層建議

保持目前方向，但結構再統一化：

- `manifest.ts`
- `router.ts`
- `service.ts`
- `repository.ts`
- `types.ts`
- `admin/`
- `public/`

核心層建議保留在 `backend/src/core/`：

- auth
- db
- member context
- club context
- permissions
- feature access
- module registry
- homepage composition
- audit / event infrastructure

## 模組之間的互動規則

建議採以下原則：

- 低耦合模組：直接透過 service contract
- 高耦合交易流程：透過 orchestration / settlement 類中介模組
- 重要狀態變更：寫入 outbox，方便後續擴展事件處理

已落地的 `qr-session -> settlement -> points` 可視為後續模組互動樣板。

## 推薦實施次序

下次開始落地時，建議按以下順序做，而不是同時大改所有模組。

### Phase 1：建立模組註冊中心骨架

- 建立 `module registry`
- 為現有模組補上 `manifest`
- 統一模組 metadata

### Phase 2：補模組設定資料表

- 新增 `SystemModule`
- 新增 `SystemModuleConfig`
- 新增 `ClubModuleConfig`
- 保留 `FeatureFlag` 作過渡兼容

### Phase 3：後端 access helper 升級

- 讓 API 能以模組設定判斷全局 / 場館授權
- 逐步取代現有只靠 feature flag 的邏輯

### Phase 4：首頁改成模組驅動

- `/home` 依 registry + config 決定顯示哪些版塊
- 每個模組提供自己的首頁 section provider

### Phase 5：Superadmin / Venue Admin 模組中心

- Superadmin：模組總控台
- Venue admin：模組設定頁入口

### Phase 6：逐模組細化 admin UI

- 先做最重要模組：
  - `tournaments`
  - `points`
  - `booking`
  - `highbreak`

## 不建議事項

現階段不建議：

- 每個模組拆成獨立 database
- 直接走微服務
- 建立可熱插拔第三方插件平台
- 過早追求動態安裝 / 卸載 / 版本相容框架

這些都會大幅增加維護成本，與當前需求不成比例。

## 最終建議摘要

本系統最優做法不是重型插件化，而是：

- 模組化單體
- 模組註冊中心
- 全局 + 場館雙層模組設定
- 模組驅動首頁
- 模組驅動後台
- 模組級資料 ownership

這樣可以在維持開發效率的同時，滿足：

- 功能可獨立運作
- 記錄可按會員 / 場館清晰儲存
- Superadmin 可總控上落架與公開顯示
- 場館可按授權啟用個別模組
- 前台 / 後台管理結構清晰
