import React, { useCallback, useEffect, useState } from 'react';
import { API_URL } from './config';

const AdminAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');

  const tryAuthenticate = useCallback(async (tok: string): Promise<boolean> => {
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return true;
      }
    }
    const base = API_URL.replace(/\/$/, '');
    // Query-token GET (same-origin or proxied) — avoids preflight
    try {
      const fallbackUrl = `${base}/admin/overview?token=${encodeURIComponent(tok)}&format=json`;
      const res2 = await fetch(fallbackUrl, { method: 'GET', cache: 'no-store' });
      if (res2.ok) return true;
    } catch {}

    // Header-based auth (may trigger CORS preflight if cross-origin)
    try {
      const res = await fetch(`${base}/admin/overview`, {
        headers: { 'x-admin-token': tok },
        cache: 'no-store'
      });
      if (res.ok) return true;
    } catch {}

    return false;
  }, []);

  // Auto-auth with saved token if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('token') || '';
    const saved = localStorage.getItem('adminToken') || '';

    const tryToken = fromUrl || saved;
    if (!tryToken) return;
    (async () => {
      const ok = await tryAuthenticate(tryToken);
      if (ok) {
        if (fromUrl) localStorage.setItem('adminToken', fromUrl);
        setIsAuthenticated(true);
      }
    })();
  }, [tryAuthenticate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const ok = await tryAuthenticate(token);
      if (!ok) throw new Error('驗證失敗：請確認系統管理員密鑰或網路設定');
      localStorage.setItem('adminToken', token);
      setIsAuthenticated(true);
    } catch (err: any) {
      setError(err.message || '登入失敗');
    }
  };

  if (isAuthenticated) return <>{children}</>;

  return (
    <div className="brand-page p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center accent-yellow">系統管理員登入</h1>
        <form onSubmit={handleSubmit} className="glass rounded-xl p-8">
          <div className="mb-4">
            <label htmlFor="token" className="block text-sm font-medium mb-2 accent-blue">系統管理員密鑰</label>
            <input
              type="password"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-black/40 border border-white/10 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-blue)]"
            />
          </div>
          <button type="submit" className="w-full brand-button font-bold py-2 px-4 rounded transition-colors">
            進入
          </button>
          {error && <p className="text-red-500 mt-4 text-center">{error}</p>}
          <p className="text-gray-300/80 text-xs mt-4 text-center">提示：後端需設定環境變數 ADMIN_TOKEN；本地未設定時可直接通過。</p>
        </form>
      </div>
    </div>
  );
};

export default AdminAuth;
