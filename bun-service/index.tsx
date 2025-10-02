import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/*', cors());
app.get('/', (c) => c.text('Hello world!'));
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Bun runtime
// @ts-ignore
Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
});