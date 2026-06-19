# 舊計分系統封存說明

本檔案原本記錄舊版 `Scoreboard`、`Setup`、`LiveView`、`Overlay` 與房間同步流程的操作與規則。

自 `2026-06` 起，該整套功能已永久移除，包括：

- 前端路由：`/rooms`、`/room/:roomId`、`/room/:roomId/setup`、`/room/:roomId/live`、`/room/:roomId/overlay`
- 前端模組：`Scoreboard.tsx`、`Setup.tsx`、`LiveView.tsx`、`Overlay.tsx`
- 前端狀態層：`State.ts`、`RoomStorage.ts`、`StatsEngine.ts`
- 後端 API：房間管理、舊 match write、invite 與 websocket 即時同步
- 資料庫層：`Room`、`RoomCodeSequence`、`MatchInvite` 與舊逐球事件相關表

## 現況

目前系統以以下模組為主：

- 會員入口與會員中心
- 球會後台管理
- 預約、QR session、積分與排行榜
- 新聞與球會內容管理
- 歷史比賽與高桿資料查閱

## 維護原則

- 請不要再依照舊計分流程文件實作或部署任何 `/room/*`、`socket.io`、`write token` 相關功能。
- 如日後需要重新加入計分功能，應以新需求重新設計，不應回復或參照舊房間架構。
