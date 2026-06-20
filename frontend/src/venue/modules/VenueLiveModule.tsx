import React, { useCallback, useEffect, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  createLiveAnnouncement,
  deleteLiveAnnouncement,
  getLiveAnnouncements,
  updateLiveAnnouncement,
} from '../../lib/api';

type VenueLiveModuleProps = {
  operatorId: string;
  enabled: boolean;
  className?: string;
};

function normalizeVideoHref(raw: any): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s}`;
}

const VenueLiveModule: React.FC<VenueLiveModuleProps> = ({ operatorId, enabled, className = '' }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveDate, setLiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [liveTime, setLiveTime] = useState(() => `${String(new Date().getHours()).padStart(2, '0')}:00`);
  const [liveUrl, setLiveUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string, timeout = 2500) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), timeout);
  }, []);

  const loadRows = useCallback(async () => {
    if (!operatorId || !enabled) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const next = await getLiveAnnouncements(API_URL, operatorId).catch(() => []);
      setRows(Array.isArray(next) ? next : []);
    } catch (e: any) {
      showNotice(e?.message || '載入直播通告失敗', 3000);
    } finally {
      setLoading(false);
    }
  }, [enabled, operatorId, showNotice]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  if (!enabled) {
    return (
      <div className={`glass rounded-xl p-6 ${className}`.trim()}>
        <div className="text-xl font-bold mb-2">比賽直播通告</div>
        <div className="cue-muted text-sm">此功能未開通</div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl p-6 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
        <h2 className="text-xl font-bold">比賽直播通告</h2>
        <HelpGuide
          title="比賽直播通告"
          intro="建立/更新直播通告，發佈後會推送到會員，並可按場館公開設定選擇是否在公開頁顯示。"
          steps={[
            '填寫日期、時間、標題及直播連結。',
            '按「發佈」建立通告；如已在編輯模式，按「更新」保存修改。',
            '在下方列表可按「編輯」載入回上方表單，或按「刪除」移除通告。',
          ]}
          tips={[
            '直播連結建議使用可直接開啟的 https:// URL。',
            '如要讓非會員亦可在場館公開頁看到直播入口，請同時於場館公開設定開啟「公開直播訊息」。',
            '刪除通告後，已推送的訊息仍可能保留在會員端歷史（視乎會員是否已刪除）。',
          ]}
        />
      </div>

      {notice ? <div className="mb-4 text-sm accent-yellow">{notice}</div> : null}

      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">日期</label>
          <input type="date" value={liveDate} onChange={(e) => setLiveDate(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">時間</label>
          <input type="time" value={liveTime} onChange={(e) => setLiveTime(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">標題</label>
          <input value={liveTitle} onChange={(e) => setLiveTitle(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：週末友誼賽直播" />
        </div>
        <div className="md:col-span-5">
          <label className="block text-sm mb-1 cue-muted">直播連結</label>
          <input value={liveUrl} onChange={(e) => setLiveUrl(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="https://..." />
          <div className="text-xs cue-muted mt-1">發佈後會同時以「場館訊息」推送，會員可直接點擊連結觀看。</div>
        </div>
        <div className="md:col-span-1 flex items-end">
          <button
            type="button"
            disabled={saving}
            className="w-full px-4 py-2 rounded brand-button text-black transition-colors disabled:opacity-60"
            onClick={async () => {
              try {
                const title = liveTitle.trim();
                const url = liveUrl.trim();
                if (!title) throw new Error('請輸入標題');
                if (!url) throw new Error('請輸入直播連結');
                if (!liveDate || !liveTime) throw new Error('請選擇日期及時間');
                const startsAt = new Date(`${liveDate}T${liveTime}:00`);
                if (!Number.isFinite(startsAt.getTime())) throw new Error('日期/時間格式不正確');
                setSaving(true);
                if (editingId) {
                  await updateLiveAnnouncement(API_URL, operatorId, editingId, {
                    title,
                    startsAt: startsAt.toISOString(),
                    liveUrl: url,
                  });
                  showNotice('已更新直播通告');
                } else {
                  await createLiveAnnouncement(API_URL, operatorId, {
                    title,
                    startsAt: startsAt.toISOString(),
                    liveUrl: url,
                  });
                  showNotice('已發佈直播通告');
                }
                setLiveTitle('');
                setLiveUrl('');
                setEditingId('');
                await loadRows();
              } catch (e: any) {
                showNotice(e?.message || '發佈失敗', 3000);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? '處理中…' : editingId ? '更新' : '發佈'}
          </button>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="text-sm cue-muted">載入中...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm cue-muted">暫無直播通告</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="cue-muted border-b cue-border">
                  <th className="py-2 px-2">日期時間</th>
                  <th className="py-2 px-2">標題</th>
                  <th className="py-2 px-2">連結</th>
                  <th className="py-2 px-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((it: any) => (
                  <tr key={String(it?.id || '')} className="border-b cue-border hover:brightness-95">
                    <td className="py-2 px-2 cue-muted whitespace-nowrap">{it?.startsAt ? new Date(it.startsAt).toLocaleString() : '-'}</td>
                    <td className="py-2 px-2 font-semibold">{String(it?.title || '')}</td>
                    <td className="py-2 px-2">
                      {normalizeVideoHref(it?.liveUrl) ? (
                        <a href={normalizeVideoHref(it?.liveUrl) as string} target="_blank" rel="noreferrer" className="accent-blue underline">
                          直播連結
                        </a>
                      ) : (
                        <span className="cue-muted">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                          onClick={() => {
                            setEditingId(String(it?.id || ''));
                            setLiveTitle(String(it?.title || ''));
                            setLiveUrl(String(it?.liveUrl || ''));
                            const d = it?.startsAt ? new Date(String(it.startsAt)) : null;
                            if (d && Number.isFinite(d.getTime())) {
                              setLiveDate(d.toISOString().slice(0, 10));
                              setLiveTime(d.toTimeString().slice(0, 5));
                            }
                          }}
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm"
                          onClick={async () => {
                            if (!confirm('確定要刪除此直播通告？')) return;
                            try {
                              await deleteLiveAnnouncement(API_URL, operatorId, String(it?.id || ''));
                              if (editingId && String(it?.id || '') === editingId) {
                                setEditingId('');
                                setLiveTitle('');
                                setLiveUrl('');
                              }
                              await loadRows();
                              showNotice('已刪除');
                            } catch (e: any) {
                              showNotice(e?.message || '刪除失敗', 3000);
                            }
                          }}
                        >
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 50 ? <div className="text-xs cue-muted mt-2">只顯示最近 50 筆</div> : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueLiveModule;
