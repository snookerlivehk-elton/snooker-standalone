import React, { useEffect, useState } from 'react';
import { API_URL } from './config';

const AdminOverview: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  function resolveToken(): string {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('token') || localStorage.getItem('adminToken') || '';
    } catch {
      return localStorage.getItem('adminToken') || '';
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchOverview() {
      setLoading(true);
      setError(null);
      const tok = resolveToken();
      try {
        // Prefer query param to avoid CORS preflight when跨網域
        const url = `${API_URL.replace(/\/$/, '')}/admin/overview?token=${encodeURIComponent(tok)}&format=json`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          // Try header-based
          const res2 = await fetch(`${API_URL.replace(/\/$/, '')}/admin/overview`, {
            headers: { 'x-admin-token': tok },
            cache: 'no-store'
          });
          if (!res2.ok) {
            const err = await res2.json().catch(() => ({}));
            throw new Error(err.error || `載入失敗 (${res2.status})`);
          }
          const json2 = await res2.json();
          if (!cancelled) setData(json2);
        } else {
          const json = await res.json();
          if (!cancelled) setData(json);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '載入失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchOverview();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-gray-900 text-white p-8">載入中...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-gray-900 text-white p-8">錯誤：{error}</div>;
  }

  return (
    <div className="brand-page p-8">
      <div className="max-w-3xl mx-auto glass rounded-xl p-6">
        <h1 className="text-2xl font-bold mb-4 accent-yellow">系統概覽</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/40 border border-white/10 rounded p-4">
            <div className="text-sm text-gray-300/80">狀態</div>
            <div className="text-lg">{data?.status || '-'}</div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-4">
            <div className="text-sm text-gray-300/80">埠</div>
            <div className="text-lg">{data?.port}</div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-4">
            <div className="text-sm text-gray-300/80">上線時間（秒）</div>
            <div className="text-lg">{Math.floor(data?.uptime || 0)}</div>
          </div>
          <div className="bg-black/40 border border-white/10 rounded p-4">
            <div className="text-sm text-gray-300/80">資料庫會員數</div>
            <div className="text-lg">{data?.db?.members ?? '-'}</div>
          </div>
        </div>
        <div className="mt-6">
          <div className="text-sm text-gray-300/80">CORS Origins</div>
          <pre className="text-xs bg-black/40 border border-white/10 rounded p-3 whitespace-pre-wrap break-all">{JSON.stringify(data?.corsOrigins, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
