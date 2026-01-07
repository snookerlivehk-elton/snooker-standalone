// Lightweight write-token resolver for write-auth on backend
// Sources (priority): URL param `writeToken` -> localStorage `writeToken` -> env `VITE_WRITE_TOKEN`
export function getWriteToken(): string | undefined {
  try {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const fromParam = params?.get('writeToken') || undefined;
    const stored = typeof window !== 'undefined' ? (window.localStorage.getItem('writeToken') || undefined) : undefined;
    const fromEnv = (import.meta.env.VITE_WRITE_TOKEN as string | undefined);
    const token = fromParam || stored || fromEnv;
    // Persist URL-provided token for subsequent navigations
    if (fromParam && typeof window !== 'undefined') {
      try { window.localStorage.setItem('writeToken', fromParam); } catch {}
    }
    return token || undefined;
  } catch {
    return undefined;
  }
}