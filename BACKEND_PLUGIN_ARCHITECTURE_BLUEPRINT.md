# Backend 插件化重構藍圖

## 1. 目標

本文件針對目前 `backend/index.ts` 與 `backend/routes/club.ts` 的高耦合現況，提出一套可落地的插件化重構方案。

目標不是一步把系統拆成多個微服務，而是先把現有後端重構為：

- 一個穩定的核心層（Core / Kernel）
- 多個可獨立啟用、停用、維護的功能插件（Plugins）
- 每個插件擁有自己的路由、服務、資料表與遷移
- 跨插件互動透過事件或明確 contract，而不是彼此直接寫對方資料

這樣可以讓以下功能逐步分拆出去：

- 會員預約
- 掃碼起鐘及結算
- 消費積分
- 賽事
- 單杆

## 2. 現況判斷

目前 backend 已不是單純的啟動入口，而是大型單體應用：

- `backend/index.ts`
  - 約 `3596` 行
  - 直接承擔約 `72` 個 `app.*` 路由
  - 同時包含啟動、middleware、功能開關、會員、管理後台、排行榜、內容、QR 結算等邏輯
- `backend/routes/club.ts`
  - 約 `2390` 行
  - 直接承擔約 `71` 個 `router.*` 路由
  - 同時包含球會資料、會員管理、積分、賽事、訊息、直播、單杆、球枱、預約等功能

代表性耦合現象：

- QR 起鐘結算直接寫入 `PointsLedger` / `PointsBalance`
- 刪除會員時必須知道 points / tournaments / live / breaks / sessions / reservations 等多個模組的清理方式
- feature gate 同時散落在 `index.ts` 與 `club.ts`
- Prisma schema 以單一全域 schema 承載所有模組

這代表系統已經具備「功能模組」雛形，但仍未形成清晰的插件邊界。

## 3. 結論

### 3.1 可行性

整體方向可行，且建議採用。

可行性評估如下：

- 程式架構插件化：高
- 每個功能有獨立資料表與 migration：高
- 同一資料庫內按模組分區治理：高
- 以開關控制啟用 / 停用功能：高
- 真正做到任意移除某功能且不影響其他功能：中
- 每個功能拆成完全獨立 database 或 service：中

### 3.2 建議策略

最適合的路線不是直接微服務化，而是：

1. 先做模組化單體（Modular Monolith）
2. 再做插件註冊制（Plugin Registry）
3. 最後只把最獨立的模組抽成外部服務

這條路可以保留現有部署與 Prisma 基礎，不會一次把複雜度推高。

## 4. 重構原則

### 4.1 Core 只保留共用能力

核心層只應保留所有插件都依賴的能力：

- `Member`
- `ClubProfile`
- `Auth`
- `AdminAuth`
- `FeatureFlag`
- `ClubFeatureAccess`
- `PluginRegistry`
- `EventBus` / `Outbox`
- 共用的 request context、錯誤處理、validation、logging

### 4.2 Plugin 自治

每個插件應自行擁有：

- 路由
- service
- repository
- DTO / validation
- migration
- 自己的資料表
- 自己的 feature gate

### 4.3 跨插件只透過 contract 或事件

禁止直接在 A 模組內寫 B 模組的私有資料表。

例如：

- `qr-session` 不應直接寫 `points` 的 ledger/balance
- 它應只發出 `table_session_ended` 事件
- `points` 插件收到事件後，按規則自行扣分與記帳

## 5. 建議目錄結構

```text
backend/
├── src/
│   ├── app/
│   │   ├── createApp.ts
│   │   ├── registerCore.ts
│   │   └── registerPlugins.ts
│   ├── core/
│   │   ├── auth/
│   │   ├── members/
│   │   ├── clubs/
│   │   ├── features/
│   │   ├── plugin-registry/
│   │   ├── events/
│   │   ├── http/
│   │   └── db/
│   ├── plugins/
│   │   ├── booking/
│   │   │   ├── manifest.ts
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   ├── repository.ts
│   │   │   ├── types.ts
│   │   │   └── migrations/
│   │   ├── qr-session/
│   │   ├── points/
│   │   ├── tournaments/
│   │   ├── highbreak/
│   │   ├── content/
│   │   └── admin-console/
│   ├── shared/
│   │   ├── errors/
│   │   ├── validation/
│   │   ├── utils/
│   │   └── config/
│   └── main.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── package.json
```

## 6. 插件註冊模型

建議定義統一的插件介面：

```ts
export interface BackendPlugin {
  key: string;
  version: string;
  dependsOn?: string[];
  register(app: Express, ctx: PluginContext): void;
  registerEvents?(ctx: PluginContext): void;
  healthcheck?(ctx: PluginContext): Promise<Record<string, any>>;
}
```

`PluginContext` 建議包含：

- Prisma client
- config
- logger
- event bus
- feature access service
- auth services

範例：

```ts
registerPlugin(bookingPlugin);
registerPlugin(qrSessionPlugin);
registerPlugin(pointsPlugin);
registerPlugin(tournamentsPlugin);
registerPlugin(highbreakPlugin);
```

## 7. 核心與插件邊界

### 7.1 Core

Core 保留：

- 會員基本資料
- 球會基本資料
- 登入 / 驗證
- admin token / operator 驗證
- feature flag
- club feature access
- 插件註冊與生命週期管理
- 事件派發與 outbox

不應再保留：

- 預約流程細節
- QR 起鐘計費細節
- 積分規則細節
- 賽事報名流程細節
- 單杆排行榜規則
- 首頁內容細節

### 7.2 Booking Plugin

責任：

- 球枱
- 價格方案
- 時段可用性
- 預約建立 / 取消 / 確認
- 預約衝突檢查

資料表建議：

- `ClubTable`
- `TablePricingScheme`
- `TableReservation`

### 7.3 QR Session Plugin

責任：

- QR token
- 起鐘 / 結束確認
- billed minutes 計算
- amount preview
- session state

資料表建議：

- `TableQrToken`
- `TableSession`
- `TableSessionConfirm`

注意：

- 不應直接寫 points 餘額
- 應改為發出 session 結算事件

### 7.4 Points Plugin

責任：

- 積分規則
- points config
- ledger
- balance
- 調整積分
- 根據事件進行加減分

資料表建議：

- `ClubPointsConfig`
- `PointsLedger`
- `PointsBalance`

### 7.5 Tournaments Plugin

責任：

- 賽事建立
- 發佈 / 關閉
- 公開列表
- 報名與審核

資料表建議：

- `Tournament`
- `TournamentSignup`

### 7.6 Highbreak Plugin

責任：

- 單杆紀錄
- 排行榜
- 後台修正 / 軟刪除
- 公開單杆展示

資料表建議：

- `BreakRecord`

### 7.7 Content Plugin

責任：

- 首頁 notice
- site ads / carousel
- news sources / news fetch
- 公開首頁內容聚合

資料表建議：

- `SiteNotice`
- `SiteAd`
- `SiteAdItem`
- `SiteAdPlacementItem`
- `NewsSource`
- `NewsItem`
- `NewsFetchLog`

## 8. 資料表拆分策略

### 8.1 建議做法

先維持同一個 PostgreSQL，按模組分 ownership，而不是按服務拆 DB。

原則如下：

- Core 表由 core module 管
- Plugin 表由各 plugin 管
- 任何模組不可直接修改其他模組私有表
- 關聯盡量用 `memberId`、`clubId`、`refType`、`refId`
- Prisma schema 可以先保留單一檔案，但邏輯 ownership 要先拆清楚

### 8.2 未來可再升級

當插件邊界穩定後，可以再選擇：

- 多 schema
- 多 database
- 外部 service

建議抽離順序：

1. `content`
2. `tournaments`
3. `highbreak`
4. `points`
5. `booking`
6. `qr-session`

後三者耦合最重，不適合最先獨立化。

## 9. 事件驅動設計

### 9.1 為何需要事件

目前最大問題是跨模組同步交易過多。

典型例子：

- 結束 table session
- 即時計費
- 即時決定是否扣積分
- 即時寫入 ledger / balance

這種流程把 `qr-session` 與 `points` 綁死。

### 9.2 建議事件

- `member.created`
- `member.updated`
- `member.deleted`
- `club.created`
- `booking.created`
- `booking.confirmed`
- `booking.cancelled`
- `table_session.started`
- `table_session.ended`
- `points.adjusted`
- `tournament.published`
- `tournament.signup.confirmed`
- `break_record.created`
- `break_record.deleted`

### 9.3 Outbox 表建議

建議新增：

- `DomainEventOutbox`

欄位示意：

- `id`
- `eventType`
- `aggregateType`
- `aggregateId`
- `payload`
- `createdAt`
- `processedAt`
- `failedAt`

先在單體內部使用 outbox + local dispatcher，就已經足夠。

## 10. 會員 / 球會刪除策略

目前刪除會員時，後端必須知道幾乎所有功能表的外鍵與清理順序，代表 domain 邊界未分離。

重構後應改成：

1. Core 發出 `member.deleted`
2. 各插件自行處理：
   - 軟刪除
   - 匿名化
   - 拒絕刪除
   - 歷史資料保留
3. Core 只負責聚合結果，不再自己寫所有插件的刪除 SQL

這樣可以把 purge 行為拆回每個插件自己的責任。

## 11. 第一階段實施方案

### Phase 1: 結構切分，不改業務規則

目標：

- 不改 API 行為
- 不改 DB schema 大方向
- 只做模組分層

要做的事：

1. 把 `backend/index.ts` 改為真正 bootstrap 檔
2. 把路由拆成：
   - `members`
   - `admin`
   - `content`
   - `leaderboard`
   - `booking`
   - `qr-session`
3. 把 `routes/club.ts` 內的功能按插件拆分為多個 router
4. 抽出共用 middleware：
   - `requireActiveMember`
   - `requireClubAdmin`
   - `adminAuth`
   - `requireFeature`
5. 抽出共用 domain service：
   - `FeatureAccessService`
   - `MemberAccessService`
   - `ClubContextService`

交付標準：

- `index.ts` 小於 300 行
- `club.ts` 不再承擔多領域功能
- 現有 API 路徑不變

### Phase 2: 每個插件 service/repository 化

目標：

- 路由只做 request/response
- 商業規則搬到 service
- Prisma 操作搬到 repository

要做的事：

- 每個插件新增 `service.ts`
- 每個插件新增 `repository.ts`
- 整理錯誤碼、驗證、回傳格式

交付標準：

- route handler 平均不超過 40 行
- 單一 service 僅處理單一 use case

### Phase 3: 導入事件與解耦

目標：

- 移除跨模組直接寫表

要做的事：

- `qr-session` 不再直寫 `points`
- `booking` / `tournaments` / `highbreak` 需要的聯動改為 event
- 新增 outbox 與 event dispatcher

交付標準：

- 關鍵跨模組行為改為事件觸發
- plugin 間依賴只經由 contract 或 event

### Phase 4: 真正插件化治理

目標：

- 支援顯式註冊與停用

要做的事：

- 導入 `manifest.ts`
- 在啟動時決定哪些 plugin 註冊
- 加入 plugin healthcheck
- 加入 plugin capability metadata

交付標準：

- 任何 plugin 可不掛載 router
- 任何 plugin 可單獨健康檢查

## 12. 第一批建議優先拆分順序

建議優先順序如下：

1. `content`
2. `members`
3. `tournaments`
4. `highbreak`
5. `points`
6. `booking`
7. `qr-session`

原因：

- `content` 相對獨立，適合先建立插件框架
- `members` 與 `features` 是 core，需要先穩定
- `tournaments`、`highbreak` 相對單純，容易先驗證插件模式
- `booking`、`qr-session`、`points` 耦合最強，應在事件機制就緒後再深拆

## 13. 風險與注意事項

### 13.1 不要一開始就拆多個 database

否則會提早引入：

- 分散式交易
- 分散式一致性
- 部署複雜度
- 監控成本

### 13.2 不要在重構第一階段同時改 API

先做結構切分，保持前端完全無感，風險最低。

### 13.3 不要讓 plugin 直接共享 service 內部實作

共享的是 contract，不是把一堆 helper 再重新集中成另一個超大共用模組。

### 13.4 Prisma schema 可先不拆檔

短期先拆 ownership、service、router 即可。

如果太早拆多個 schema 或 client，會令重構成本暴增。

## 14. 建議的第一輪實作輸出

如果正式開始重構，第一輪最有價值的輸出應該是：

1. `backend/index.ts` 縮成 bootstrap
2. 新增 `backend/src/core`
3. 新增 `backend/src/plugins/content`
4. 新增 `backend/src/plugins/tournaments`
5. 新增 `backend/src/plugins/highbreak`
6. 抽出 `FeatureAccessService`
7. 抽出 `EventBus` 與 `DomainEventOutbox`

這樣做完後，整個系統就會從「大型單體」進入「可持續拆分的模組化單體」。

## 15. 最終建議

本系統非常適合往插件化走，但正確順序應是：

1. 模組化單體
2. 插件註冊制
3. 事件解耦
4. 視情況抽出獨立服務

短期最重要的，不是追求技術上最激進的拆分，而是先把：

- 邊界畫清楚
- ownership 畫清楚
- 跨模組寫表移除
- `index.ts` / `club.ts` 的超大責任拆散

做到這一步，之後要擴建、改動或刪除任一功能，成本就會大幅下降。
