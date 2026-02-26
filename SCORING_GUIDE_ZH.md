# Snooker Standalone 計分系統說明（中文）

本文件整理程式庫中的斯諾克計分邏輯、UI 按鈕操作與記分規則，並特別說明「自由球」與「重置黑球加賽（搶黑模式）」等情境。文中提供直接連結到關聯程式碼，方便對照與維護。

## 系統概覽
- 核心狀態與規則：[State.ts](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts)
- 玩家統計模型：[Player.ts](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/Player.ts)
- 事件持久化與犯規總分：[RoomStorage.ts](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/RoomStorage.ts)
- 計分面板（UI 操作）：[Scoreboard.tsx](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx)
- 即時顯示視圖（Live）：[LiveView.tsx](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/LiveView.tsx)
- 前端路由定義：[App.tsx](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/App.tsx)

## 計分邏輯
- 進球（pot）
  - 邏輯入口：[pot](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L147-L187)
  - 紅/彩序列約束（紅→彩、彩→紅）：[State.ts:L191-L213](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L191-L213)
  - 清彩期序列檢查與結束判定：[State.ts:L203-L276](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L203-L276)
- 清彩期與自由選彩
  - 末紅入袋後立刻進入清彩期，下一桿享有一次「自由選彩」（不可紅，入袋後重置，不記入清彩序列）：[State.ts:L235-L243](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L235-L243), [State.ts:L249-L259](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L249-L259)
- 重置黑球加賽（搶黑模式）
  - 清彩至黑（黑=7）後若雙方同分，觸發重置黑球加賽，只能擊黑，入黑者勝局：[State.ts:L262-L271](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L262-L271), [State.ts:L217-L225](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L217-L225)
  - 加賽期若犯規或擊非黑球，直接判局給對手：[State.ts:L304-L311](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L304-L311)
- 自由球（Free Ball）
  - 切換旗標：[toggleFreeBall](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L289-L291)
  - 自由球入袋計分：
    - 紅球階段：任意彩球按 1 分計（不可選紅），入袋後消耗自由球、下一桿需擊彩：[State.ts:L156-L171](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L156-L171), [State.ts:L228-L234](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L228-L234)
    - 清彩階段：依當前應擊彩球之分值計分（例如黃=2、綠=3…），入袋後消耗自由球：[State.ts:L160-L165](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L160-L165)
- 犯規（Foul）
  - 一般犯規：對手得分為 max(4, 被擊彩球分值)，結束本桿、換人，並標記 foul 狀態以便宣告自由球可能性：[State.ts:L293-L346](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L293-L346)
  - 犯規紅球（Foul Red）：一次犯規中誤入紅球 n 顆，扣除相應紅球餘數，對手固定得 4 分；結束本桿並換人：[State.ts:L348-L396](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L348-L396)
  - 末黑犯規：直接判局給對手：[State.ts:L293-L302](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L293-L302)
- 讓分（Handicap）
  - 淨讓分計算與套用：開局與新局開始時按「淨讓分」將分數加到受讓者，另一方為 0：[State.ts:L129-L136](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L129-L136), [State.ts:L508-L514](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L508-L514), [State.ts:L534-L564](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L534-L564)
- 高桿與回合（Break）
  - 本桿分數達 20 以上，遇到犯規/換人時記錄至高桿列表：[State.ts:L313-L317](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L313-L317), [State.ts:L469-L474](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L469-L474)
- 剩餘分數（Remaining Points）
  - 計算方法：紅球每顆可得 1+7（紅+黑），加上臺面尚未清掉的彩球分值總和：[State.ts:L688-L701](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L688-L701)

## UI 按鈕功能
- 球按鈕（1..7）
  - 禁用邏輯包含：紅/彩序列約束、清彩期自由選彩、重置黑球僅允許黑球、自由球規則（紅球階段不可選紅；清彩期依序或自由選）：[Scoreboard.tsx 手機簡版](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L700-L731), [Scoreboard.tsx 桌面版](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L846-L879)
- 犯規按鈕（4/5/6/7）
  - 依對應分值記錄犯規事件並累計犯規總分：[Scoreboard.tsx:L904-L911](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L904-L911), [Scoreboard.tsx:L276-L292](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L276-L292)
- Miss / Safety / Concede
  - 分別對應失誤、防守與讓局，並更新狀態與事件流：[Scoreboard.tsx:L563-L591](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L563-L591), [Scoreboard.tsx:L548-L561](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L548-L561)
- Free Ball 開關
  - 只有在「剛發生犯規」時顯示，切換自由球旗標並記錄事件：[Scoreboard.tsx:L768-L781](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L768-L781), [Scoreboard.tsx:L915-L923](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L915-L923), [Scoreboard.tsx:L593-L604](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L593-L604)
- Switch Player / Undo
  - 換人：重置本桿、取消自由球，並記錄事件：[Scoreboard.tsx:L350-L362](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L350-L362)
  - 撤銷：回退一筆事件與一個狀態快照，若事件為犯規則回退犯規總分：[Scoreboard.tsx:L364-L377](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L364-L377)
- 同桿多紅球 / 紅球餘數調整
  - 同桿紅球 ×2/×3（僅在需擊紅且紅球仍在時可用）：[Scoreboard.tsx:L926-L943](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L926-L943), 對應邏輯：[State.ts:L398-L435](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L398-L435)
  - 調整紅球餘數（管理用，不影響分數）：[Scoreboard.tsx:L944-L962](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L944-L962), 對應邏輯：[State.ts:L671-L686](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts#L671-L686)
- Frame Over 操作
  - 終局/整場結束的覆蓋層（上傳或開啟下一局）：[Scoreboard.tsx:L966-L1066](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx#L966-L1066)

## 記分規則摘要
- 紅球=1 分；彩球依序黃=2、綠=3、咖啡=4、藍=5、粉=6、黑=7。
- 紅球階段：紅→彩→紅→彩…；彩球入袋後重置。
- 清彩期：按黃→綠→咖啡→藍→粉→黑依序入袋。
- 末紅後的第一桿可自由選彩（不可紅），入袋後彩球重置，不記入清彩序列。
- 自由球：
  - 紅球階段：只能選彩球，入袋算 1 分；入袋後需擊彩。
  - 清彩階段：按應擊彩球分值計分；入袋後消耗自由球。
- 犯規：
  - 一般犯規：對手得分為 max(4, 被擊彩球分值)，結束本桿並換人。
  - 犯規紅球：一次犯規誤入紅球 n 顆，扣紅球餘數 n，對手固定得 4 分。
  - 末黑或重置黑球期犯規：直接判局給對手。
- 重置黑球加賽（搶黑）：清彩至黑後如同分，僅能擊黑；入黑者勝局；擊非黑屬犯規直接判局給對手。
- 讓分：以「淨讓分」邏輯在每局開始時套用至受讓者分數。

## 事件與儲存
- 事件型別與本地存取：[RoomStorage.ts](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/RoomStorage.ts)
  - 記錄 pot/foul/miss/safe/switch/newFrame/concede/freeBallToggle 等事件。
  - 累計 foulTotals（犯規總分），並在撤銷時回退相應分數。
  - 支援序列化整個 State 以便無後端模式下的持久化。

## 路由對應
- 計分面板（Scoreboard）：`/room/:roomId` → [App.tsx](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/App.tsx#L49)
- 建立賽事（Setup）：`/room/:roomId/setup` → [App.tsx](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/App.tsx#L50)
- 即時視圖（Live）：`/room/:roomId/live` → [App.tsx](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/App.tsx#L51)
- 疊加顯示（Overlay）：`/room/:roomId/overlay` → [App.tsx](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/App.tsx#L52)

## 參考與維護建議
- 若需調整規則（例如自由球在特定聯賽的差異），建議統一在 [State.ts](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/State.ts) 調整並同步更新按鈕禁用邏輯於 [Scoreboard.tsx](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/Scoreboard.tsx)。
- 任何能導致事件記錄差異的改動，請同時維護 [RoomStorage.ts](file:///c:/Users/User/.trae/snooker-standalone/frontend/src/lib/RoomStorage.ts) 的累計與撤銷邏輯。

