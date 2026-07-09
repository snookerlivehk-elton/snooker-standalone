# Highbreak 影片補錄與多門檻統計實作藍圖

更新日期：2026-07-09（Asia/Hong_Kong）

## 1. 背景

- 現時場館 Highbreak 的「會內紀錄列表」已可顯示 `影片` 欄位，但場館端只能在新增紀錄時填寫 `video_url`，不能在比賽完結後補回影片連結。
- 目前正式比賽 `20+` 已改為主要記錄來源，但顯示與統計口徑仍大多固定寫死在 `20+`，不利之後按活動標準、裁判標準或官方 KPI 切換成 `30+ / 40+ / 50+`。
- 現有資料模型已具備保存原始單杆分數的能力，因此更合理的方向是「輸入層固定收錄，顯示層按門檻過濾」，而不是為不同門檻重複記錄資料。

## 2. 目標

### 2.1 影片補錄

- 場館管理員可在 `Highbreak > 會內紀錄列表` 直接補上或修改影片連結。
- 同一套列表操作同時支援：
  - 已存在的顯式 `BreakRecord`
  - 由賽事 frame fallback 合併出來的 synthetic row
- 對操作員來說，不需要理解 row 來源差異，只需知道可以「補影片」或「編輯影片」。

### 2.2 多門檻顯示與統計

- 輸入層固定收錄 `20+`，保存完整 break 原始分數。
- 顯示層與統計層支援可切換門檻，例如：
  - `20+`
  - `30+`
  - `40+`
  - `50+`
- Super Admin 可設定全站預設顯示門檻。
- 各場館可設定自己的預設顯示門檻，並可選擇跟隨系統預設。
- 會員頁、場館頁、公開榜單可按指定門檻查看歷史、最高、次數與累計。

## 3. 核心原則

- `BreakRecord.points` 永遠保存真實分數，不因顯示門檻改寫資料。
- `20+` 是收錄下限，不等於永遠的顯示下限。
- 顯示標準與統計標準必須共用同一個 `minPoints` 過濾語義，避免頁面與排行榜口徑不一致。
- 場館端高風險修改維持最小化；第一階段只開放 `video_url` 與必要註記，不開放直接改分數、會員、時間。
- 對 synthetic row 的操作，後端負責 materialize 成正式 `BreakRecord`，不要把資料來源複雜度暴露給前端。

## 4. 現況問題

### 4.1 影片補錄缺口

- 場館列表只讀顯示 `video_url`，沒有 edit action。
- Super Admin 已有完整單杆編輯功能，但場館端沒有對應的精簡版流程。
- `unifiedBreakRows` 會回傳 `EXPLICIT` 與 `FRAME_FALLBACK` 兩種來源，後者沒有真實 `BreakRecord.id` 可直接更新。

### 4.2 門檻口徑缺口

- `Tournament.tracked_break_threshold` 目前同時扮演「收錄條件」與「顯示條件」的影子角色，責任不夠清晰。
- `unifiedBreakRows` 內仍存在寫死 `>= 20` 的查詢與 fallback 邏輯。
- 系統公開榜、場館榜、會員頁目前不是完全一致地使用同一套門檻策略。
- 若未先抽出共用 `minPoints` 過濾模型，之後新增 `40+` 官方標準時，容易再出現榜單與明細不同步。

## 5. 目標資料模型

### 5.1 收錄門檻與顯示門檻分離

- 保留「收錄下限」概念：
  - 第一階段維持 `20`
  - 作用：決定哪些 break 需要被記錄進系統
- 新增「顯示門檻」概念：
  - 作用：決定列表、排行榜、會員歷史、摘要卡如何過濾

### 5.2 建議欄位

- `SystemModuleConfig.settingsJson` 的 `highbreak` 模組新增：
  - `systemDisplayThresholdDefault`
  - `displayThresholdOptions`
  - `defaultLeaderboardScope`
- `ClubProfile` 或 club-level module settings 新增：
  - `clubDisplayThresholdMode`: `FOLLOW_SYSTEM | CUSTOM`
  - `clubDisplayThresholdDefault`

### 5.3 建議預設值

- `systemDisplayThresholdDefault = 40`
- `displayThresholdOptions = [20, 30, 40, 50, 60, 80, 100]`
- `clubDisplayThresholdMode = FOLLOW_SYSTEM`

## 6. API 藍圖

### 6.1 影片補錄 API

- 新增 club admin API：
  - `PATCH /api/club/breaks/:id/video`
- request body：
  - `videoUrl`
  - `note`（可選）
- 行為：
  - 若 row 為顯式 `BreakRecord`，直接更新 `video_url`
  - 若 row 來源為 `FRAME_FALLBACK`，由後端依 `tournament_match_id + frame_no + member_id + points` 建立顯式 `BreakRecord`，再寫入 `video_url`

### 6.2 統一門檻查詢參數

- 以下 API 新增 `minPoints`：
  - `/api/me/breaks`
  - `/api/club/breaks`
  - `/api/club/:clubId/leaderboard/highest`
  - `/api/club/:clubId/leaderboard/monthly`
  - `/api/leaderboard/members/highest`
  - `/api/leaderboard/members/monthly`
  - `/api/leaderboard/clubs/highest`
  - `/api/leaderboard/clubs/monthly`
- `minPoints` 行為：
  - 不改寫原始資料
  - 只在 response 前做門檻過濾與聚合

### 6.3 設定 API

- Super Admin：
  - `GET /api/admin/modules/highbreak/settings`
  - `PUT /api/admin/modules/highbreak/settings`
- Club Admin：
  - `GET /api/club/highbreak/settings`
  - `PUT /api/club/highbreak/settings`

## 7. Backend 實作藍圖

### 7.1 共用門檻 resolver

- 新增 `backend/src/core/highbreak/thresholds.ts`
- 提供：
  - `resolveHighbreakDisplayThresholdOptions()`
  - `resolveEffectiveHighbreakThresholdForClub()`
  - `normalizeHighbreakMinPoints()`

### 7.2 統一資料層升級

- 升級 `backend/src/core/highbreak/unifiedBreakRows.ts`
- 改造方向：
  - 查詢原始資料時保留 `20+` 收錄能力
  - 回傳前支援 `minPoints` 過濾
  - 補上 `source`、`sourceKey`、`canEditVideo`、`materializePayload` 等 metadata，供場館列表直接使用

### 7.3 影片 materialize service

- 新增 `backend/src/core/highbreak/materializeBreakRecord.ts` 或等效 service helper
- 功能：
  - 將 `FRAME_FALLBACK` row 轉成正式 `BreakRecord`
  - 避免重複建立相同 match/frame/member/points 的顯式 row
  - 統一處理 `video_url`、`note`、`recorded_at`

### 7.4 排行榜口徑收斂

- 場館榜與系統公開榜都應走同一套 `minPoints` + `scope` 模型。
- 建議顯式支援：
  - `scope=VENUE`
  - `scope=TOURNAMENT`
  - `scope=ALL`
- 第一階段若要保守，可先維持公開榜現狀，但文件與程式需明確標註口徑差異。

## 8. Frontend 實作藍圖

### 8.1 場館 Highbreak 模組

- 檔案：
  - `frontend/src/venue/modules/VenueHighbreakModule.tsx`
  - `frontend/src/lib/api.ts`
- 變更：
  - 會內紀錄列表每列新增：
    - `補上影片`
    - `編輯影片`
    - `儲存`
    - `取消`
  - 加入門檻切換：
    - `20+`
    - `30+`
    - `40+`
    - `50+`
  - 預設值跟隨場館設定

### 8.2 會員頁

- 檔案：
  - `frontend/src/Me.tsx`
  - `frontend/src/lib/api.ts`
- 變更：
  - 單杆歷史加入 `門檻切換`
  - 摘要卡動態改為：
    - `最高 40+`
    - `40+ 次數`
    - `40+ 累計`

### 8.3 公開頁與榜單

- 檔案：
  - `frontend/src/ClubPublicPage.tsx`
  - `frontend/src/HomePage.tsx`
- 變更：
  - 顯示文案由固定 `20+` 改為依門檻動態渲染
  - 若該頁不開放切換，則顯示當前預設標準，例如 `最高 40+`

### 8.4 Super Admin / Club Admin 設定頁

- Super Admin：
  - 在 `highbreak` module settings 加入：
    - 全站預設顯示門檻
    - 可選門檻清單
    - 預設 scope
- Club Admin：
  - 在場館 highbreak 模組內加入：
    - `跟隨系統 / 自訂標準`
    - 場館預設顯示門檻

## 9. 推薦 Batch

### Batch 1：場館影片補錄

- 目標：
  - 場館列表可直接補 `video_url`
- 涉及：
  - club admin PATCH API
  - `VenueHighbreakModule.tsx` row-level edit UI
  - synthetic row materialize helper

### Batch 2：共用 `minPoints` 查詢能力

- 目標：
  - `/me`、場館列表、場館榜先能按門檻正確過濾
- 涉及：
  - `unifiedBreakRows`
  - club/member highbreak router
  - frontend API wrapper

### Batch 3：系統與場館預設門檻

- 目標：
  - Super Admin 與場館可分別設定預設標準
- 涉及：
  - highbreak module settings
  - club highbreak settings
  - settings UI

### Batch 4：公開頁與會員頁門檻切換

- 目標：
  - 統一顯示文案與 KPI 口徑
- 涉及：
  - `Me.tsx`
  - `ClubPublicPage.tsx`
  - `HomePage.tsx`

### Batch 5：scope 與官方榜口徑收斂

- 目標：
  - 明確區分 `VENUE / TOURNAMENT / ALL`
  - 避免官方榜與場館榜對同一門檻有不同計算結果

## 10. 相容策略

- 既有 `20+` 資料不需要搬遷，因為原始 `points` 已完整存在。
- `tracked_break_threshold` 第一階段不強制移除，先視為 legacy capture rule。
- 舊前端若未帶 `minPoints`，後端回退為當前場景預設門檻；若取不到，最後回退 `20`。
- 影片補錄對既有顯式 `BreakRecord` 不影響，只是新增編輯入口。

## 11. 風險與注意事項

- 若對 synthetic row 沒有 materialize 流程，場館端會看到可編輯 UI 但無法持久保存影片。
- 若 `minPoints` 只做在前端，不做在 backend 聚合，月累計與排行榜會再次和明細不同步。
- 若系統公開榜不先定義 `scope`，日後 `40+` 官方 KPI 容易與場館榜、會員頁不一致。
- 若允許場館自由輸入任意門檻，前端文案與排行榜比較會變得分散；第一階段較建議只從固定清單選擇。

## 12. 建議預設決策

- 系統官方預設門檻：`40+`
- 場館可覆蓋系統預設，但先限固定選項，不開放任意輸入
- 第一階段影片補錄只開放 `video_url` 與 `note`
- 第一階段會員頁、場館頁提供固定 tab：`20+ / 40+ / 50+`
- 官方榜單在正式拍板前，先明確寫出是否採 `VENUE` 或 `ALL`

## 13. 下一步建議

- 先實作 `Batch 1 + Batch 2`
- 原因：
  - 能最快改善實際操作流程
  - 能先把 `minPoints` 模型抽出，避免後續每個頁面各做各的
  - 影片補錄與門檻過濾都會直接受惠於統一資料層
