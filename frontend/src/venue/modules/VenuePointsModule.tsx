import React, { useCallback, useEffect, useMemo, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  adjustClubMemberPoints,
  getClubPointsLedger,
  getMyClubFeatureAccess,
  searchClubPointsBalances,
} from '../../lib/api';
import { useFeatureEnabled } from '../../lib/features';

type VenuePointsModuleProps = {
  operatorId: string;
  enabled?: boolean;
  accessLoaded?: boolean;
  className?: string;
};

const VenuePointsModule: React.FC<VenuePointsModuleProps> = ({
  operatorId,
  enabled: enabledOverride,
  accessLoaded: accessLoadedOverride,
  className = '',
}) => {
  const { enabled: pointsGlobalEnabled } = useFeatureEnabled(API_URL, 'points');
  const [localAccessLoaded, setLocalAccessLoaded] = useState(false);
  const [localPointsEnabled, setLocalPointsEnabled] = useState(false);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [pointsAdjustMemberQuery, setPointsAdjustMemberQuery] = useState('');
  const [pointsAdjustMemberOptions, setPointsAdjustMemberOptions] = useState<any[]>([]);
  const [pointsAdjustMemberLoading, setPointsAdjustMemberLoading] = useState(false);
  const [pointsAdjustMemberId, setPointsAdjustMemberId] = useState('');
  const [pointsAdjustDelta, setPointsAdjustDelta] = useState('');
  const [pointsAdjustReason, setPointsAdjustReason] = useState('');
  const [pointsBalanceQuery, setPointsBalanceQuery] = useState('');
  const [pointsBalanceRows, setPointsBalanceRows] = useState<any[]>([]);
  const [pointsBalanceLoading, setPointsBalanceLoading] = useState(false);
  const [pointsLedgerMode, setPointsLedgerMode] = useState<'detail' | 'month'>('detail');
  const [pointsLedgerRows, setPointsLedgerRows] = useState<any[]>([]);
  const [pointsLedgerLoading, setPointsLedgerLoading] = useState(false);
  const [pointsLedgerTotalDelta, setPointsLedgerTotalDelta] = useState(0);
  const [pointsLedgerMemberId, setPointsLedgerMemberId] = useState('');
  const [pointsLedgerFrom, setPointsLedgerFrom] = useState('');
  const [pointsLedgerTo, setPointsLedgerTo] = useState('');
  const [pointsLedgerMonth, setPointsLedgerMonth] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = useCallback((message: string, timeout = 2500) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), timeout);
  }, []);

  const accessLoaded = typeof accessLoadedOverride === 'boolean' ? accessLoadedOverride : localAccessLoaded;
  const pointsEnabled = useMemo(() => {
    if (typeof enabledOverride === 'boolean') return enabledOverride;
    return pointsGlobalEnabled && localPointsEnabled;
  }, [enabledOverride, localPointsEnabled, pointsGlobalEnabled]);

  useEffect(() => {
    if (typeof enabledOverride === 'boolean' || typeof accessLoadedOverride === 'boolean') return;
    if (!operatorId) {
      setLocalAccessLoaded(true);
      setLocalPointsEnabled(false);
      return;
    }
    if (!pointsGlobalEnabled) {
      setLocalAccessLoaded(true);
      setLocalPointsEnabled(false);
      return;
    }
    let mounted = true;
    setLocalAccessLoaded(false);
    getMyClubFeatureAccess(API_URL, operatorId)
      .then((res) => {
        if (!mounted) return;
        const features = ((res as any)?.features && typeof (res as any).features === 'object') ? (res as any).features : {};
        setLocalPointsEnabled(Boolean(features.points?.effectiveEnabled));
      })
      .catch(() => {
        if (!mounted) return;
        setLocalPointsEnabled(false);
      })
      .finally(() => {
        if (!mounted) return;
        setLocalAccessLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [accessLoadedOverride, enabledOverride, operatorId, pointsGlobalEnabled]);

  const loadPointsData = useCallback(async () => {
    if (!operatorId || !pointsEnabled) return;
    setPointsLoading(true);
    try {
      setPointsLedgerMode('detail');
      const res = await getClubPointsLedger(API_URL, operatorId, { limit: 50, includeTotal: true });
      const rows = Array.isArray((res as any)?.rows) ? (res as any).rows : (Array.isArray(res) ? res : []);
      const totalDelta = Number((res as any)?.totalDelta ?? 0);
      setPointsLedgerRows(rows);
      setPointsLedgerTotalDelta(Number.isFinite(totalDelta) ? totalDelta : 0);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!msg.includes('feature_disabled')) {
        showNotice(msg || '載入消費積分資料失敗', 3000);
      }
      setPointsLedgerRows([]);
      setPointsLedgerTotalDelta(0);
    } finally {
      setPointsLoading(false);
    }
  }, [operatorId, pointsEnabled, showNotice]);

  useEffect(() => {
    loadPointsData();
  }, [loadPointsData]);

  useEffect(() => {
    if (!operatorId || !pointsEnabled) return;
    const q = String(pointsAdjustMemberQuery || '').trim();
    let mounted = true;
    if (!q) {
      setPointsAdjustMemberOptions([]);
      setPointsAdjustMemberLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setPointsAdjustMemberLoading(true);
      try {
        const rows = await searchClubPointsBalances(API_URL, operatorId, { q, limit: 30 });
        if (mounted) setPointsAdjustMemberOptions(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setPointsAdjustMemberOptions([]);
      } finally {
        if (mounted) setPointsAdjustMemberLoading(false);
      }
    }, 250);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [operatorId, pointsAdjustMemberQuery, pointsEnabled]);

  useEffect(() => {
    if (!operatorId || !pointsEnabled) return;
    const q = String(pointsBalanceQuery || '').trim();
    let mounted = true;
    if (!q) {
      setPointsBalanceRows([]);
      setPointsBalanceLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setPointsBalanceLoading(true);
      try {
        const rows = await searchClubPointsBalances(API_URL, operatorId, { q, limit: 50 });
        if (mounted) setPointsBalanceRows(Array.isArray(rows) ? rows : []);
      } catch {
        if (mounted) setPointsBalanceRows([]);
      } finally {
        if (mounted) setPointsBalanceLoading(false);
      }
    }, 250);
    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [operatorId, pointsBalanceQuery, pointsEnabled]);

  if (!accessLoaded) {
    return (
      <div className={`glass rounded-xl p-4 md:p-6 ${className}`.trim()}>
        <div className="cue-muted text-sm">讀取積分授權中...</div>
      </div>
    );
  }

  if (!pointsEnabled) {
    return (
      <div className={`glass rounded-xl p-4 md:p-6 ${className}`.trim()}>
        <div className="text-xl font-bold mb-2">消費積分</div>
        <div className="cue-muted text-sm">此功能未開通</div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl p-4 md:p-6 ${className}`.trim()}>
      <div className="flex justify-between items-center mb-4 border-b cue-border pb-2">
        <h2 className="text-xl font-bold">消費積分</h2>
        <div className="flex items-center gap-2">
          <HelpGuide
            title="消費積分"
            intro="查詢積分流水、會員積分結餘，並可手動加減積分。"
            steps={[
              '按「重新整理」更新最新積分資料。',
              '在「會員消費積分加減」搜尋並選擇會員，輸入加減分數及原因後提交。',
              '在「積分流水」可查看最近記錄，並可切換顯示方式/篩選。',
            ]}
            tips={[
              '加減積分屬即時生效操作，建議填寫原因，方便日後追查。',
              '如找不到會員，請確認會員是否已加入場館或輸入關鍵字是否正確。',
            ]}
          />
          <button type="button" onClick={loadPointsData} className="text-sm accent-blue hover:underline">
            重新整理
          </button>
        </div>
      </div>

      {notice ? <div className="mb-4 text-sm accent-yellow">{notice}</div> : null}

      {pointsLoading ? (
        <div className="cue-muted">載入中...</div>
      ) : (
        <div className="grid gap-6">
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="font-semibold">會員消費積分加減</div>
              <HelpGuide
                title="會員消費積分加減"
                intro="為指定會員手動加/減積分（例如充值、抵扣台費、調整）。"
                steps={[
                  '先用搜尋欄輸入姓名/電話/Email/會員編號。',
                  '在下拉選單選擇正確會員（括號內顯示目前結餘）。',
                  '輸入「加減分」（可負數）及原因。',
                  '按提交後會即時生效，並出現在積分流水。',
                ]}
                tips={[
                  '如輸入負數，代表扣分；建議填寫清晰原因。',
                  '如找不到會員，請先確保該會員已加入此場館。',
                ]}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-3">
                <label className="block text-sm mb-1 cue-muted">搜尋會員（名稱/電話/Email/會員編號）</label>
                <input
                  value={pointsAdjustMemberQuery}
                  onChange={(e) => setPointsAdjustMemberQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded cue-input"
                  placeholder="例如：陳大文 / 9123 / abc@gmail.com / A00123"
                />
                {pointsAdjustMemberLoading ? <div className="text-xs cue-muted mt-1">搜尋中...</div> : null}
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm mb-1 cue-muted">會員</label>
                <select value={pointsAdjustMemberId} onChange={(e) => setPointsAdjustMemberId(e.target.value)} className="w-full px-3 py-2 rounded cue-input">
                  <option value="">請先搜尋並選擇</option>
                  {pointsAdjustMemberOptions.map((row: any) => {
                    const member = row?.member || {};
                    const code = String(member?.member_code || '').trim();
                    const name = String(member?.name || '').trim();
                    const phone = String(member?.phone || member?.phone_e164 || '').trim();
                    const email = String(member?.email || '').trim();
                    const balance = row?.balance ?? 0;
                    const left = `${name || email || row.memberId}${code ? ` [${code}]` : ''}`;
                    const right = phone || email;
                    const label = `${left}${right ? ` (${right})` : ''}（${balance}）`;
                    return (
                      <option key={row.memberId} value={row.memberId}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">加減分（可負數）</label>
                <input value={pointsAdjustDelta} onChange={(e) => setPointsAdjustDelta(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：100 或 -50" />
              </div>
              <div className="md:col-span-4">
                <label className="block text-sm mb-1 cue-muted">原因</label>
                <input value={pointsAdjustReason} onChange={(e) => setPointsAdjustReason(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：台費抵扣 / 充值" />
              </div>
            </div>
            <div className="mt-3">
              <button
                type="button"
                className="px-4 py-2 rounded cue-button hover:brightness-95 text-white"
                onClick={async () => {
                  try {
                    if (!pointsAdjustMemberId) throw new Error('請先選擇會員');
                    const delta = Math.floor(Number(pointsAdjustDelta));
                    if (!Number.isFinite(delta) || delta === 0) throw new Error('請輸入有效加減分');
                    if (!String(pointsAdjustReason || '').trim()) throw new Error('請輸入原因');
                    await adjustClubMemberPoints(API_URL, operatorId, {
                      memberId: pointsAdjustMemberId,
                      deltaPoints: delta,
                      reason: String(pointsAdjustReason).trim(),
                    });
                    setPointsAdjustDelta('');
                    setPointsAdjustReason('');
                    setPointsLedgerMode('detail');
                    setPointsLedgerMemberId(pointsAdjustMemberId);
                    setPointsLedgerFrom('');
                    setPointsLedgerTo('');
                    setPointsLedgerMonth('');
                    try {
                      setPointsLedgerLoading(true);
                      const res = await getClubPointsLedger(API_URL, operatorId, { limit: 50, memberId: pointsAdjustMemberId, includeTotal: true });
                      const rows = Array.isArray((res as any)?.rows) ? (res as any).rows : (Array.isArray(res) ? res : []);
                      const totalDelta = Number((res as any)?.totalDelta ?? 0);
                      setPointsLedgerRows(rows);
                      setPointsLedgerTotalDelta(Number.isFinite(totalDelta) ? totalDelta : 0);
                    } catch {}
                    showNotice('已更新消費積分');
                  } catch (e: any) {
                    showNotice(e?.message || '更新失敗', 3000);
                  } finally {
                    setPointsLedgerLoading(false);
                  }
                }}
              >
                確認更新
              </button>
              <div className="text-xs cue-muted mt-1">建議以正數代表加分，負數代表扣分。</div>
            </div>
          </div>

          <div>
            <div className="font-semibold mb-2">會員消費積分餘額（搜尋）</div>
            <div className="grid gap-3">
              <div>
                <label className="block text-sm mb-1 cue-muted">搜尋（名稱/電話/Email/會員編號）</label>
                <input
                  value={pointsBalanceQuery}
                  onChange={(e) => setPointsBalanceQuery(e.target.value)}
                  className="w-full px-3 py-2 rounded cue-input"
                  placeholder="輸入關鍵字後顯示最多 50 筆"
                />
                {pointsBalanceLoading ? <div className="text-xs cue-muted mt-1">載入中...</div> : null}
              </div>

              {String(pointsBalanceQuery || '').trim() && pointsBalanceRows.length === 0 && !pointsBalanceLoading ? (
                <div className="cue-muted text-sm">沒有結果</div>
              ) : pointsBalanceRows.length === 0 ? (
                <div className="cue-muted text-sm">輸入關鍵字以查詢指定會員（避免一次列出大量成員）。</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-3">會員</th>
                        <th className="py-2 px-3">電話</th>
                        <th className="py-2 px-3">Email</th>
                        <th className="py-2 px-3">餘額</th>
                        <th className="py-2 px-3">更新</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pointsBalanceRows.map((row: any) => {
                        const member = row?.member || {};
                        const code = String(member?.member_code || '').trim();
                        const name = String(member?.name || '').trim();
                        const phone = String(member?.phone || member?.phone_e164 || '').trim();
                        const email = String(member?.email || '').trim();
                        return (
                          <tr key={row.memberId} className="border-b cue-border hover:brightness-95">
                            <td className="py-2 px-3">{name || '-'}{code ? ` [${code}]` : ''}</td>
                            <td className="py-2 px-3 text-sm">{phone || '-'}</td>
                            <td className="py-2 px-3 text-sm">{email || '-'}</td>
                            <td className="py-2 px-3 font-semibold">{row.balance ?? 0}</td>
                            <td className="py-2 px-3 text-xs cue-muted">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="font-semibold">消費積分流水</div>
              <HelpGuide
                title="消費積分流水"
                intro="查詢積分變動記錄，支援按模式/會員/月份或日期篩選。"
                steps={[
                  '選擇模式：明細（逐筆）或按月（彙總）。',
                  '如要按會員篩選，可先在上方搜尋會員，再在此選擇會員。',
                  '選擇月份，或用日期範圍（由/至）進一步篩選。',
                  '按「搜尋」載入結果。',
                ]}
                tips={[
                  '明細模式會顯示每筆變動；按月模式適合快速看趨勢。',
                  '如結果太多，建議先用日期或會員縮窄範圍。',
                ]}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-6">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">模式</label>
                <select value={pointsLedgerMode} onChange={(e) => setPointsLedgerMode(e.target.value as 'detail' | 'month')} className="w-full px-3 py-2 rounded cue-input">
                  <option value="detail">明細</option>
                  <option value="month">按月</option>
                </select>
              </div>
              <div className="md:col-span-4">
                <label className="block text-sm mb-1 cue-muted">會員（可選）</label>
                <select value={pointsLedgerMemberId} onChange={(e) => setPointsLedgerMemberId(e.target.value)} className="w-full px-3 py-2 rounded cue-input">
                  <option value="">全部會員</option>
                  {pointsAdjustMemberOptions.map((row: any) => {
                    const member = row?.member || {};
                    const code = String(member?.member_code || '').trim();
                    const name = String(member?.name || '').trim();
                    const email = String(member?.email || '').trim();
                    const label = `${name || email || row.memberId}${code ? ` [${code}]` : ''}`;
                    return (
                      <option key={row.memberId} value={row.memberId}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <div className="text-xs cue-muted mt-1">如要按會員篩選，可先在上方搜尋會員，然後在這裡選擇。</div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">月份（可選）</label>
                <input type="month" value={pointsLedgerMonth} onChange={(e) => setPointsLedgerMonth(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">由</label>
                <input type="date" value={pointsLedgerFrom} onChange={(e) => setPointsLedgerFrom(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">至</label>
                <input type="date" value={pointsLedgerTo} onChange={(e) => setPointsLedgerTo(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
              </div>
              <div className="md:col-span-6">
                <button
                  type="button"
                  className="px-4 py-2 rounded cue-surface-strong hover:brightness-95 text-sm"
                  disabled={pointsLedgerLoading}
                  onClick={async () => {
                    if (pointsLedgerLoading) return;
                    setPointsLedgerLoading(true);
                    try {
                      const memberId = String(pointsLedgerMemberId || '').trim() || undefined;
                      const month = String(pointsLedgerMonth || '').trim() || undefined;
                      const fromIso = !month && pointsLedgerFrom ? new Date(`${pointsLedgerFrom}T00:00:00`).toISOString() : undefined;
                      const toIso = !month && pointsLedgerTo ? new Date(`${pointsLedgerTo}T23:59:59.999`).toISOString() : undefined;
                      if (pointsLedgerMode === 'month') {
                        const rows = await getClubPointsLedger(API_URL, operatorId, { memberId, month, from: fromIso, to: toIso, groupBy: 'month' });
                        setPointsLedgerRows(Array.isArray(rows) ? rows : []);
                        setPointsLedgerTotalDelta(0);
                      } else {
                        const res = await getClubPointsLedger(API_URL, operatorId, { limit: 200, memberId, month, from: fromIso, to: toIso, includeTotal: true });
                        const rows = Array.isArray((res as any)?.rows) ? (res as any).rows : (Array.isArray(res) ? res : []);
                        const totalDelta = Number((res as any)?.totalDelta ?? 0);
                        setPointsLedgerRows(rows);
                        setPointsLedgerTotalDelta(Number.isFinite(totalDelta) ? totalDelta : 0);
                      }
                    } catch (e: any) {
                      showNotice(e?.message || '讀取消費積分流水失敗', 3000);
                      setPointsLedgerRows([]);
                      setPointsLedgerTotalDelta(0);
                    } finally {
                      setPointsLedgerLoading(false);
                    }
                  }}
                >
                  {pointsLedgerLoading ? '載入中...' : '搜尋'}
                </button>
              </div>
            </div>

            {pointsLedgerMode === 'detail' ? (
              <div className="mt-3 text-sm cue-muted">
                {(() => {
                  const rows = Array.isArray(pointsLedgerRows) ? pointsLedgerRows : [];
                  const totalPlus = rows.reduce((sum: number, row: any) => {
                    const value = Number(row?.deltaPoints ?? 0);
                    return Number.isFinite(value) && value > 0 ? sum + value : sum;
                  }, 0);
                  return (
                    <>
                      總加：<span className="font-semibold">{totalPlus}</span>
                      <span className="mx-2">｜</span>
                      總變動：<span className="font-semibold">{pointsLedgerTotalDelta > 0 ? `+${pointsLedgerTotalDelta}` : String(pointsLedgerTotalDelta)}</span>
                    </>
                  );
                })()}
              </div>
            ) : null}

            <div className="mt-3">
              {pointsLedgerLoading ? (
                <div className="cue-muted">載入中...</div>
              ) : pointsLedgerRows.length === 0 ? (
                <div className="cue-muted">暫無資料</div>
              ) : pointsLedgerMode === 'month' ? (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-3">月份</th>
                        <th className="py-2 px-3">筆數</th>
                        <th className="py-2 px-3">總變動</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pointsLedgerRows.map((row: any) => (
                        <tr key={row.month} className="border-b cue-border hover:brightness-95">
                          <td className="py-2 px-3">{row.month}</td>
                          <td className="py-2 px-3">{row.count ?? 0}</td>
                          <td className="py-2 px-3 font-semibold">{Number(row.sumDelta) > 0 ? `+${row.sumDelta}` : String(row.sumDelta ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-3">時間</th>
                        <th className="py-2 px-3">會員</th>
                        <th className="py-2 px-3">變動</th>
                        <th className="py-2 px-3">原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pointsLedgerRows.map((row: any) => (
                        <tr key={row.id} className="border-b cue-border hover:brightness-95">
                          <td className="py-2 px-3 text-xs cue-muted">{row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}</td>
                          <td className="py-2 px-3 text-sm">
                            {row.member?.name || row.member?.email || '-'}
                            {row.member?.member_code ? ` [${row.member.member_code}]` : ''}
                          </td>
                          <td className="py-2 px-3 font-semibold">{row.deltaPoints > 0 ? `+${row.deltaPoints}` : row.deltaPoints}</td>
                          <td className="py-2 px-3 text-sm">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-xs cue-muted mt-2">最多顯示 200 筆（如需完整統計可縮窄時間範圍）。</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VenuePointsModule;
