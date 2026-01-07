// Generate a static redirect page for /admin/login under the frontend build
// It redirects users from the frontend domain to the backend's admin login
// Supports full backend URL (BACKEND_URL or BACKEND_HOST as a full URL),
// hostname (e.g. snookerhk.live), or Render subdomain (e.g. myapp -> myapp.onrender.com)

const fs = require('fs');
const path = require('path');

const backendUrlEnv = (process.env.BACKEND_URL || '').trim();
const backendHostEnv = (process.env.BACKEND_HOST || '').trim();

function stripTrailingSlash(s) {
  return s.replace(/\/+$/, '');
}

function resolveBackendBase() {
  if (backendUrlEnv) return backendUrlEnv;
  if (!backendHostEnv) return '';
  if (/^https?:\/\//i.test(backendHostEnv)) {
    // BACKEND_HOST provided as a full URL
    return backendHostEnv;
  }
  if (backendHostEnv.includes('.')) {
    // Treat as hostname (custom domain or full host like foo.onrender.com)
    return `https://${backendHostEnv}`;
  }
  // Treat as Render subdomain
  return `https://${backendHostEnv}.onrender.com`;
}

const backendBase = resolveBackendBase();
const targetUrl = backendBase ? `${stripTrailingSlash(backendBase)}/admin/login` : '/';

const outDir = path.join(__dirname, '..', 'frontend', 'public', 'admin', 'login');
fs.mkdirSync(outDir, { recursive: true });

const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Redirecting to Admin Login…</title>
    <meta http-equiv="refresh" content="0;url=${targetUrl}" />
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; margin: 24px; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <p>Redirecting to <a href="${targetUrl}">${targetUrl}</a> …</p>
    <script>location.replace(${JSON.stringify(targetUrl)});</script>
  </body>
</html>`;

fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
console.log('[generate-admin-redirect] Generated', path.join(outDir, 'index.html'), '->', targetUrl);