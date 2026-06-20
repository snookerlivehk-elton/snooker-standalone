import React, { useCallback, useEffect, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  cancelTournamentSignup,
  closeClubTournament,
  confirmTournamentSignup,
  createClubTournament,
  getMyClubTournaments,
  getTournamentSignups,
  publishClubTournament,
  updateClubTournament,
} from '../../lib/api';

type VenueTournamentsModuleProps = {
  operatorId: string;
  enabled: boolean;
  className?: string;
};

const VenueTournamentsModule: React.FC<VenueTournamentsModuleProps> = ({
  operatorId,
  enabled,
  className = '',
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [guide, setGuide] = useState('');
  const [capacity, setCapacity] = useState('32');
  const [startsAt, setStartsAt] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [pendingRows, setPendingRows] = useState<any[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [confirmedRows, setConfirmedRows] = useState<any[]>([]);
  const [confirmedLoading, setConfirmedLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string, timeout = 2500) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), timeout);
  }, []);

  const resetEditor = useCallback(() => {
    setSelectedId('');
    setTitle('');
    setDescription('');
    setGuide('');
    setCapacity('32');
    setDeadline('');
    setStartsAt('');
    setPendingRows([]);
    setConfirmedRows([]);
  }, []);

  const loadRows = useCallback(async () => {
    if (!operatorId || !enabled) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const next = await getMyClubTournaments(API_URL, operatorId).catch(() => []);
      setRows(Array.isArray(next) ? next : []);
    } catch (e: any) {
      showNotice(e?.message || '載入比賽失敗', 3000);
    } finally {
      setLoading(false);
    }
  }, [enabled, operatorId, showNotice]);

  const loadSelectedSignups = useCallback(async () => {
    if (!operatorId || !enabled || !selectedId) {
      setPendingRows([]);
      setConfirmedRows([]);
      return;
    }
    setPendingLoading(true);
    setConfirmedLoading(true);
    try {
      const [pendingNext, confirmedNext] = await Promise.all([
        getTournamentSignups(API_URL, operatorId, selectedId, 'PENDING').catch(() => []),
        getTournamentSignups(API_URL, operatorId, selectedId, 'CONFIRMED').catch(() => []),
      ]);
      setPendingRows(Array.isArray(pendingNext) ? pendingNext : []);
      setConfirmedRows(Array.isArray(confirmedNext) ? confirmedNext : []);
    } catch (e: any) {
      showNotice(e?.message || '載入報名名單失敗', 3000);
    } finally {
      setPendingLoading(false);
      setConfirmedLoading(false);
    }
  }, [enabled, operatorId, selectedId, showNotice]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    loadSelectedSignups();
  }, [loadSelectedSignups]);

  if (!enabled) {
    return (
      <div className={`glass rounded-xl p-6 ${className}`.trim()}>
        <div className="text-xl font-bold mb-2">比賽報名（管理）</div>
        <div className="cue-muted text-sm">此功能未開通（可於系統功能上架設定中開啟）</div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl p-6 ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3 mb-4 border-b cue-border pb-2">
        <h2 className="text-xl font-bold">比賽報名（管理）</h2>
        <HelpGuide
          title="比賽報名（管理）"
          intro="建立、更新、上架或關閉比賽報名，並管理待確認報名與已確認名單。"
          steps={[
            '填寫標題、上限、截止日期、比賽時間（可選）、詳情與參賽指引後按「新增」。',
            '在下方列表可「選擇」某個比賽以查看報名名單。',
            '按「上架」讓會員端可見並可報名；按「關閉」停止報名與後續操作。',
            '在「待確認報名」可逐一確認/取消；在「已確認」可查看名單。',
          ]}
          tips={[
            '建議先完成內容後再上架，避免會員看到未完成資訊。',
            '如要在場館公開頁顯示比賽入口，請同時於場館公開設定開啟「公開比賽入口」。',
            '截止日期到期後可手動關閉，以免再有新報名。',
          ]}
        />
      </div>

      {notice ? <div className="mb-4 text-sm accent-yellow">{notice}</div> : null}

      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-3">
          <label className="block text-sm mb-1 cue-muted">標題</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：週末公開賽" />
        </div>
        <div className="md:col-span-1">
          <label className="block text-sm mb-1 cue-muted">上限</label>
          <input value={capacity} onChange={(e) => setCapacity(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="32" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">截止日期</label>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm mb-1 cue-muted">比賽時間（可選）</label>
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm mb-1 cue-muted">比賽詳情</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 rounded cue-input h-24" placeholder="輸入比賽詳情..." />
        </div>
        <div className="md:col-span-6">
          <label className="block text-sm mb-1 cue-muted">報名指引 / 流程（會員確認彈窗顯示）</label>
          <textarea value={guide} onChange={(e) => setGuide(e.target.value)} className="w-full px-3 py-2 rounded cue-input h-24" placeholder="例如：已提交報名，待場館確認；確認後請於 X 日前到場繳費..." />
        </div>
        <div className="md:col-span-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            className={`px-4 py-2 rounded font-semibold ${saving ? 'cue-surface-strong cue-muted' : 'brand-button text-black'}`}
            onClick={async () => {
              try {
                const trimmedTitle = String(title || '').trim();
                if (!trimmedTitle) throw new Error('請輸入標題');
                const cap = Number(capacity || 32);
                if (!Number.isFinite(cap) || cap <= 0) throw new Error('上限不正確');
                const deadlineIso = deadline ? new Date(`${deadline}T23:59:59`).toISOString() : null;
                const startsIso = startsAt ? new Date(startsAt).toISOString() : null;
                if (startsAt && !Number.isFinite(new Date(startsAt).getTime())) throw new Error('比賽時間格式不正確');
                if (deadline && !Number.isFinite(new Date(`${deadline}T23:59:59`).getTime())) throw new Error('截止日期格式不正確');
                setSaving(true);
                if (selectedId) {
                  await updateClubTournament(API_URL, operatorId, selectedId, {
                    title: trimmedTitle,
                    description,
                    signupGuide: guide,
                    capacity: Math.floor(cap),
                    startsAt: startsIso,
                    signupClosesAt: deadlineIso,
                  });
                  showNotice('已更新比賽');
                } else {
                  await createClubTournament(API_URL, operatorId, {
                    title: trimmedTitle,
                    description,
                    signupGuide: guide,
                    capacity: Math.floor(cap),
                    startsAt: startsIso,
                    signupClosesAt: deadlineIso,
                  });
                  showNotice('已建立比賽（草稿）');
                  resetEditor();
                }
                await loadRows();
              } catch (e: any) {
                showNotice(e?.message || '操作失敗', 3000);
              } finally {
                setSaving(false);
              }
            }}
          >
            {selectedId ? '更新' : '建立'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded cue-surface-strong hover:brightness-95 font-semibold"
            onClick={resetEditor}
          >
            清除
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded cue-surface hover:brightness-95 font-semibold"
            onClick={loadRows}
          >
            重新整理
          </button>
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="text-sm cue-muted">載入中...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm cue-muted">暫無比賽</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="cue-muted border-b cue-border">
                  <th className="py-2 px-2">狀態</th>
                  <th className="py-2 px-2">標題</th>
                  <th className="py-2 px-2">上限</th>
                  <th className="py-2 px-2">截止</th>
                  <th className="py-2 px-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((row: any) => {
                  const id = String(row?.id || '');
                  const status = String(row?.status || '').toUpperCase();
                  const capN = Number(row?.capacity ?? 0);
                  const confirmedN = Number(row?.confirmedCount ?? 0);
                  const cap = capN > 0 ? `${confirmedN}/${capN}` : '-';
                  const closes = row?.signupClosesAt ? new Date(row.signupClosesAt).toLocaleDateString() : '-';
                  const isSelected = selectedId && id === selectedId;
                  return (
                    <tr key={id} className={`border-b cue-border hover:brightness-95 ${isSelected ? 'bg-white/5' : ''}`}>
                      <td className="py-2 px-2 whitespace-nowrap">{status || '-'}</td>
                      <td className="py-2 px-2 font-semibold">{String(row?.title || '')}</td>
                      <td className="py-2 px-2">{cap}</td>
                      <td className="py-2 px-2">{closes}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                            onClick={() => {
                              setSelectedId(id);
                              setTitle(String(row?.title || ''));
                              setDescription(String(row?.description || ''));
                              setGuide(String(row?.signupGuide || ''));
                              setCapacity(String(row?.capacity ?? 32));
                              setDeadline(row?.signupClosesAt ? String(row.signupClosesAt).slice(0, 10) : '');
                              if (row?.startsAt) {
                                const d = new Date(String(row.startsAt));
                                if (Number.isFinite(d.getTime())) {
                                  const y = d.getFullYear();
                                  const m = String(d.getMonth() + 1).padStart(2, '0');
                                  const dd = String(d.getDate()).padStart(2, '0');
                                  const hh = String(d.getHours()).padStart(2, '0');
                                  const mm = String(d.getMinutes()).padStart(2, '0');
                                  setStartsAt(`${y}-${m}-${dd}T${hh}:${mm}`);
                                } else {
                                  setStartsAt('');
                                }
                              } else {
                                setStartsAt('');
                              }
                            }}
                          >
                            {isSelected ? '已選擇' : '選擇'}
                          </button>
                          <button
                            type="button"
                            disabled={status === 'PUBLISHED'}
                            className={`px-3 py-1 rounded text-sm font-semibold ${status === 'PUBLISHED' ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
                            onClick={async () => {
                              if (!confirm('確定要上架此比賽？')) return;
                              try {
                                await publishClubTournament(API_URL, operatorId, id);
                                await loadRows();
                                showNotice('已上架');
                              } catch (e: any) {
                                showNotice(e?.message || '上架失敗', 3000);
                              }
                            }}
                          >
                            上架
                          </button>
                          <button
                            type="button"
                            disabled={status === 'CLOSED'}
                            className={`px-3 py-1 rounded text-sm font-semibold ${status === 'CLOSED' ? 'cue-surface-strong cue-muted' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                            onClick={async () => {
                              if (!confirm('確定要關閉此比賽？')) return;
                              try {
                                await closeClubTournament(API_URL, operatorId, id);
                                await loadRows();
                                showNotice('已關閉');
                              } catch (e: any) {
                                showNotice(e?.message || '關閉失敗', 3000);
                              }
                            }}
                          >
                            關閉
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedId ? (
        <div className="mt-6 cue-surface-strong rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="font-semibold">待確認報名</div>
            <div className="text-xs cue-muted">{pendingLoading ? '讀取中…' : `${pendingRows.length} 筆`}</div>
          </div>
          {pendingLoading ? (
            <div className="text-sm cue-muted">讀取中…</div>
          ) : pendingRows.length === 0 ? (
            <div className="text-sm cue-muted">暫無待確認報名</div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="cue-muted border-b cue-border">
                    <th className="py-2 px-2">會員</th>
                    <th className="py-2 px-2">報名時間</th>
                    <th className="py-2 px-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.slice(0, 200).map((row: any) => {
                    const signupId = String(row?.id || '');
                    const member = row?.member || {};
                    const who = [String(member?.member_code || '無').trim(), String(member?.name || '').trim()].filter(Boolean).join(' ');
                    return (
                      <tr key={signupId} className="border-b cue-border hover:brightness-95">
                        <td className="py-2 px-2 font-semibold">{who || '-'}</td>
                        <td className="py-2 px-2 cue-muted whitespace-nowrap">{row?.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}</td>
                        <td className="py-2 px-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="px-3 py-1 rounded cue-button text-sm font-semibold"
                              onClick={async () => {
                                if (!confirm('確定要確認此報名？')) return;
                                try {
                                  await confirmTournamentSignup(API_URL, operatorId, selectedId, signupId);
                                  await Promise.all([loadSelectedSignups(), loadRows()]);
                                  showNotice('已確認');
                                } catch (e: any) {
                                  showNotice(e?.message || '確認失敗', 3000);
                                }
                              }}
                            >
                              確認
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-white text-sm font-semibold"
                              onClick={async () => {
                                if (!confirm('確定要取消此報名？')) return;
                                try {
                                  await cancelTournamentSignup(API_URL, operatorId, selectedId, signupId);
                                  await Promise.all([loadSelectedSignups(), loadRows()]);
                                  showNotice('已取消');
                                } catch (e: any) {
                                  showNotice(e?.message || '取消失敗', 3000);
                                }
                              }}
                            >
                              取消
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {selectedId ? (
        <div className="mt-4 cue-surface-strong rounded-lg p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="font-semibold">已成功報名（已確認）</div>
            <div className="text-xs cue-muted">{confirmedLoading ? '讀取中…' : `${confirmedRows.length} / ${Number(capacity || 0) || 32}`}</div>
          </div>
          {confirmedLoading ? (
            <div className="text-sm cue-muted">讀取中…</div>
          ) : confirmedRows.length === 0 ? (
            <div className="text-sm cue-muted">暫無已確認報名</div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="cue-muted border-b cue-border">
                    <th className="py-2 px-2">會員</th>
                    <th className="py-2 px-2">確認時間</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedRows.slice(0, 200).map((row: any) => {
                    const member = row?.member || {};
                    const who = [String(member?.member_code || '無').trim(), String(member?.name || '').trim()].filter(Boolean).join(' ');
                    return (
                      <tr key={String(row?.id || '')} className="border-b cue-border hover:brightness-95">
                        <td className="py-2 px-2 font-semibold">{who || '-'}</td>
                        <td className="py-2 px-2 cue-muted whitespace-nowrap">
                          {row?.updatedAt ? new Date(row.updatedAt).toLocaleString() : row?.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default VenueTournamentsModule;
