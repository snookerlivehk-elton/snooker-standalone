import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from './config';
import { getAdminModuleSettings, updateAdminModuleSettings, type BookingModuleSettings } from './lib/api';

function resolveToken(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || localStorage.getItem('adminToken') || '';
  } catch {
    return localStorage.getItem('adminToken') || '';
  }
}

const DEFAULT_SETTINGS: BookingModuleSettings = {
  bookingCreateRequirement: 'VERIFIED_MEMBER',
  reservationCreatedEmailEnabled: false,
  reservationConfirmedEmailEnabled: false,
  reservationCancelledEmailEnabled: false,
};

const AdminBookingSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [draft, setDraft] = useState<BookingModuleSettings>(DEFAULT_SETTINGS);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const tok = resolveToken();
      const out = await getAdminModuleSettings(API_URL, tok, 'booking');
      setDraft(out?.settings || DEFAULT_SETTINGS);
    } catch (e: any) {
      setError(e?.message || '讀取 booking 模組設定失敗');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaveResult(null);
    setSaving(true);
    try {
      const tok = resolveToken();
      const out = await updateAdminModuleSettings(API_URL, tok, 'booking', draft);
      setDraft(out?.settings || draft);
      setSaveResult('已儲存 booking 模組設定');
    } catch (e: any) {
      setSaveResult(e?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="brand-page min-h-screen p-4 sm:p-6">
      <div className="w-full max-w-4xl mx-auto glass rounded-xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold accent-yellow">Booking 模組設定（Super Admin）</h1>
            <div className="text-sm cue-muted mt-1">集中管理預約建立的會員資格要求，以及 booking 事件的 email 通知策略。</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/admin/modules${resolveToken() ? `?token=${encodeURIComponent(resolveToken())}` : ''}`}
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
            >
              返回模組中心
            </Link>
            <button
              type="button"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              onClick={() => load()}
              disabled={loading}
            >
              重新整理
            </button>
          </div>
        </div>

        {loading ? <div className="mt-4 text-sm cue-muted">讀取中…</div> : null}
        {!loading && error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}
        {saveResult ? <div className="mt-4 text-sm cue-muted">{saveResult}</div> : null}

        {!loading && !error ? (
          <div className="mt-5 space-y-5">
            <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
              <div>
                <div className="text-lg font-bold">會員資格要求</div>
                <div className="text-sm cue-muted mt-1">控制會員建立預約時，最少需要甚麼等級的會員身份。</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-3 bg-black/30 border border-white/10 rounded px-3 py-3">
                  <input
                    type="radio"
                    name="bookingCreateRequirement"
                    checked={draft.bookingCreateRequirement === 'BASIC_MEMBER'}
                    onChange={() => setDraft((prev) => ({ ...prev, bookingCreateRequirement: 'BASIC_MEMBER' }))}
                  />
                  <div>
                    <div className="font-semibold">普通會員</div>
                    <div className="text-xs cue-muted mt-1">只要已登入會員即可建立預約，不要求 email 驗證。</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 bg-black/30 border border-white/10 rounded px-3 py-3">
                  <input
                    type="radio"
                    name="bookingCreateRequirement"
                    checked={draft.bookingCreateRequirement === 'VERIFIED_MEMBER'}
                    onChange={() => setDraft((prev) => ({ ...prev, bookingCreateRequirement: 'VERIFIED_MEMBER' }))}
                  />
                  <div>
                    <div className="font-semibold">認證會員</div>
                    <div className="text-xs cue-muted mt-1">會員必須完成 email 驗證，才可建立預約。</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
              <div>
                <div className="text-lg font-bold">Email 通知設定</div>
                <div className="text-sm cue-muted mt-1">控制新預約先通知場館確認，並在場館確認後通知預約會員本人。</div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-3">
                  <span className="text-sm">新預約申請後通知場館</span>
                  <input
                    type="checkbox"
                    checked={draft.reservationCreatedEmailEnabled}
                    onChange={(e) => setDraft((prev) => ({ ...prev, reservationCreatedEmailEnabled: e.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-3">
                  <span className="text-sm">場館確認後通知預約會員</span>
                  <input
                    type="checkbox"
                    checked={draft.reservationConfirmedEmailEnabled}
                    onChange={(e) => setDraft((prev) => ({ ...prev, reservationConfirmedEmailEnabled: e.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-3">
                  <span className="text-sm">預約取消後通知預約會員</span>
                  <input
                    type="checkbox"
                    checked={draft.reservationCancelledEmailEnabled}
                    onChange={(e) => setDraft((prev) => ({ ...prev, reservationCancelledEmailEnabled: e.target.checked }))}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => save()}
                disabled={saving}
                className={`px-4 py-2 rounded font-semibold ${saving ? 'cue-surface cue-muted' : 'cue-button'}`}
              >
                {saving ? '儲存中…' : '儲存設定'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AdminBookingSettings;
