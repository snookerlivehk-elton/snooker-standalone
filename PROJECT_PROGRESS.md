# snooker-standalone 現階段進程（AI 交接檔）

更新日期：2026-06-20（Asia/Hong_Kong）

## 最新已記錄方案（2026-06-20）

- 已新增方案文件：`MODULE_PLATFORM_ARCHITECTURE_PLAN.md`
- 本次記錄的方向是：
  - 不走重型 plugin platform
  - 採 `modular monolith + module registry / manifest`
  - 引入 `SystemModule / SystemModuleConfig / ClubModuleConfig`
  - 以「全局開關 + 場館授權 + 公開顯示 + 首頁顯示」統一管理模組
  - 將 `/home` 改為模組驅動組裝
  - 將 superadmin / venue admin 後台改為模組中心
- 下次開始落地時，建議依以下順序：
  1. 建立 module registry / manifest 骨架
  2. 補模組設定資料表
  3. 升級 feature access helper
  4. 將 `/home` 改為模組驅動
  5. 建立 superadmin / venue admin 模組中心

## 最新已完成：Module Registry Skeleton（2026-06-20）

- 已新增：`backend/src/core/modules/registry.ts`
- 已把現有模組整理成第一版 registry manifest，涵蓋：
  - `content`
  - `members`
  - `booking`
  - `qr_session`
  - `settlement`
  - `points`
  - `tournaments`
  - `highbreak`
  - `live`
  - `club_messages`
  - `club_dashboard`
  - `system_portal`
  - `member_portal`
- 已將 backend 內原本分散的 feature catalog / default enabled 設定收斂至 registry。
- 已接入位置：
  - `backend/index.ts`
  - `backend/src/core/features/featureAccess.ts`
  - `backend/src/plugins/admin-system/featureRouter.ts`
  - `backend/routes/club.ts`
- `GET /api/features` 現已額外返回 `modules` manifest 清單，供下一步做首頁與後台模組驅動使用。
- 本步驟尚未引入新的 Prisma table，也尚未改動現有 feature flag / club feature access 的資料模型，只先完成結構骨架收斂。

## 最新已完成：Module Config Schema Skeleton（2026-06-20）

- Prisma schema 已新增：
  - `SystemModule`
  - `SystemModuleConfig`
  - `ClubModuleConfig`
- migration 已新增：
  - `backend/prisma/migrations/20260702000001_add_module_platform_configs/`
- 已新增 helper：
  - `backend/src/core/modules/config.ts`
- 目前 helper 先提供：
  - 依 registry 產生預設 global config
  - 同步 `SystemModule` / `SystemModuleConfig` 種子資料
  - 讀取 module + global config 清單
- 本步驟刻意保持低風險：
  - 尚未接管現有 `FeatureFlag`
  - 尚未接管現有 `ClubFeatureAccess`
  - 尚未在 app startup 自動執行 sync，避免 production 尚未 deploy migration 時直接報錯
- 這代表下一步可以安全開始做：
  - `feature access helper` 升級
  - 由新表計算全局 / 場館模組有效狀態
  - 再逐步把舊 `FeatureFlag` / `ClubFeatureAccess` 轉成兼容層

## 最新已完成：Module Access Helper Upgrade（2026-06-20）

- 已升級：
  - `backend/src/core/features/featureAccess.ts`
  - `backend/clubFeatureAccess.ts`
- 目前 access 判斷策略已變為：
  - 全局狀態：優先讀 `SystemModuleConfig.enabledGlobally`
  - 若新表未有資料：回退 `FeatureFlag`
  - 若再沒有：回退 registry default
- 場館授權狀態已變為：
  - 優先讀 `ClubModuleConfig.enabledForClub`
  - 若新表未有資料：回退 `ClubFeatureAccess`
  - 若再沒有：回退既有 legacy data 偵測
- `backend/index.ts` 內的 `getFeatureMap()` 已改為使用共用 helper，不再直接自行查 `FeatureFlag`。
- 現階段效果：
  - 新模組設定表已真正進入 runtime access 計算路徑
  - 舊 `FeatureFlag` / `ClubFeatureAccess` 仍作兼容 fallback
  - 因此仍保持低風險，可逐步切換，不需要一次推翻舊邏輯
- 本輪驗證：
  - `backend npm run build` 已通過
- 目前已是適合推送 checkpoint 的階段，因為 registry、config schema、access helper 三個核心基礎已串起來。

## 最新已完成：Admin Feature Management Uses Module Config First（2026-06-20）

- 已升級：
  - `backend/src/plugins/admin-system/featureRouter.ts`
  - `backend/src/core/modules/config.ts`
- `/api/admin/features`
  - 讀取仍保持原本 response shape
  - 實際 enabled 狀態已透過共用 access helper 優先讀 `SystemModuleConfig`
  - 更新時已改為優先寫入 `SystemModuleConfig`
  - 同時仍同步寫入 `FeatureFlag` 作兼容鏡像
- `/api/admin/club-features/:featureKey`
  - 讀取時已透過 `clubFeatureAccess` helper 優先讀 `ClubModuleConfig`
  - 更新時已改為優先寫入 `ClubModuleConfig`
  - 同時仍同步寫入 `ClubFeatureAccess` 作兼容鏡像
- 為避免新環境尚未 seed module rows，本輪在 admin feature router 內加入了低風險的 registry sync 嘗試：
  - 能 sync 就補齊 `SystemModule` / `SystemModuleConfig`
  - 若 migration 尚未 deploy，仍會自動回退，不致令舊管理流直接報錯
- 本輪驗證：
  - `backend npm run build` 已通過
  - `AdminOverview` / `AdminVenues` 對應 API 型別與回應格式維持相容

## 最新已完成：Home Page Starts Using Module-Driven Visibility（2026-06-20）

- 已升級：
  - `backend/index.ts`
  - `backend/src/core/modules/config.ts`
  - `frontend/src/lib/features.ts`
  - `frontend/src/HomePage.tsx`
- `/api/features`
  - 現在除了 `features`、`catalog`、`modules` 外，也會回傳 `moduleStates`
  - `moduleStates` 會優先讀 `SystemModuleConfig`
  - 若新表尚未可用，則回退到 manifest default，不會令前端首頁直接失效
- `frontend/src/lib/features.ts`
  - 新增共享 `fetchModuleStates()`，與既有 feature flag 快取共用同一份 `/api/features` snapshot
  - 保持 `fetchFeatures()` 與 `useFeatureEnabled()` 原有行為不變
- `frontend/src/HomePage.tsx`
  - 首頁「最新新聞」區塊改由 `content` 模組控制
  - 首頁「直播排程」區塊改由 `live` 模組控制
  - 首頁「排行榜」區塊改由 `highbreak` 模組控制，並保留原本 `notice.homeShowLeaderboard` 條件
  - 首頁「精選場館」區塊暫以 `system_portal` 模組控制，並保留原本 `notice.homeShowClubList` 條件
  - 快速連結會跟隨可見區塊動態顯示，不再固定寫死
- 本輪驗證：
  - `backend npm run build` 已通過
  - `frontend npm run build` 已通過
- 備註：
  - 這一輪先把首頁區塊顯示切到模組驅動
  - `/home` 路由本身是否要受 `system_portal` 全局關閉後跳轉控制，仍可在下一輪補齊

## 最新已完成：System Portal Route Gate（2026-06-20）

- 已升級：
  - `frontend/src/lib/features.ts`
  - `frontend/src/App.tsx`
- `frontend/src/lib/features.ts`
  - 新增 `useModuleVisible()`，可按 `public` / `home` scope 讀取模組實際可見狀態
  - routing 現在可以直接使用 `effectivePublicVisible` / `effectiveHomeVisible`
- `frontend/src/App.tsx`
  - `/` 不再固定跳到 `/home`
  - 改為先判斷 `system_portal` 是否可公開顯示：
    - 可見時導向 `/home`
    - 關閉時導向 `/members/login`
  - `/home` 路由現已加上 `system_portal` 的 `home` scope gate
  - 避免了直接使用舊 `FeatureGate` 可能造成的 `/ -> /home -> /` redirect loop
- 本輪驗證：
  - `frontend npm run build` 已通過
- 備註：
  - 此輪先收斂在 system portal 入口一致性
  - 其他公開分頁若未來也要受 module public visibility 控制，可逐步套用同一套 `useModuleVisible()` 邏輯

## 最新已完成：Public Content Routes Use Module Visibility（2026-06-20）

- 已升級：
  - `frontend/src/App.tsx`
  - `frontend/src/ClubPublicPage.tsx`
- `frontend/src/App.tsx`
  - `/news` 現在已由 `content` 模組的 `public` visibility 控制
  - `/club/:clubId` 現在已由 `system_portal` 模組的 `public` visibility 控制
- `frontend/src/ClubPublicPage.tsx`
  - 頁內的 `snookerhk.live首頁` 浮動入口按鈕，已改為使用 `useModuleVisible('system_portal', 'public')`
  - 這讓公開頁 route gate 與頁內 portal 入口顯示規則保持一致
- 本輪驗證：
  - `frontend npm run build` 已通過
- 備註：
  - 目前 `ClubPublicPage` 內部各功能 tab 仍主要使用既有 feature/club access 判斷
  - 下一輪若要再深化，可把 club page 的各模組 tab 進一步對齊 `publicVisible` 與場館授權模型

## 最新已完成：Club Public Tabs Align With Module Visibility（2026-06-20）

- 已升級：
  - `backend/src/core/modules/registry.ts`
  - `backend/src/core/modules/config.ts`
  - `frontend/src/ClubPublicPage.tsx`
- `backend/src/core/modules/registry.ts`
  - `club_messages` 模組已修正為 `supportsPublicRoutes: true`
- `backend/src/core/modules/config.ts`
  - 為修正既有 seed 出來的錯誤預設，本輪在 `syncModuleRegistry()` 內對 `club_messages` 補上 `publicVisible` 校正
  - 這樣既有環境在重新讀取 `/api/features` 後，`club_messages` 不會因舊 default 被永久判成不可公開
- `frontend/src/ClubPublicPage.tsx`
  - `live` tab 現改為 `liveEnabled && livePublicVisible`
  - `tournaments` tab 現改為 `tournamentsEnabled && tournamentsPublicVisible`
  - `club_messages` tab 現改為 `clubMessagesEnabled && clubMessagesPublicVisible`
  - tab 切換 fallback、資料讀取條件、tab 顯示條件現已使用同一套合併後判斷
- 本輪驗證：
  - `backend npm run build` 已通過
  - `frontend npm run build` 已通過
- 備註：
  - `tournamentsEnabled` 仍保留既有 club access / global feature gate 效果
  - 本輪是在其上再疊加 `module public visibility`，因此公開比賽 tab 已較完整地對齊新模型

## 最新已完成：Super Admin Module Center (Phase 1)（2026-06-20）

- 已升級：
  - `backend/src/plugins/admin-system/featureRouter.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/AdminModules.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/AdminOverview.tsx`
- Backend
  - 新增 `GET /api/admin/modules`
  - 新增 `PUT /api/admin/modules/:moduleCode`
  - superadmin 現可直接以模組維度讀取與更新：
    - `enabledGlobally`
    - `publicVisible`
    - `homeVisible`
    - `allowClubEnable`
    - `sortOrder`
  - 當模組具有 `featureFlagKey` 時，更新 `enabledGlobally` 仍會同步鏡像到舊 `FeatureFlag`
- Frontend
  - 新增 `frontend/src/AdminModules.tsx`
  - 第一版模組中心支援：
    - 依 category 篩選模組
    - 顯示模組描述、feature flag key、能力標記
    - 直接切換全局啟用、公開顯示、首頁顯示、允許場館授權
    - 顯示實際 public/home 生效狀態
  - 新增 route：
    - `/admin/modules`
  - `AdminOverview` 已加入「模組中心」入口按鈕
- 本輪驗證：
  - `backend npm run build` 已通過
  - `frontend npm run build` 已通過
- 備註：
  - 目前先完成 superadmin 的第一版模組中心
  - venue admin 的模組中心仍是下一步候選

## 最新修正：Restore `/home` Visibility Under `system_portal`（2026-06-20）

- 已修正：
  - `backend/src/core/modules/registry.ts`
  - `backend/src/core/modules/config.ts`
- 問題原因：
  - `system_portal` 先前被標記為 `supportsHomeSection: false`
  - 但 `/home` route gate 已改為使用 `system_portal` 的 `home` scope
  - 令 `/home` 在新 module visibility 流程下被永久判成不可見
- 修正內容：
  - 將 `system_portal` 改回 `supportsHomeSection: true`
  - 在 `syncModuleRegistry()` 內補上對既有 `SystemModuleConfig.homeVisible` 的校正
- 效果：
  - 既有環境在下一次讀取 `/api/features` 時，會自動同步正確的 `system_portal` 首頁可見性
  - `/home` 恢復為可正常進入
- 本輪驗證：
  - `backend npm run build` 已通過
  - `frontend npm run build` 已通過

## 最新已完成：Venue Admin Module Center (Phase 1)（2026-06-20）

- 已升級：
  - `backend/routes/club.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/VenueModules.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/VenueDashboard.tsx`
- Backend
  - 新增 `GET /api/club/modules/manage`
  - 以場館管理員身份回傳當前場館可用模組清單
  - 每個模組包含：
    - 全局是否啟用
    - 場館是否授權
    - 實際是否可用
    - 公開顯示 / 首頁顯示狀態
    - 授權來源與最後更新時間
- Frontend
  - 新增 `frontend/src/VenueModules.tsx`
  - 新增 route：
    - `/venue/modules`
  - `VenueDashboard` 已加入「模組中心」入口按鈕
  - 第一版頁面支援：
    - 依 category 篩選模組
    - 顯示模組狀態與公開狀態
    - 快速跳去現有 `VenueDashboard` 對應 tab
    - 可直接打開場館公開頁
- 本輪驗證：
  - `backend npm run build` 已通過
  - `frontend npm run build` 已通過
- 備註：
  - 此輪先做場館模組狀態總覽與入口聚合
  - 尚未把各模組的場館級設定表單完全拆到獨立頁，但後續可沿此中心逐步展開

## 最新已完成：Venue Admin Module Pages (Phase 1)（2026-06-20）

- 已升級：
  - `frontend/src/VenueDashboard.tsx`
  - `frontend/src/VenueModulePage.tsx`
  - `frontend/src/VenueModules.tsx`
  - `frontend/src/App.tsx`
- Frontend
  - 新增 route：
    - `/venue/manage/:moduleCode`
  - `VenueModules` 的「前往管理」已由舊 `tab` query 入口改為獨立 route
  - `VenueDashboard` 已支援 `forcedTab` standalone mode，可在不顯示整組 tabs 的情況下單獨承載指定模組頁
  - `VenueModulePage` 已建立第一批 module-code 對應：
    - `club_dashboard`
    - `booking`
    - `qr_session`
    - `points`
    - `highbreak`
    - `live`
    - `club_messages`
    - `tournaments`
    - `members`
  - `live` / `club_messages` / `tournaments` 雖仍共用 `content` tab 內容，但 standalone mode 已可聚焦到對應段落並加上視覺高亮，作為低風險過渡版拆頁
- 本輪驗證：
  - `frontend npm run build` 已通過
- 備註：
  - 此輪先完成「獨立 URL + 單模組承載 + content 子段落聚焦」
  - 下一輪若要再深化，可把 `VenueDashboard` 內各模組內容真正抽成獨立 component / page，而不只共用容器

## 最新已完成：Venue Admin Module Extraction (Phase 2)（2026-06-20）

- 已升級：
  - `frontend/src/VenueDashboard.tsx`
  - `frontend/src/VenueModulePage.tsx`
  - `frontend/src/venue/modules/VenueModuleStandaloneLayout.tsx`
  - `frontend/src/venue/modules/VenueLiveModule.tsx`
  - `frontend/src/venue/modules/VenueClubMessagesModule.tsx`
  - `frontend/src/venue/modules/VenueTournamentsModule.tsx`
- Frontend
  - `live`、`club_messages`、`tournaments` 已由 `VenueDashboard` 內聯大段 JSX 抽成真正獨立 module component
  - `/venue/manage/live`
  - `/venue/manage/club_messages`
  - `/venue/manage/tournaments`
    現已直接渲染 standalone module page，不再經 `VenueDashboard forcedTab` 承載整頁
  - `VenueDashboard` 的 `content` tab 改為重用上述獨立 component，避免 dashboard 與 standalone page 各自維護一份實作
- 本輪驗證：
  - `frontend npm run build` 已通過
- 備註：
  - 此輪先完成內容型模組的真正抽離，屬風險最低的一批
  - 下一輪可沿同一模式逐步抽 `members`，再視情況處理 `booking / qr / points / highbreak / home`

## 最新已完成：Venue Admin Members Module Extraction (Phase 3)（2026-06-20）

- 已升級：
  - `frontend/src/VenueDashboard.tsx`
  - `frontend/src/VenueModulePage.tsx`
  - `frontend/src/venue/modules/VenueMembersModule.tsx`
- Frontend
  - `members` 已由 `VenueDashboard` 內聯 JSX 抽成真正獨立 module component
  - `/venue/manage/members` 現已直接渲染 standalone module page
  - `VenueDashboard` 的 `members` tab 已改為重用 `VenueMembersModule`
  - `home` 內原有的簡版場館會員摘要暫時保留，避免一次牽連首頁編輯區
- 本輪驗證：
  - `frontend npm run build` 已通過
- 備註：
  - 至此 venue admin 的內容型模組與會員管理已開始真正脫離單一大頁
  - 這是一個適合推 Railway 做線上驗證的 checkpoint，因為未涉及 migration，且新 route / build 已穩定

## 最新已完成：Venue Admin Highbreak + Points Extraction (Phase 4)（2026-06-20）

- 已升級：
  - `frontend/src/VenueDashboard.tsx`
  - `frontend/src/VenueModulePage.tsx`
  - `frontend/src/venue/modules/VenueHighbreakModule.tsx`
  - `frontend/src/venue/modules/VenuePointsModule.tsx`
- Frontend
  - `highbreak` 已由 `VenueDashboard` 內聯 JSX 抽成真正獨立 module component
  - `points` 已由 `VenueDashboard` 內聯 JSX 抽成真正獨立 module component
  - `/venue/manage/highbreak` 現已直接渲染 standalone module page
  - `/venue/manage/points` 現已直接渲染 standalone module page
  - `VenueDashboard` 的 `highbreak` 與 `points` tab 已改為重用新 module component
- 本輪驗證：
  - `frontend npm run build` 已通過
- 備註：
  - 至此 venue admin 的內容型模組、會員管理、單杆與消費積分都已脫離單一大頁主體
  - 這是另一個適合推 Railway 的 checkpoint，因為未涉及 migration，且新 route / build 已穩定

## 最新記錄：會員分層與 Email 驗證方案（2026-06-20）

- 已記錄架構方向：
  - 會員分為 `普通會員 (BASIC)` 與 `認證會員 (VERIFIED)`
  - `普通會員` 只需 `電話號碼` 或 `email`
  - `認證會員` 必須完成 `email` 驗證
- 已明確規則：
  - `phone only` 可成為普通會員
  - `email but not verified` 仍為普通會員
  - `email verified` 才升級為認證會員
- 已記錄建議資料模型：
  - `Member.emailVerifiedAt`
  - `Member.memberTier`
  - `MemberEmailVerificationToken`
- 已記錄第一批功能 gate：
  - `booking.create`
  - `tournament.signup`
    僅限認證會員
- 文件位置：
  - `MODULE_PLATFORM_ARCHITECTURE_PLAN.md`
- 備註：
  - 此部分目前先記錄方案，尚未開始 schema / migration / resend flow 落地

## 最新已完成：會員分層與 Email 驗證骨架（2026-06-20）

- 已升級：
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/20260620000002_add_member_tier/migration.sql`
  - `backend/src/core/members/eligibility.ts`
  - `backend/src/core/club/access.ts`
  - `backend/src/plugins/members/router.ts`
  - `backend/src/plugins/booking/router.ts`
  - `backend/src/plugins/tournaments/router.ts`
- Backend
  - 新增 `MemberTier` enum 與 `Member.member_tier`
  - migration 會把既有 `email_verified_at` 不為空的會員回填為 `VERIFIED`
  - 新增共用 member eligibility helper，集中處理 `booking.create` / `tournament.signup` 的認證會員檢查
  - 新增 email 驗證 backend flow 骨架：
    - 普通會員以 email 註冊後自動寄出第一封驗證信
    - `POST /api/me/email-verification/resend`
    - `POST /api/members/verify-email`
    - `GET /verify-email`
  - `booking` 建立預約與 `tournaments` 比賽報名已接上 `認證會員` gate
  - member login / Google auth 回傳已補上 `member_tier` 與 `email_verified_at`
- 本輪驗證：
  - `backend npm run build` 已通過
- 備註：
  - 此輪仍屬 backend foundation，前端會員中心的驗證狀態顯示與 resend UI 尚未落地
  - 此輪包含 migration，因此未部署前不建議直接推 Railway

## 最新已完成：會員驗證前端收口（2026-06-20）

- 已升級：
  - `frontend/src/lib/auth.ts`
  - `frontend/src/lib/api.ts`
  - `frontend/src/MemberLogin.tsx`
  - `frontend/src/MemberRegister.tsx`
  - `frontend/src/Me.tsx`
  - `frontend/src/ClubPublicPage.tsx`
- Frontend
  - `memberSession` 現在會保存：
    - `member_tier`
    - `email_verified_at`
  - 會員中心 `Me` 頁已顯示：
    - `普通會員 / 認證會員`
    - email 驗證狀態
    - 未驗證帳戶的 `重新發送驗證信`
  - `booking` 與 `tournaments` 前端已補上 `member_not_verified` 友善提示
  - 場館公開頁遇到未驗證會員時，會提示前往會員中心，而不只顯示 generic error / alert
  - 前端 API wrapper 已保留 backend `code`，方便之後擴充更多 capability gate
- 本輪驗證：
  - `frontend npm run build` 已通過
- 備註：
  - 會員若以純電話註冊，目前會清楚顯示尚未設定 email，因此暫未可升級為認證會員
  - 後續若要支援「電話會員補填 email 後升級」，仍需再補會員修改 email flow

## 最新已完成：Booking 模組設定頁（Phase 1）（2026-06-20）

- 已升級：
  - `backend/src/core/modules/bookingSettings.ts`
  - `backend/src/core/members/eligibility.ts`
  - `backend/src/core/club/access.ts`
  - `backend/src/plugins/admin-system/featureRouter.ts`
  - `backend/src/plugins/booking/router.ts`
  - `frontend/src/AdminBookingSettings.tsx`
  - `frontend/src/AdminModules.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/lib/api.ts`
- Backend
  - 重用既有 `SystemModuleConfig.settingsJson` 作為 `booking` 模組內部設定儲存
  - 新增 `booking` module settings helper，提供 default / normalize / read / update
  - 新增 admin API：
    - `GET /api/admin/modules/booking/settings`
    - `PUT /api/admin/modules/booking/settings`
  - `booking.create` 現已改為讀取 `bookingCreateRequirement`
    - 可在 `BASIC_MEMBER`
    - 與 `VERIFIED_MEMBER`
      之間切換
- Frontend
  - 新增 `Super Admin` 專用 `Booking 模組設定頁`
  - 模組中心 `booking` 卡片已加入「Booking 設定頁」入口
  - 第一版可設定：
    - `booking.create` 會員資格要求
    - `reservation.created.emailEnabled`
    - `reservation.confirmed.emailEnabled`
    - `reservation.cancelled.emailEnabled`
- 本輪驗證：
  - `backend npm run build` 已通過
  - `frontend npm run build` 已通過
- 備註：
  - 本輪 email 通知開關已配置化保存，但 booking 事件的實際寄信流程仍未接線
  - 下一輪最適合把 `reservation created / confirmed / cancelled` 真正接到 email delivery

## 最新已完成：Booking Email Notifications（Phase 2）（2026-06-20）

- 已升級：
  - `backend/src/core/notifications/email.ts`
  - `backend/src/plugins/members/router.ts`
  - `backend/src/plugins/booking/repository.ts`
  - `backend/src/plugins/booking/service.ts`
- Backend
  - 抽出共用 Resend email helper，避免不同模組各自複製寄信邏輯
  - `booking` 模組現已真正讀取設定頁中的三個 email 開關
  - 已接上以下 booking 事件 email：
    - 會員建立預約後先通知場館確認
    - 場館確認預約後再通知預約會員本人
    - 預約取消後（包括會員自行取消）
  - 新預約申請會寄到場館 email；確認與取消通知則寄到預約會員 email
  - 若未設定 `RESEND_API_KEY` / `RESEND_FROM_EMAIL`、會員沒有 email、或寄信失敗，均不會阻斷原本預約流程
- 實作細節
  - 已新增 web app base URL helper，email 內可建立登入超連結：
    - `/venue/login`
    - `/members/login`
  - 場館通知 email 內容包含：
    - 預約內容
    - 會員編號 / 名稱
    - 會員 email（如有）
    - 會員聯絡電話（如有）
    - 球枱
    - 方案（如有）
    - 時段
    - 報價（如有）
    - 場館登入超連結
  - 會員通知 email 內容包含：
    - 預約內容
    - 場館聯絡電話（如有）
    - 會員登入超連結
    - 取消原因（如有）
- 本輪驗證：
  - `backend npm run build` 已通過
- 備註：
  - `manual reservation / blocked slot` 這類場館內部操作，暫未額外接上 email
  - 下一輪最適合把同一套 pattern 複製到 `tournaments / club_messages / points`

## 最新已完成：Tournaments 模組設定頁（Phase 1）（2026-06-20）

- 已升級：
  - `backend/src/core/modules/tournamentsSettings.ts`
  - `backend/src/plugins/admin-system/featureRouter.ts`
  - `backend/src/plugins/tournaments/router.ts`
  - `frontend/src/AdminTournamentsSettings.tsx`
  - `frontend/src/AdminModules.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/lib/api.ts`
- Backend
  - 重用既有 `SystemModuleConfig.settingsJson` 作為 `tournaments` 模組內部設定儲存
  - 新增 `tournaments` module settings helper，提供 default / normalize / read / update
  - 新增 admin API：
    - `GET /api/admin/modules/tournaments/settings`
    - `PUT /api/admin/modules/tournaments/settings`
  - `tournament.signup` 現已改為讀取 `tournamentSignupRequirement`
    - 可在 `BASIC_MEMBER`
    - 與 `VERIFIED_MEMBER`
      之間切換
- Frontend
  - 新增 `Super Admin` 專用 `Tournaments 模組設定頁`
  - 模組中心 `tournaments` 卡片已加入「Tournaments 設定頁」入口
  - 第一版可設定：
    - `tournament.signup` 會員資格要求
    - `signup.created.emailEnabled`
    - `signup.confirmed.emailEnabled`
    - `signup.cancelled.emailEnabled`
- 本輪驗證：
  - diagnostics 已通過
- 備註：
  - 本輪先把比賽報名資格與通知開關配置化保存
  - 比賽報名 `created / confirmed / cancelled` 的實際 email delivery 可在下一輪接上

## 最新已完成：Super Admin 模組設定架構優化（2026-06-20）

- 已升級：
  - `backend/src/core/modules/adminModuleSettings.ts`
  - `backend/src/plugins/admin-system/featureRouter.ts`
  - `frontend/src/admin/moduleSettingsRegistry.ts`
  - `frontend/src/AdminModuleSettingsPage.tsx`
  - `frontend/src/AdminModules.tsx`
  - `frontend/src/App.tsx`
  - `frontend/src/lib/api.ts`
- Backend
  - 新增 `adminModuleSettings` registry，集中管理哪些模組支援獨立設定頁
  - `GET /api/admin/modules` 現會回傳：
    - `supportsSettingsPage`
    - `settingsPageLabel`
  - `GET /api/admin/modules/:moduleCode/settings`
  - `PUT /api/admin/modules/:moduleCode/settings`
    已改為透過共用 handler registry 分派，不再在 router 內持續堆疊 `if/else`
- Frontend
  - 新增共用 `moduleSettingsRegistry`，集中管理各模組設定頁文案、欄位與預設值
  - 新增單一路由：
    - `/admin/modules/:moduleCode/settings`
  - `Booking` 與 `Tournaments` 已改為共用 `AdminModuleSettingsPage`
  - 模組中心設定頁入口現改為讀 backend 回傳的 `supportsSettingsPage / settingsPageLabel`
  - 舊的 `AdminBookingSettings.tsx` 與 `AdminTournamentsSettings.tsx` 已移除，避免維護兩份近似頁面
- 本輪驗證：
  - diagnostics 已通過
- 備註：
  - 之後若要新增 `points / club_messages / live` 等設定頁，只需補：
    - backend handler
    - frontend registry
    即可沿用同一套 Super Admin 設定頁殼層

## 最新已完成：Points 模組設定頁（Phase 1）（2026-06-20）

- 已升級：
  - `backend/src/core/modules/pointsSettings.ts`
  - `backend/src/core/modules/adminModuleSettings.ts`
  - `backend/src/plugins/points/router.ts`
  - `frontend/src/admin/moduleSettingsRegistry.ts`
  - `frontend/src/AdminModuleSettingsPage.tsx`
- Backend
  - 重用既有 `SystemModuleConfig.settingsJson` 作為 `points` 模組內部設定儲存
  - 新增 `points` module settings helper，提供 default / normalize / read / update
  - 已接入 `Super Admin` 共用 module settings handler
  - 第一版已把以下營運控制接回 `points` router：
    - `clubPointsConfigEditable`
    - `manualAdjustmentEnabled`
  - 當關閉時：
    - 場館不可再修改積分規則
    - 場館不可再手動調整會員積分
- Frontend
  - `Points` 已接入共用 `Super Admin` 模組設定頁
  - 第一版可設定：
    - `clubPointsConfigEditable`
    - `manualAdjustmentEnabled`
    - `manualAdjustmentEmailEnabled`
    - `settlementDeductionEmailEnabled`
- 本輪驗證：
  - diagnostics 已通過
- 備註：
  - 本輪先把 `points` 的營運控制接線，email 通知開關先保存配置
  - 之後若你再調整 `points` email 規則，可直接沿用現有 settings storage

## 最新已完成：Club Messages 模組設定頁（Phase 1）（2026-06-20）

- 已升級：
  - `backend/src/core/modules/clubMessagesSettings.ts`
  - `backend/src/core/modules/adminModuleSettings.ts`
  - `backend/src/plugins/club-messages/router.ts`
  - `frontend/src/admin/moduleSettingsRegistry.ts`
- Backend
  - 重用既有 `SystemModuleConfig.settingsJson` 作為 `club_messages` 模組內部設定儲存
  - 新增 `club_messages` module settings helper，提供 default / normalize / read / update
  - 已接入 `Super Admin` 共用 module settings handler
  - 第一版已把以下營運控制接回 `club-messages` router：
    - `venuePublishingEnabled`
    - `memberInboxEnabled`
  - 當關閉時：
    - 場館不可再發佈、編輯或刪除公告
    - 會員端不再載入場館訊息箱資料
- Frontend
  - `club_messages` 已接入共用 `Super Admin` 模組設定頁
  - 第一版可設定：
    - `venuePublishingEnabled`
    - `memberInboxEnabled`
    - `messageCreatedEmailEnabled`
    - `messageUpdatedEmailEnabled`
    - `messageDeletedEmailEnabled`
- 本輪驗證：
  - diagnostics 已通過
- 備註：
  - 本輪刻意未與模組中心 `publicVisible` 重複，避免公開頁可見性出現兩套互相打架的開關
  - `club_messages` email 開關先保存配置，之後可再按你最終通知流程接實際 delivery

## 最新已完成：Live 模組設定頁（Phase 1）（2026-06-20）

- 已升級：
  - `backend/src/core/modules/liveSettings.ts`
  - `backend/src/core/modules/adminModuleSettings.ts`
  - `backend/src/plugins/live/router.ts`
  - `frontend/src/admin/moduleSettingsRegistry.ts`
- Backend
  - 重用既有 `SystemModuleConfig.settingsJson` 作為 `live` 模組內部設定儲存
  - 新增 `live` module settings helper，提供 default / normalize / read / update
  - 已接入 `Super Admin` 共用 module settings handler
  - 第一版已把以下營運控制接回 `live` router：
    - `venuePublishingEnabled`
    - `syncToClubMessagesEnabled`
  - 當關閉時：
    - 場館不可再發佈、編輯或刪除直播通告
    - 建立直播通告時不再自動同步成 `club_messages`
- Frontend
  - `live` 已接入共用 `Super Admin` 模組設定頁
  - 第一版可設定：
    - `venuePublishingEnabled`
    - `syncToClubMessagesEnabled`
    - `announcementCreatedEmailEnabled`
    - `announcementUpdatedEmailEnabled`
    - `announcementDeletedEmailEnabled`
- 本輪驗證：
  - diagnostics 已通過
- 備註：
  - 本輪未重複新增公開頁可見性開關，避免同模組中心 `publicVisible / homeVisible` 互相打架
  - `live` email 開關先保存配置，之後可再按你最終直播通知流程接實際 delivery

## 最新已完成：Members 模組設定頁（Phase 1）（2026-06-20）

- 已升級：
  - `backend/src/core/modules/membersSettings.ts`
  - `backend/src/core/modules/adminModuleSettings.ts`
  - `backend/src/plugins/members/router.ts`
  - `frontend/src/admin/moduleSettingsRegistry.ts`
- Backend
  - 重用既有 `SystemModuleConfig.settingsJson` 作為 `members` 模組內部設定儲存
  - 新增 `members` module settings helper，提供 default / normalize / read / update
  - 已接入 `Super Admin` 共用 module settings handler
  - 第一版已把以下營運控制接回 `members` router：
    - `emailRegistrationEnabled`
    - `phoneRegistrationEnabled`
    - `googleLoginEnabled`
    - `passwordResetEnabled`
    - `selfProfileEditEnabled`
    - `selfPasswordChangeEnabled`
  - 當關閉時：
    - 可分別停用 Email 註冊、手機註冊、Google 登入
    - 會員不可再申請重設密碼驗證碼或用驗證碼重設密碼
    - 會員中心不可再自行修改資料或自行更改密碼
- Frontend
  - `members` 已接入共用 `Super Admin` 模組設定頁
  - 第一版可設定：
    - `emailRegistrationEnabled`
    - `phoneRegistrationEnabled`
    - `googleLoginEnabled`
    - `passwordResetEnabled`
    - `selfProfileEditEnabled`
    - `selfPasswordChangeEnabled`
- 本輪驗證：
  - diagnostics 已通過
- 備註：
  - 本輪先集中處理會員系統的營運控制，不處理 email 文案或通知規則微調
  - 會員 email 驗證 / resend / verify flow 仍維持現有行為，之後可再獨立配置化

## 最新已完成：Highbreak 雙模式第一階段（2026-06-20）

- 已升級：
  - `backend/prisma/schema.prisma`
  - `backend/prisma/migrations/20260702000000_add_break_record_type/migration.sql`
  - `backend/src/plugins/highbreak/router.ts`
  - `backend/src/plugins/members/router.ts`
  - `frontend/src/venue/modules/VenueHighbreakModule.tsx`
  - `frontend/src/ClubPublicPage.tsx`
  - `frontend/src/AdminBreaks.tsx`
  - `frontend/src/Me.tsx`
  - `frontend/src/lib/api.ts`
- Backend
  - `BreakRecord` 新增 `record_type`
    - `VENUE`
    - `TOURNAMENT`
  - 第一階段先把現有與新建立的場館單杆紀錄全部收口為 `VENUE`
  - 已為之後正式比賽單杆預留 `tournament_id` 關聯欄位
  - 所有現有場館排行榜 / 公開排行榜 / 首頁綜合榜單現只統計 `VENUE`
- Frontend
  - `VenueHighbreakModule` 已明確改為「場館 Highbreak」
  - 場館頁排行榜文案改為會內 highbreak 排名，對齊「只作場館營銷/小遊戲」定位
  - 會員中心歷史記錄現已分：
    - 全部
    - 會內
    - 比賽
  - 管理員單杆後台現已可按 `recordType` 篩選，並顯示紀錄類型 / 賽事名稱欄位
- 本輪驗證：
  - backend `npm run build` 已通過
  - frontend `npm run build` 已通過
  - diagnostics 已通過
- 備註：
  - 本輪未改 `tournaments` 建立/確認流程
  - `TOURNAMENT` 類型現屬資料模型預留，之後可在你擴展賽事功能時再正式接線
  - 你要求的「比賽 highbreak 為正式記錄」方向已先在資料邊界上分開，避免再同會內 highbreak 混在一起

## 專案定位

SnookerHK Live 系統（與賽馬無關）。用語請避免「跑馬燈」等賽馬相關字眼，統一使用「全站公告／公告／通知」。

## 技術棧與結構

- Backend：Node.js + TypeScript (ESM) + Express + Prisma + PostgreSQL + Socket.io
- Frontend：React + Vite + TypeScript + Tailwind（自訂 cue-* / brand-* CSS variables 設計系統）
- Repo root：
  - `backend/` 後端 API + Prisma schema/migrations
  - `frontend/` 前端 SPA
  - `bun-service/` 額外服務（目前主流程以 frontend/backend 為主）

## 最新插件化 / 結算架構進度（2026-06-20）

- Backend 已進一步由大型單體重構為插件導向模組：
  - `content`
  - `tournaments`
  - `highbreak`
  - `points`
  - `members`
  - `booking`
  - `qr-session`
  - `live`
  - `club-messages`
  - `admin-system/features`
  - `admin-system/members`
- `booking`、`points`、`qr-session` 已完成 `router + service + repository` 分層，`backend/index.ts` 與 `backend/routes/club.ts` 主要轉為組合 / gateway 角色。
- 新增 settlement 主線：
  - `backend/src/plugins/settlement/router.ts`
  - `backend/src/plugins/settlement/service.ts`
  - `backend/src/plugins/settlement/repository.ts`
- Prisma 已新增：
  - `SessionSettlement`
  - `SessionSettlementAttempt`
  - `DomainEventOutbox`
  - migration：`backend/prisma/migrations/20260620000001_add_session_settlement/`
- 已新增設計文件：
  - `BACKEND_PLUGIN_ARCHITECTURE_BLUEPRINT.md`
  - `QR_SESSION_SETTLEMENT_POINTS_FLOW.md`

## QR Session / Settlement / Points 新流程（2026-06-20）

- 目前後端責任已改為：
  - `qr-session`：只負責起鐘 / 落鐘 / 計時 / 建立 settlement
  - `settlement`：負責交易狀態、quote、確認、完成
  - `points`：負責積分換算、扣分、ledger / balance 更新
- 會員端流程已改成二段式：
  1. `POST /api/qr/table/end-confirm`
     - 結束 session
     - 建立 `SessionSettlement`
     - 產生 points quote
     - 狀態進入 `AWAITING_CONFIRMATION`
  2. `POST /api/settlements/:id/confirm`
     - 會員確認扣分
     - `settlement` 驅動 `points` 完成交易
- 前端 `frontend/src/TableQrPage.tsx` 已接上新流程：
  - 掃碼落鐘後先顯示 quote
  - 再由會員確認扣分
- 場館 operator 落鐘目前仍維持自動完成，作為過渡方案，避免一次改動過大。

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

commit：`491c91d`（admin: redirect /admin to overview）

- `/admin` 會導向 `/admin/overview`（新 Super Admin 手機友善 UI）
- 保留 `/admin/legacy` 入口（舊版 PANEL；由 `/admin/overview` 的「舊版PANEL」按鈕進入）
- 當時已修正舊 `/admin` 在 feature flag 切換時的白屏問題；其後舊 `/admin/legacy` 與整套 scoring 流程已退役

更新：`/admin/legacy`（舊版後台）UI 排版對齊新後台

- `/admin/legacy` UI 重做：改用 Tabs + 卡片化區塊，排版對齊 `/admin/overview`（手機可用）
- 分頁：Rooms / Simple Mode / 建立房間 / 管理頁入口

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

目標：每一項功能可由 Super admin 決定是否上線，方便之後逐項收費。

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
- `live`（直播）

### 後端（強制封鎖，非只隱藏 UI）

- Public read：`GET /api/features`
- Admin 管理：
  - `GET /api/admin/features`（需 `ADMIN_TOKEN`：header `x-admin-token` 或 query `?token=`）
  - `PUT /api/admin/features`（批量 updates）
- 位置：`backend/index.ts`
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
  - 已套用：`/me`（member_portal）、`/venue/dashboard`（club_dashboard）、`/admin/breaks`（highbreak）
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

## 最新已完成：Backend 插件化重構 Checkpoint（2026-06-20）

### 目標

- 將 backend 從大型單體路由逐步重構成「模組化單體 + 插件式組合」
- 為之後進一步落地「功能可獨立擴建 / 改動 / 下架 / 拔除」打基礎
- 先完成 router module 化，再把高耦合模組往 `service / repository` 分層

### 已完成的 plugin / module 拆分

- `content`
- `members`
- `admin-system/features`
- `admin-system/members`
- `tournaments`
- `highbreak`
- `points`
- `booking`
- `qr-session`
- `live`
- `club-messages`

### 已新增的 core 層

- `backend/src/core/db/prisma.ts`
- `backend/src/core/auth/adminAuth.ts`
- `backend/src/core/club/access.ts`
- `backend/src/core/features/featureAccess.ts`
- `backend/src/core/utils/query.ts`
- `backend/src/core/members/utils.ts`
- `backend/src/core/booking/pricing.ts`
- `backend/src/core/qr-session/billing.ts`
- `backend/src/core/live/utils.ts`
- `backend/src/core/club/messages.ts`

### 本次結構性變更

- `backend/index.ts`
  - 已由大量業務 API 主檔，收斂為 system router composition / bootstrap 角色
  - 會員端 QR 掃碼起鐘 / 落鐘流程已抽到 `backend/src/plugins/qr-session/memberRouter.ts`
- `backend/routes/club.ts`
  - 已由大型球會業務聚合路由，收斂為 club feature gateway / router composition 角色
  - 已不再直接承擔以下大段實作：
    - `points`
    - `booking`
    - `qr-session`
    - `live-announcements`
    - `club-messages`
    - `tournaments`
    - `highbreak`

### 已完成 `service / repository` 分層的模組

- `points`
  - `backend/src/plugins/points/router.ts`
  - `backend/src/plugins/points/service.ts`
  - `backend/src/plugins/points/repository.ts`
- `qr-session`
  - `backend/src/plugins/qr-session/clubRouter.ts`
  - `backend/src/plugins/qr-session/memberRouter.ts`
  - `backend/src/plugins/qr-session/service.ts`
  - `backend/src/plugins/qr-session/repository.ts`
- `booking`
  - `backend/src/plugins/booking/router.ts`
  - `backend/src/plugins/booking/service.ts`
  - `backend/src/plugins/booking/repository.ts`

### 本次對未來插件化的意義

- router 已可逐步改成 plugin registration / manifest 掛載
- service 已可逐步變成功能合約層（feature contract）
- repository 已開始形成各功能自己的資料 ownership 邊界
- 後續若要做「功能可停用 / 拔除 / 收費上架」，風險和改動面已較之前明顯下降

### 本次驗證

- `backend npm run build` 已通過
- 本階段重構以 source code 為主，暫未改動 Prisma schema 邏輯

### 下一步建議

- 建立 `plugin manifest / registry` 骨架
- 將現有 plugin 的 feature gate / mount metadata 收斂到 manifest
- 規劃 core vs plugin 的正式 contract：
  - `member context`
  - `club context`
  - `feature access`
  - `plugin routes`
  - `plugin migrations ownership`
