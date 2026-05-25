import React, { useEffect, useState } from 'react';
import { API_URL } from './config';
import { getSiteNotice, updateSiteNotice } from './lib/api';

const AdminOverview: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [noticeLoading, setNoticeLoading] = useState<boolean>(true);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [noticeDraft, setNoticeDraft] = useState<{ enabled: boolean; message: string; youtubeEmbedUrl: string }>({
    enabled: true,
    message: '',
    youtubeEmbedUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);

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

      try {
        if (!cancelled) {
          setNoticeLoading(true);
          setNoticeError(null);
        }
        const row = await getSiteNotice(API_URL);
        if (!cancelled) {
          setNoticeDraft({
            enabled: row?.enabled !== false,
            message: String(row?.message || ''),
            youtubeEmbedUrl: String(row?.youtubeEmbedUrl || ''),
          });
        }
      } catch (e: any) {
        if (!cancelled) setNoticeError(e?.message || '讀取公告失敗');
      } finally {
        if (!cancelled) setNoticeLoading(false);
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

        <div className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <div className="text-lg font-bold">全站公告</div>
            <button
              type="button"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              disabled={saving}
              onClick={async () => {
                setSaveResult(null);
                setSaving(true);
                try {
                  const tok = resolveToken();
                  await updateSiteNotice(API_URL, tok, {
                    enabled: noticeDraft.enabled,
                    message: noticeDraft.message,
                    youtubeEmbedUrl: noticeDraft.youtubeEmbedUrl.trim() ? noticeDraft.youtubeEmbedUrl.trim() : null,
                  });
                  setSaveResult('已儲存');
                } catch (e: any) {
                  setSaveResult(e?.message || '儲存失敗');
                } finally {
                  setSaving(false);
                }
              }}
            >
              儲存
            </button>
          </div>
          {noticeLoading && <div className="text-sm cue-muted mt-2">讀取中…</div>}
          {!noticeLoading && noticeError && <div className="text-sm text-red-500 mt-2">{noticeError}</div>}
          {!noticeLoading && !noticeError && (
            <div className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={noticeDraft.enabled}
                  onChange={(e) => setNoticeDraft((s) => ({ ...s, enabled: e.target.checked }))}
                />
                <span>啟用公告</span>
              </label>
              <div>
                <div className="text-sm cue-muted mb-1">公告內容</div>
                <textarea
                  value={noticeDraft.message}
                  onChange={(e) => setNoticeDraft((s) => ({ ...s, message: e.target.value }))}
                  rows={5}
                  className="w-full cue-input rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <div className="text-sm cue-muted mb-1">YouTube Embed URL（可選）</div>
                <input
                  value={noticeDraft.youtubeEmbedUrl}
                  onChange={(e) => setNoticeDraft((s) => ({ ...s, youtubeEmbedUrl: e.target.value }))}
                  className="w-full cue-input rounded px-3 py-2 text-sm"
                  placeholder="例如：https://www.youtube.com/embed/xxxxxxxx"
                />
              </div>
              {saveResult && <div className="text-sm cue-muted">{saveResult}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
