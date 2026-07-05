export async function sendEmailIfConfigured(options: {
  to: string;
  subject: string;
  html: string;
}) {
  const resendApiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.RESEND_FROM_EMAIL || '').trim();
  const to = String(options.to || '').trim();
  if (!resendApiKey || !from || !to) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: options.subject,
      html: options.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[email] Resend request failed', {
      status: res.status,
      statusText: res.statusText,
      body,
      to,
      subject: options.subject,
    });
  }
}

export function resolveWebAppBaseUrl() {
  const raw = String(
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    process.env.WEB_APP_URL ||
    'https://www.snookerhk.live',
  ).trim();
  return raw.replace(/\/+$/, '') || 'https://www.snookerhk.live';
}

export function buildWebAppUrl(path: string) {
  const base = resolveWebAppBaseUrl();
  const suffix = String(path || '/').startsWith('/') ? String(path || '/') : `/${String(path || '')}`;
  return `${base}${suffix}`;
}
