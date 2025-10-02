# Railway 設定摘要（bun-service）

- Root Directory：`snooker-standalone/bun-service`
- Build Command：`bun install`
- Start Command：`bun run start`
- Health Check：HTTP 路徑 `/api/health`

備註：`PORT` 由 Railway 自動注入；程式會使用 `process.env.PORT ?? 3000`。