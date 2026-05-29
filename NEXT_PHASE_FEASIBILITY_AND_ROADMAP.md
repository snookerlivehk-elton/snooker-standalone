# snooker-standalone 可行報告 + 儲存排程（下一階段）

更新日期：2026-05-25（Asia/Hong_Kong）

## 注意（2026-06-29）

本文件主要覆蓋「上一輪」5 個需求（註冊/公開榜/單杆統計/比賽報名工具）。最新已確認的 1–9 大功能方向（含：功能上落架、積分、掃碼起鐘結算、預約互動升級）以及最新進度，已整合到：

- `PROJECT_PROGRESS.md`（AI 交接檔）

目的：整理下一階段 5 個需求的可行性、改動範圍、風險與建議排程，方便下一次 AI/協作者快速接手。

## 現況速覽（與本次 5 項需求相關）

### 登入/註冊（非 Google）

後端其實已具備「Email + 密碼」方案，但前端註冊流程未完整接上，導致「非 Gmail/Google 帳號」使用體驗不完整：

- 後端已存在：
  - `POST /api/members/login`（Email + password 登入）
  - `POST /api/members/request-register-code`（寄出註冊驗證碼）
  - `POST /api/members/register-with-code`（用驗證碼 + 密碼建立帳號）
  - `POST /api/members/request-reset-password-code` / `POST /api/members/reset-password-with-code`（忘記密碼）
  - `POST /api/auth/google`（Google 登入/自動註冊）
- 前端現況：
  - `MemberLogin.tsx` 已支援 Email+密碼登入及「忘記密碼」流程
  - `MemberRegister.tsx` 目前是 Google-first（未提供 email+code 註冊 UI）
  - `MemberRegisterSimple.tsx` 直打 `POST /api/members/register`，但該 API 不會設定密碼，會造成之後 email+password 登入失敗（常見錯誤：尚未設定密碼）

### 單杆資料模型

- `BreakRecord` 已落地（points / recorded_at / video_url / note / deleted_at ...）
- 已有全站（public）龍虎榜 API：目前僅計 `points`（最高/本月累計），未包含「總單杆分 / 最高單杆 / 總單杆數」等更完整統計
- 已有 superadmin break 的 patch/delete；並已新增 admin breaks 管理頁

## 需求 1：解決不以 Gmail/Google 帳號的註冊及登入問題

### 可行性

可行（後端 80% 已具備）。主要問題在於「前端註冊流程」未連到 `request-register-code` + `register-with-code`，以及 `MemberRegisterSimple` 使用了不帶密碼的舊註冊 API。

### 建議方案（最少改動）

1) 前端 `MemberRegister.tsx` 增加「Email 註冊」分頁/模式：
   - 第一步：輸入 email → 呼叫 `POST /api/members/request-register-code`
   - 第二步：輸入 code + name + password（+ 可選 phone/birthDate/clubName）→ 呼叫 `POST /api/members/register-with-code`
   - 成功後直接寫入 `memberSession` 並導去 `/member/:id`
2) `MemberRegisterSimple.tsx`：
   - 方案 A（推薦）：改為只做「開發/內部用途」並從路由/入口隱藏
   - 方案 B：改成改用 `register-with-code`（即變成正式註冊頁），避免產生無密碼帳號
3) 文案：
   - 登入頁現已同時提供 Email+Password 與 Google；註冊頁亦應同時提供 Email 註冊與 Google 註冊

### 風險/注意

- Email 寄送依賴 `RESEND_API_KEY`；若 production 未設定，註冊碼不會寄出（需提供 fallback 提示）
- `email_verified_at` 目前在 `register-with-code` 直接設為 now；若未來要嚴格驗證，可再拆成 verify flow

### 驗收標準

- 非 Gmail 的普通 email（例如 outlook/yahoo/自家 domain）可完成註冊（含設定密碼）
- 註冊後可用 Email+Password 登入
- 忘記密碼流程可重設後再登入

## 需求 2：會員可選擇是否公開自己的單杆及累計成績於系統主頁（不影響場館結算）

### 可行性

可行，需要新增一個「會員偏好設定」欄位，並在「系統主頁的公開榜單/統計」查詢時過濾。

### 建議資料設計

- `Member` 新增欄位：
  - `breaks_public_enabled Boolean @default(true)`（命名可調）
- 不影響場館結算的做法：
  - 場館頁/場館後台的榜單仍顯示完整資料（不受此設定影響）
  - 只有「系統主頁」及「全站公開榜單 API」會過濾 `breaks_public_enabled=true`

### UI 建議

- 會員頁 `/member/:id` 或 `/me` 加入切換開關：
  - 「是否於系統主頁公開我的單杆成績」
- API：
  - `PATCH /api/me/preferences` 或重用 `PUT /api/members/:id`（但目前 self-update 無 session 驗證，建議新增專用 endpoint 並以 `x-member-id` 驗證）

### 驗收標準

- 會員關閉公開後：
  - 系統主頁龍虎榜不再出現該會員
  - 會員本人/場館仍可在各自頁面看到記錄

## 需求 3：會員加入歷史累計單杆成績（總分/最高/總數）+ 年/月圖表

### 可行性

可行。資料已在 `BreakRecord`；主要工作在於：

- 後端提供聚合 API（按月/按年 group）
- 前端提供圖表（建議用無依賴的 SVG/Canvas，避免引入新 chart library）

### 建議 API

- `GET /api/me/breaks/summary`
  - 回 `{ totalPoints, maxBreakPoints, totalBreaks }`
- `GET /api/me/breaks/timeseries?group=month&from=YYYY-MM&to=YYYY-MM`
  - 回 `[{ bucket:'2026-01', totalPoints, maxBreakPoints, totalBreaks }]`

### 圖表建議（不加新依賴）

- 先做「折線圖（總分）」+「柱狀（總數）」二選一，或做可切換 tab
- 以 SVG 畫線/柱，配合 tooltip（hover 顯示該月數值）

### 驗收標準

- 會員頁顯示：
  - 累計：單杆總分、最高單杆、總單杆數
  - 圖表可按年份或月份範圍切換

## 需求 4：系統主頁加入會員單杆累計龍虎榜（總分/最高/總數）

### 可行性

可行。現有主頁榜單 API 主要只回 `points`，需要新增更完整的聚合欄位。

### 建議輸出（榜單 item）

- `memberId`
- `member { id, name, member_code }`
- `totalPoints`（sum）
- `maxBreakPoints`（max）
- `totalBreaks`（count）

### 與需求 2 的關係

- 系統主頁的榜單必須過濾 `Member.breaks_public_enabled=true`

### 驗收標準

- 主頁可顯示「會員累計榜」並包含三個值（總分/最高/總數）
- 會員關閉公開後不會出現在榜上

## 需求 5：場館比賽報名工具（新增比賽、主頁/場館頁展示、快速報名、截止自動下架）

### 可行性

可行，但屬較大功能（涉及新資料表 + 權限 + 報名流程 + 主頁/場館頁整合）。建議分階段交付。

### 建議資料模型

- `ClubTournament`
  - `id`
  - `clubId`
  - `title`
  - `details`（rich text 先用純文字）
  - `capacity`（人數上限）
  - `deadlineAt`
  - `startsAt`（可選，方便日後顯示賽程）
  - `createdByMemberId`
  - `createdAt`
  - `deletedAt`（soft delete）
- `ClubTournamentSignup`
  - `id`
  - `tournamentId`
  - `memberId`
  - `createdAt`
  - unique `(tournamentId, memberId)`

### 權限/規則

- 建立/管理比賽：只限場館 admin（`requireClubAdmin`）
- 報名：
  - 必須先加入該場館（`ClubMember` 存在）
  - 必須在 `deadlineAt` 前
  - 名額滿就拒絕
- 下架：
  - 以查詢條件過濾 `deadlineAt > now AND deletedAt is null`（不需要 cron）

### 建議 API

- 場館 admin：
  - `POST /api/club/tournaments`（create）
  - `GET /api/club/tournaments`（list + include signups count）
  - `DELETE /api/club/tournaments/:id`（soft delete）
- 公開：
  - `GET /api/tournaments/public?limit=`（全站）
  - `GET /api/club/:clubId/tournaments/public`（單場館）
- 會員報名：
  - `POST /api/tournaments/:id/signup`（requireMember + 驗證 club membership）
  - `DELETE /api/tournaments/:id/signup`（可選，讓會員取消報名）

### UI 建議

- 場館後台 `VenueDashboard` 增加「比賽報名」管理區塊（同直播通告做法）
- 系統主頁 `HomePage` 增加「比賽報名」區塊（卡片列表 + 快速報名按鈕）
- 場館公開頁 `ClubPublicPage` 增加「比賽報名」區塊

### 驗收標準

- 場館可新增比賽（標題/詳情/名額/截止）
- 系統主頁及場館頁會顯示未過截止的比賽
- 會員必須加入場館才可報名；名額滿/過截止會提示

## 儲存排程（建議分 4 次部署）

以下以「每個階段做完就 push → Railway 部署 → 線上檢收」節奏安排。

### Phase 1（帳號系統補完）

- 目標：完成非 Google 註冊/登入閉環（email + code + password）
- 交付：
  - 前端註冊頁新增 Email 註冊模式（request code / register with code）
  - 修正/隱藏 `MemberRegisterSimple`
  - 完整錯誤提示（無 RESEND 配置時的提示）

### Phase 2（公開開關）

- 目標：會員可控制是否在主頁公開單杆成績
- 交付：
  - Prisma migration：新增 `Member.breaks_public_enabled`
  - 會員頁加入開關 + API 更新
  - 主頁/全站榜單 API 過濾非公開會員

### Phase 3（會員歷史統計 + 圖表 + 主頁累計榜）

- 目標：會員可看歷史趨勢；主頁提供更完整的累計榜
- 交付：
  - 後端：summary + timeseries API
  - 前端：會員頁顯示 summary + 圖表（SVG/Canvas）
  - 後端：主頁「累計榜」聚合欄位（sum/max/count）
  - 前端：主頁展示該榜單

### Phase 4（比賽報名工具）

- 目標：場館可新增比賽、主頁/場館頁展示、會員可報名
- 交付：
  - Prisma migrations：`ClubTournament` / `ClubTournamentSignup`
  - 後端：create/list/delete + public list + signup endpoints
  - 前端：VenueDashboard 管理 UI + HomePage/ClubPublicPage 展示 + 快速報名
