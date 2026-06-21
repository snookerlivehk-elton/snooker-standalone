# 場館賽事應用程式設計草案

更新日期：2026-06-21（Asia/Hong_Kong）

## 目標

將現有 `tournaments` 模組由「比賽報名工具」升級為真正可供場館日常使用的「場館賽事應用程式」。

目標能力包括：

- 支援 `Knockout`（淘汰賽）與 `League`（循環聯賽）
- 場館可管理抽籤、參賽名單、賽程、球枱安排與比賽進度
- 場館可進行即時記分，並保存每場、每局、每位球手的正式比賽數據
- 平台可為本地球手建立可持續累積的桌球履歷
- 賽事中的 `20+ break` 需要完整事件化記錄，以支援獎勵系統、排行榜與技術成長分析

## 已確認產品方向

### 1. 不只記錄每局最高 break

已確認：

- 不應只保存「每局最高 break」
- 應完整記錄每一次達標的 `20+ break`
- `每局最高 break`、`每場最高 break`、`生涯最高 break` 可由 break 事件彙總得出，或作為快取欄位

原因：

- 若球手一局內打出 `24 + 31 + 22`，只存最高 break 只會留下 `31`
- 但對球手履歷、場館獎勵、平台徽章系統來說，這實際上是 `3 次 20+`
- 因此底層要保留「事件資料」，而不只保留「摘要資料」

### 2. 即時記分必須同時保存總得分

已確認：

- 除 `20+ break` 外，也要完整保存每局與每場的總得分
- `20+ break` 與 `總得分` 是兩條不同價值線：
  - `20+ break` 反映進攻爆發力
  - `總得分` 反映整體穩定輸出

### 3. 履歷系統要可累積整個球手生涯

已確認：

- 平台要能統計球手在正式比賽中的：
  - 勝 / 負
  - 得局 / 失局
  - 所有 `20+ break`
  - 最高 break
  - 總得分
  - 勝率
  - 不同時間段的成長走勢

## 現有可沿用基礎

目前 codebase 已有以下基礎，可作為升級起點：

- `Tournament` / `TournamentSignup`
  - 已具備場館建立比賽、上架、關閉、會員報名、場館確認流程
- `BreakRecord`
  - 已支援 `record_type = VENUE | TOURNAMENT`
  - 已有 `tournament_id` 欄位
- `Match` / `MatchPlayer`
  - 已有勝方、得局、總得分、max break 等比賽統計基礎欄位
- 會員中心
  - 已能分開顯示 `會內 / 比賽` highbreak 歷史

現況不足之處：

- `tournaments` 目前只到報名管理，尚未具備賽程、抽籤、即時記分、積分榜
- `TOURNAMENT` highbreak 尚未與正式賽事比賽流程接線
- `Match` 目前仍偏一般對局資料，未成為完整賽事引擎的一部分

## 建議資料模型

### A. 賽事容器

現有 `Tournament` 建議升級為正式賽事容器，新增至少以下欄位：

- `format`
  - `KNOCKOUT`
  - `LEAGUE`
- `raceTo`
- `tableCount`
- `status`
  - `DRAFT`
  - `REGISTRATION`
  - `SEEDED`
  - `IN_PROGRESS`
  - `COMPLETED`
  - `ARCHIVED`
- `pointsWin`
- `pointsDraw`
- `pointsLoss`
- `trackedBreakThreshold`
  - 預設為 `20`

### B. 正式參賽者

建議新增 `TournamentParticipant`，不要只依靠 `TournamentSignup`：

- `TournamentSignup` 保留作報名記錄
- `TournamentParticipant` 作正式參賽名單

建議欄位：

- `tournamentId`
- `memberId`
- `seed`
- `groupNo`
- `laneNo`
- `checkedIn`
- `finalRank`
- `status`

### C. 賽程與對陣

建議新增 `TournamentMatch`，而不是只直接依賴現有 `Match`：

建議欄位：

- `tournamentId`
- `stageCode`
- `roundNo`
- `matchNo`
- `tableNo`
- `scheduledAt`
- `startedAt`
- `endedAt`
- `playerAParticipantId`
- `playerBParticipantId`
- `winnerParticipantId`
- `status`
  - `PENDING`
  - `READY`
  - `LIVE`
  - `COMPLETED`
  - `CANCELLED`
- `bestOfFrames`
- `playerAFramesWon`
- `playerBFramesWon`
- `playerATotalPoints`
- `playerBTotalPoints`
- `playerAMaxBreak`
- `playerBMaxBreak`
- `playerA20PlusCount`
- `playerB20PlusCount`

### D. 每局資料

建議新增 `TournamentFrame`：

- `tournamentMatchId`
- `frameNo`
- `winnerParticipantId`
- `playerAScore`
- `playerBScore`
- `playerAHighestBreak`
- `playerBHighestBreak`
- `startedAt`
- `endedAt`

用途：

- 保存每局最終比分
- 支援得失局統計
- 支援每場總得分統計
- 支援由 frame 層聚合出 match 層摘要

### E. 20+ break 事件

這是本次已明確確認的核心方向。

建議新增 `TournamentBreakEvent`，或直接擴充 `BreakRecord` 使其可承載正式比賽 break 事件。

若沿用 `BreakRecord`，至少要補足以下關聯資訊：

- `tournament_id`
- `tournament_match_id`
- `frame_no`
- `member_id`
- `points`
- `recorded_at`
- `record_type = TOURNAMENT`
- `threshold_snapshot`

用途：

- 保存每次 `20+ break`
- 支援球手生涯 20+ 次數
- 支援單場 / 單月 / 單季 / 單館 / 全平台獎勵統計

## 履歷系統輸出目標

球手履歷建議至少分為 4 個區塊：

### 1. 成績總覽

- 生涯正式比賽場數
- 勝 / 負
- 勝率
- 得局 / 失局
- 最佳名次

### 2. 技術數據

- 生涯總得分
- 平均每場得分
- 平均每局得分
- 生涯 `20+` 次數
- 生涯 `30+ / 50+ / century` 次數
- 生涯最高 break

### 3. 賽事明細

- 比賽名稱
- 日期
- 場館
- 對手
- 比數
- 勝負
- 該場總得分
- 該場最高 break
- 該場 `20+` 次數

### 4. 成長軌跡

- 每月勝率
- 每月總得分
- 每月 `20+` 次數
- 每月最高 break

## 即時記分建議

### MVP 記錄標準

第一階段不建議直接做 shot-by-shot，而是先做可讓場館真正營運賽事的版本：

- 每場 match 對陣
- 每局 frame 比分
- 每局勝方
- 每次 `20+ break`
- 每場總得分
- 每場得失局
- 每場最高 break

### 第二階段再考慮

- shot-by-shot
- foul 類型
- shot clock / time analysis
- 進階技術分析

## Phase 1 建議範圍

第一階段目標不是一次完成所有履歷，而是先打通「正式比賽資料鏈」。

### Phase 1 交付目標

- `Tournament` 新增格式與賽事狀態
- 報名名單轉正式參賽名單
- 產生 `Knockout / League` 基本賽程
- 場館後台可錄入 match 結果與 frame score
- 每次 `20+ break` 正式記入 `TOURNAMENT` 類型
- 會員履歷先顯示：
  - 勝 / 負
  - 得失局
  - 總得分
  - 最高 break
  - `20+` 次數
  - 賽事歷史列表

### Phase 1 不做

- shot-by-shot
- 全量技術分析
- 複雜的多 stage 混合淘汰 + 分組賽編排
- 跨賽季 ranking system

## 建議開發順序

1. 擴充 schema，明確分開：
   - 報名
   - 參賽者
   - 賽程
   - frame
   - break event
2. 先完成 `Knockout` MVP
3. 再補 `League` standings 與 round-robin scheduler
4. 將 `TOURNAMENT` break event 接入會員履歷
5. 再做獎勵 / 徽章 / 平台排行榜

## 下一步建議

下一輪若正式開始實作，應先輸出：

- Prisma schema 草案
- API 清單
- Venue 後台賽事工作台 UI 結構
- 球手履歷欄位定義
- `Knockout` 與 `League` 各自的資料流

這樣可直接開始 Phase 1 實作，而不會在開發中途反覆改模型。

## Prisma Schema 草案

以下為 Phase 1 建議的 Prisma 草案方向。這裡先聚焦資料邊界與關聯，不要求一次把所有欄位用盡。

### 與現有 `schema.prisma` 對齊原則

現有 repo 的 Prisma 命名有兩個重要特徵：

- 新舊欄位混用 `camelCase` 與 `snake_case`
- 與比賽數據相關的模型，例如 `BreakRecord`、`Match`、`MatchPlayer`，偏向使用 `snake_case`

因此 Phase 1 建議：

- 新增賽事引擎相關模型時，優先沿用比賽數據區的 `snake_case`
- 現有 `Tournament` / `TournamentSignup` 的 `camelCase` 欄位不急於重命名
- 以「新增欄位 / 新增模型」為主，避免第一輪 migration 就大規模改名
- 現有 `Tournament.status` 先保留作前台上架狀態，不直接重用為賽事生命周期狀態

### 建議新增 enum

```prisma
enum TournamentFormat {
  KNOCKOUT
  LEAGUE
}

enum TournamentLifecycleStatus {
  DRAFT
  REGISTRATION
  SEEDED
  IN_PROGRESS
  COMPLETED
  ARCHIVED
}

enum TournamentParticipantStatus {
  ACTIVE
  WITHDRAWN
  DISQUALIFIED
  ELIMINATED
  CHAMPION
}

enum TournamentMatchStatus {
  PENDING
  READY
  LIVE
  COMPLETED
  CANCELLED
}
```

### 建議擴充 `Tournament`

```prisma
model Tournament {
  id                   String   @id @default(uuid())
  clubId               String
  club                 ClubProfile @relation(fields: [clubId], references: [id])
  status               TournamentStatus @default(DRAFT)

  // 現有欄位保留
  title                String
  description          String?
  signupGuide          String?
  capacity             Int      @default(32)
  startsAt             DateTime?
  signupOpensAt        DateTime?
  signupClosesAt       DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  // 新增欄位
  format               TournamentFormat?
  workflow_status      TournamentLifecycleStatus @default(DRAFT)
  race_to              Int?
  best_of_frames       Int?
  table_count          Int?
  points_win           Int      @default(3)
  points_draw          Int      @default(1)
  points_loss          Int      @default(0)
  tracked_break_threshold Int   @default(20)

  signups              TournamentSignup[]
  participants         TournamentParticipant[]
  tournament_matches   TournamentMatch[]
  breakRecords         BreakRecord[]
}
```

說明：

- `status` 可先保留，維持與現有程式相容
- `workflow_status` 作新賽事工作流主狀態
- 過渡期可先讓兩者並存，待新工作流穩定後再決定是否收斂
- 建議語意分工：
  - `status` = 公開 / 報名對外狀態
  - `workflow_status` = 場館賽事營運狀態

### 建議新增 `TournamentParticipant`

```prisma
model TournamentParticipant {
  id             String   @id @default(uuid())
  tournament_id  String
  tournament     Tournament @relation(fields: [tournament_id], references: [id], onDelete: Cascade)
  member_id      String
  member         Member   @relation(fields: [member_id], references: [id])

  signup_id      String?
  signup         TournamentSignup? @relation(fields: [signup_id], references: [id])

  seed           Int?
  group_no       Int?
  lane_no        Int?
  checked_in     Boolean  @default(false)
  final_rank     Int?
  status         TournamentParticipantStatus @default(ACTIVE)
  created_at     DateTime @default(now())
  updated_at     DateTime @updatedAt

  home_matches   TournamentMatch[] @relation("tournament_match_player_a")
  away_matches   TournamentMatch[] @relation("tournament_match_player_b")
  won_matches    TournamentMatch[] @relation("tournament_match_winner")

  @@unique([tournament_id, member_id])
  @@index([tournament_id, seed])
  @@index([tournament_id, group_no])
}
```

用途：

- `TournamentSignup` 表示有人報名
- `TournamentParticipant` 表示正式列入賽程
- 這可避免之後抽籤、退賽、替補時與報名記錄糾纏在一起

### 建議新增 `TournamentMatch`

```prisma
model TournamentMatch {
  id                   String   @id @default(uuid())
  tournament_id        String
  tournament           Tournament @relation(fields: [tournament_id], references: [id], onDelete: Cascade)

  stage_code           String?
  round_no             Int?
  match_no             Int?
  table_no             String?
  scheduled_at         DateTime?
  started_at           DateTime?
  ended_at             DateTime?

  player_a_participant_id String?
  player_a_participant   TournamentParticipant? @relation("tournament_match_player_a", fields: [player_a_participant_id], references: [id])
  player_b_participant_id String?
  player_b_participant   TournamentParticipant? @relation("tournament_match_player_b", fields: [player_b_participant_id], references: [id])
  winner_participant_id  String?
  winner_participant    TournamentParticipant? @relation("tournament_match_winner", fields: [winner_participant_id], references: [id])

  status               TournamentMatchStatus @default(PENDING)
  best_of_frames       Int?
  player_a_frames_won  Int      @default(0)
  player_b_frames_won  Int      @default(0)
  player_a_total_points Int     @default(0)
  player_b_total_points Int     @default(0)
  player_a_max_break   Int      @default(0)
  player_b_max_break   Int      @default(0)
  player_a_20_plus_count Int    @default(0)
  player_b_20_plus_count Int    @default(0)
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  frames               TournamentFrame[]
  break_records        BreakRecord[]

  @@index([tournament_id, stage_code, round_no, match_no])
  @@index([tournament_id, status, scheduled_at])
}
```

用途：

- 不直接替代現有 `Match`
- 先將 `TournamentMatch` 定位為正式賽事引擎
- 未來如需對齊 `Match`，可再做同步或統一

### 建議新增 `TournamentFrame`

```prisma
model TournamentFrame {
  id                   String   @id @default(uuid())
  tournament_match_id  String
  tournament_match     TournamentMatch @relation(fields: [tournament_match_id], references: [id], onDelete: Cascade)
  frame_no             Int

  winner_participant_id String?
  winner_participant    TournamentParticipant? @relation(fields: [winner_participant_id], references: [id])

  player_a_score       Int      @default(0)
  player_b_score       Int      @default(0)
  player_a_highest_break Int    @default(0)
  player_b_highest_break Int    @default(0)
  started_at           DateTime?
  ended_at             DateTime?
  created_at           DateTime @default(now())
  updated_at           DateTime @updatedAt

  @@unique([tournament_match_id, frame_no])
}
```

用途：

- 保存每局最終得分
- 保存每局最高 break 摘要
- 由 `TournamentFrame` 匯總出 `TournamentMatch`

### 建議擴充 `BreakRecord`

若沿用現有 `BreakRecord` 作正式比賽 break event 容器，建議至少新增：

```prisma
model BreakRecord {
  id                   String   @id @default(uuid())
  club_id              String
  member_id            String
  record_type          BreakRecordType @default(VENUE)
  tournament_id        String?

  // 建議新增
  tournament_match_id  String?
  frame_no             Int?
  threshold_snapshot   Int?

  points               Int
  recorded_at          DateTime @default(now())
  video_url            String?
  note                 String?
  created_at           DateTime @default(now())
  created_by_member_id String
  updated_at           DateTime?
  updated_by_admin     String?
  deleted_at           DateTime?
  deleted_by_admin     String?
  delete_reason        String?

  tournamentMatch      TournamentMatch? @relation(fields: [tournament_match_id], references: [id])
}
```

用途：

- 正式記錄每次 `20+ break`
- `threshold_snapshot` 用來保留當時門檻，避免日後門檻變動後統計失真

### 建議 migration 策略

建議不要一次把 `tournaments` 全部推翻重做，而是用 3 步平滑落地：

1. 先加欄位 / 加模型，不刪現有欄位
   - `Tournament` 新增：
     - `format`
     - `workflow_status`
     - `race_to`
     - `best_of_frames`
     - `table_count`
     - `points_win`
     - `points_draw`
     - `points_loss`
     - `tracked_break_threshold`
   - 新增：
     - `TournamentParticipant`
     - `TournamentMatch`
     - `TournamentFrame`
   - `BreakRecord` 補：
     - `tournament_match_id`
     - `frame_no`
     - `threshold_snapshot`
2. 第二輪再接 backend router 與 service
   - 先只做 `Knockout MVP`
3. 新流程穩定後，再決定是否把舊 `Tournament.status` 與新 `workflow_status` 收斂

## API 草案

Phase 1 API 目標是先打通「參賽名單 -> 對陣 -> 即時記分 -> 履歷」。

### A. 賽事設定 / 參賽名單

- `POST /api/club/tournaments/:id/participants/generate`
  - 由已確認報名名單生成正式參賽者
- `GET /api/club/tournaments/:id/participants`
  - 讀取正式參賽名單
- `PUT /api/club/tournaments/:id/participants/:participantId`
  - 更新 seed / group / checkedIn / status

### B. 抽籤 / 賽程

- `POST /api/club/tournaments/:id/schedule/knockout/generate`
  - 生成淘汰賽 bracket
- `POST /api/club/tournaments/:id/schedule/league/generate`
  - 生成 round-robin schedule
- `GET /api/club/tournaments/:id/matches`
  - 讀取賽程 / 對陣
- `PUT /api/club/tournaments/:id/matches/:matchId`
  - 更新桌號 / 開始時間 / 狀態 / 對陣

### C. 即時記分

- `POST /api/club/tournaments/:id/matches/:matchId/start`
- `POST /api/club/tournaments/:id/matches/:matchId/frames`
  - 新增一局
- `PUT /api/club/tournaments/:id/matches/:matchId/frames/:frameId`
  - 更新 frame score / winner / frame highest break
- `POST /api/club/tournaments/:id/matches/:matchId/breaks`
  - 新增一筆 `20+ break` 事件
- `POST /api/club/tournaments/:id/matches/:matchId/complete`
  - 完成比賽並回寫 match summary / standings / 履歷摘要

### D. 排名 / 履歷

- `GET /api/club/tournaments/:id/standings`
  - League 積分榜
- `GET /api/members/:id/tournament-career`
  - 球手正式賽事履歷摘要
- `GET /api/members/:id/tournament-career/timeseries`
  - 勝率 / 總得分 / 20+ 次數 / 最高 break 走勢

## Venue 後台賽事工作台 UI 草案

建議將場館後台 `tournaments` 獨立頁升級為 5 個工作分頁：

### 1. `設定`

- 比賽基本資料
- 賽制：
  - `Knockout`
  - `League`
- 報名時段
- race to / best of / 枱數
- `20+ break` 門檻

### 2. `參賽名單`

- 待確認報名
- 已確認報名
- 正式參賽者
- seed / 分組 / check-in
- 一鍵生成正式名單

### 3. `賽程`

- `Knockout`: bracket 視圖
- `League`: rounds / fixtures 表
- 桌號安排
- 比賽狀態

### 4. `即時記分`

- 目前 live matches
- 選擇球枱 / 選擇比賽
- 每局比分輸入
- 快速新增 `20+ break`
- 完成一局 / 完成整場

### 5. `成績 / 排名`

- Knockout 晉級結果
- League 積分榜
- 單場結果列表
- 賽事內最高 break / 20+ 次數

## Knockout 資料流

### 建議流程

1. 場館建立比賽
2. 會員報名
3. 場館確認報名
4. 產生 `TournamentParticipant`
5. 系統按 seed / random 產生 bracket
6. 場館逐場開賽與即時記分
7. 每完成一場，自動產生下一輪對陣
8. 每次 `20+ break` 寫入 `BreakRecord(record_type=TOURNAMENT)`
9. 完賽後更新球手履歷

### 關鍵回寫

- `TournamentMatch` 更新：
  - 勝方
  - 得失局
  - 總得分
  - 最高 break
  - 20+ 次數
- `TournamentParticipant` 更新：
  - status / finalRank
- `BreakRecord` 更新：
  - 每次 `20+ break`

### 非 `2^n` 人數的 bracket / bye / seed 規則

`Knockout` 不要求參賽人數必須剛好等於 `2^n`。當參賽人數不匹配時，系統應採用「升到最近 bracket size + bye」策略，而不是拒絕生成賽程。

建議規則：

1. 計算 `bracketSize = nextPowerOfTwo(participantCount)`
2. 計算 `byeCount = bracketSize - participantCount`
3. 若 `byeCount > 0`：
   - 高 seed 優先獲得 `bye`
   - 未獲 `bye` 的球手進入 `預賽 / Preliminary Round`
4. 預賽完結後，剩餘人數必須剛好進入下一個完整 bracket
5. UI 不應只顯示技術性 round number，應盡量顯示：
   - `預賽`
   - `64 強`
   - `32 強`
   - `16 強`
   - `8 強`
   - `4 強`
   - `決賽`

以 `70` 人為例：

- `bracketSize = 128`
- `byeCount = 58`
- 即：
  - `58` 位高 seed 首輪輪空
  - 其餘 `12` 位球手打 `6` 場預賽
  - `6` 位勝方 + `58` 位輪空球手 = `64` 人
  - 再正式進入 `64 強`

建議新增 `seedMode` 概念：

- `MANUAL`
  - 場館手動指定 seed
- `RANKING`
  - 按平台 rating / 場館 ranking / 過往賽績自動排序
- `RANDOM`
  - 完全抽籤，不設種子

預設產品規則建議：

- 若已提供 seed，`bye` 優先分配給高 seed
- 若未提供 seed：
  - 可按 `seedMode = RANDOM` 隨機分配
  - 或按報名次序產生暫時 seed
- 但正式賽事建議優先支援 `MANUAL` 或 `RANKING`

Phase 1 實作備註：

- 目前已落地的 `Knockout MVP` 骨架可自動升到最近 `2^n` 並補空位
- 但完整的 `seed -> bye -> 預賽` 正式規則仍應在下一輪補齊
- 換句話說，現有資料結構已可支援，差的是更正式的 bracket placement 規則與 UI 呈現

## League 資料流

### 建議流程

1. 場館建立 League 賽事
2. 會員報名 / 場館確認
3. 生成正式參賽者
4. 系統依 round-robin 生成 fixtures
5. 場館逐場記分
6. 每場完成後重算 standings
7. 同步回寫球手履歷與 `20+ break`

### League 額外要求

- standings tie-break 規則需固定：
  1. 積分
  2. frame diff
  3. frames won
  4. 對賽
  5. 抽籤 / 追加賽（之後再定）

## 建議最先實作的切入點

若下一輪正式開始做 code，最建議的第一刀是：

1. `TournamentParticipant`
2. `TournamentMatch`
3. `TournamentFrame`
4. `BreakRecord` 補 tournament match 關聯
5. `Knockout` 賽程生成 + match result recording

原因：

- 先打通正式比賽主鏈
- 一旦主鏈可用，履歷、排行榜、獎勵系統就有穩定資料來源
- 這比先做漂亮圖表或複雜分析更有實際價值
