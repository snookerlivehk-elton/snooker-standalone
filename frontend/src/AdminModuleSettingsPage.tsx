import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_URL } from './config';
import { getAdminModuleSettings, updateAdminModuleSettings } from './lib/api';
import { getModuleSettingsOverviewTab, getModuleSettingsPageConfig } from './admin/moduleSettingsRegistry';

function resolveToken(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('token') || localStorage.getItem('adminToken') || '';
  } catch {
    return localStorage.getItem('adminToken') || '';
  }
}

const AdminModuleSettingsPage: React.FC = () => {
  const { moduleCode = '' } = useParams();
  const config = getModuleSettingsPageConfig(moduleCode);
  const overviewTab = getModuleSettingsOverviewTab(moduleCode);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, any>>(config?.defaultSettings || {});

  async function load() {
    if (!config) {
      setLoading(false);
      setError('此模組未提供獨立設定頁');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const tok = resolveToken();
      const out = await getAdminModuleSettings<Record<string, any>>(API_URL, tok, config.moduleCode);
      setDraft(out?.settings || config.defaultSettings);
    } catch (e: any) {
      setError(e?.message || config.loadErrorMessage);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setDraft(config?.defaultSettings || {});
    load();
  }, [moduleCode]);

  async function save() {
    if (!config) return;
    setSaveResult(null);
    setSaving(true);
    try {
      const tok = resolveToken();
      const out = await updateAdminModuleSettings<Record<string, any>>(API_URL, tok, config.moduleCode, draft);
      setDraft(out?.settings || draft);
      setSaveResult(config.saveSuccessMessage);
    } catch (e: any) {
      setSaveResult(e?.message || '儲存失敗');
    } finally {
      setSaving(false);
    }
  }

  const overviewPath = `/admin/overview?${new URLSearchParams({
    ...(resolveToken() ? { token: resolveToken() } : {}),
    tab: overviewTab,
  }).toString()}`;

  return (
    <div className="brand-page min-h-screen p-4 sm:p-6">
      <div className="w-full max-w-4xl mx-auto glass rounded-xl p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold accent-yellow">{config?.title || '模組設定（Super Admin）'}</h1>
            <div className="text-sm cue-muted mt-1">{config?.description || '此模組未提供可編輯設定。'}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={overviewPath}
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
            >
              返回系統管理
            </Link>
            <button
              type="button"
              className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm font-semibold"
              onClick={() => load()}
              disabled={loading || !config}
            >
              重新整理
            </button>
          </div>
        </div>

        {loading ? <div className="mt-4 text-sm cue-muted">讀取中…</div> : null}
        {!loading && error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}
        {saveResult ? <div className="mt-4 text-sm cue-muted">{saveResult}</div> : null}

        {!loading && !error && config ? (
          <div className="mt-5 space-y-5">
            {config.sections.map((section, index) => (
              <div key={`${section.type}-${index}`} className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-4">
                <div>
                  <div className="text-lg font-bold">{section.title}</div>
                  <div className="text-sm cue-muted mt-1">{section.description}</div>
                </div>

                {section.type === 'requirement' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-start gap-3 bg-black/30 border border-white/10 rounded px-3 py-3">
                      <input
                        type="radio"
                        name={section.field}
                        checked={draft[section.field] === 'BASIC_MEMBER'}
                        onChange={() => setDraft((prev) => ({ ...prev, [section.field]: 'BASIC_MEMBER' }))}
                      />
                      <div>
                        <div className="font-semibold">{section.basicLabel}</div>
                        <div className="text-xs cue-muted mt-1">{section.basicDescription}</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 bg-black/30 border border-white/10 rounded px-3 py-3">
                      <input
                        type="radio"
                        name={section.field}
                        checked={draft[section.field] === 'VERIFIED_MEMBER'}
                        onChange={() => setDraft((prev) => ({ ...prev, [section.field]: 'VERIFIED_MEMBER' }))}
                      />
                      <div>
                        <div className="font-semibold">{section.verifiedLabel}</div>
                        <div className="text-xs cue-muted mt-1">{section.verifiedDescription}</div>
                      </div>
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {section.toggles.map((item) => (
                      <label key={item.field} className="flex items-center justify-between gap-3 bg-black/30 border border-white/10 rounded px-3 py-3">
                        <div>
                          <div className="text-sm">{item.label}</div>
                          {item.description ? <div className="text-xs cue-muted mt-1">{item.description}</div> : null}
                        </div>
                        <input
                          type="checkbox"
                          checked={draft[item.field] === true}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [item.field]: e.target.checked }))}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

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

export default AdminModuleSettingsPage;
