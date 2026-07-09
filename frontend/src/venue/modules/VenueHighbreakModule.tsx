import React, { useCallback, useEffect, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  createClubBreak,
  getClubBreaks,
  getClubHighbreakSettings,
  getClubLeaderboardHighest,
  getClubLeaderboardMonthly,
  getClubMembers,
  getClubProfile,
  updateClubHighbreakSettings,
  updateClubBreakVideo,
} from '../../lib/api';
import { useFeatureEnabled } from '../../lib/features';

const BREAK_THRESHOLD_OPTIONS = [20, 30, 40, 50];
const BREAK_SCOPE_OPTIONS = [
  { value: 'ALL', label: '綜合' },
  { value: 'VENUE', label: '會內' },
  { value: 'TOURNAMENT', label: '賽事' },
] as const;
type BreakScope = typeof BREAK_SCOPE_OPTIONS[number]['value'];

type VenueHighbreakModuleProps = {
  operatorId: string;
  enabled?: boolean;
  className?: string;
};

function normalizeVideoHref(raw: any): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  return `https://${s}`;
}

function formatBreakRecordTypeLabel(raw: any) {
  return String(raw || '').trim().toUpperCase() === 'TOURNAMENT' ? '賽事 20+' : '場館紀錄';
}

function formatBreakClubLabel(row: any) {
  return String(row?.club?.name || row?.club?.member?.name || '').trim() || '-';
}

function formatBreakContextLabel(row: any) {
  const recordType = String(row?.record_type || '').trim().toUpperCase();
  if (recordType === 'TOURNAMENT') {
    const title = String(row?.tournament?.title || '').trim() || '未命名比賽';
    const frameNo = Number(row?.frame_no || 0);
    return frameNo > 0 ? `${title} · 第 ${frameNo} 局` : title;
  }
  return '場館會內紀錄';
}

function formatBreakDateTime(raw: any) {
  if (!raw) return '-';
  const d = new Date(String(raw));
  if (!Number.isFinite(d.getTime())) return '-';
  return d.toLocaleString();
}

const VenueHighbreakModule: React.FC<VenueHighbreakModuleProps> = ({
  operatorId,
  enabled: enabledOverride,
  className = '',
}) => {
  const { enabled: highbreakGlobalEnabled } = useFeatureEnabled(API_URL, 'highbreak');
  const enabled = typeof enabledOverride === 'boolean' ? enabledOverride : highbreakGlobalEnabled;

  const [clubId, setClubId] = useState('');
  const [clubMembers, setClubMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [breaks, setBreaks] = useState<any[]>([]);
  const [breaksLoading, setBreaksLoading] = useState(false);
  const [breakMemberId, setBreakMemberId] = useState('');
  const [breakPoints, setBreakPoints] = useState('');
  const [breakRecordedAt, setBreakRecordedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [breakVideoUrl, setBreakVideoUrl] = useState('');
  const [breakNote, setBreakNote] = useState('');
  const [breakFilterMonth, setBreakFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [breakFilterMember, setBreakFilterMember] = useState('');
  const [breakMinPoints, setBreakMinPoints] = useState(20);
  const [leaderMonth, setLeaderMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [leaderHighest, setLeaderHighest] = useState<any[]>([]);
  const [leaderMonthly, setLeaderMonthly] = useState<any[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingBreakId, setEditingBreakId] = useState('');
  const [editingVideoUrl, setEditingVideoUrl] = useState('');
  const [videoSaving, setVideoSaving] = useState(false);
  const [thresholdOptions, setThresholdOptions] = useState<number[]>(BREAK_THRESHOLD_OPTIONS);
  const [thresholdMode, setThresholdMode] = useState<'FOLLOW_SYSTEM' | 'CUSTOM'>('FOLLOW_SYSTEM');
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [breakScope, setBreakScope] = useState<BreakScope>('ALL');
  const [scopeMode, setScopeMode] = useState<'FOLLOW_SYSTEM' | 'CUSTOM'>('FOLLOW_SYSTEM');
  const [scopeSaving, setScopeSaving] = useState(false);

  const breakScopeLabel = BREAK_SCOPE_OPTIONS.find((item) => item.value === breakScope)?.label || '綜合';

  const showNotice = useCallback((message: string, timeout = 2500) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), timeout);
  }, []);

  const loadContext = useCallback(async () => {
    if (!operatorId || !enabled) return;
    setMembersLoading(true);
    try {
      const [clubProfileRes, clubMembersRes] = await Promise.all([
        getClubProfile(API_URL, operatorId).catch(() => ({})),
        getClubMembers(API_URL, operatorId).catch(() => []),
      ]);
      setClubId(String((clubProfileRes as any)?.id || '').trim());
      setClubMembers(Array.isArray(clubMembersRes) ? clubMembersRes : []);
      const highbreakSettingsRes = await getClubHighbreakSettings(API_URL, operatorId).catch(() => null);
      const nextOptions = Array.isArray((highbreakSettingsRes as any)?.moduleSettings?.displayThresholdOptions)
        ? (highbreakSettingsRes as any).moduleSettings.displayThresholdOptions
        : BREAK_THRESHOLD_OPTIONS;
      setThresholdOptions(nextOptions);
      setThresholdMode(String((highbreakSettingsRes as any)?.clubSettings?.displayThresholdMode || 'FOLLOW_SYSTEM').toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'FOLLOW_SYSTEM');
      setScopeMode(String((highbreakSettingsRes as any)?.clubSettings?.leaderboardScopeMode || 'FOLLOW_SYSTEM').toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'FOLLOW_SYSTEM');
      const effectiveMinPoints = Number((highbreakSettingsRes as any)?.effectiveMinPoints || 0);
      if (Number.isFinite(effectiveMinPoints) && effectiveMinPoints >= 20) {
        setBreakMinPoints(effectiveMinPoints);
      }
      const effectiveScope = String((highbreakSettingsRes as any)?.effectiveScope || 'ALL').toUpperCase();
      setBreakScope(effectiveScope === 'VENUE' || effectiveScope === 'TOURNAMENT' ? effectiveScope : 'ALL');
    } catch (e: any) {
      showNotice(e?.message || '載入單杆資料失敗', 3000);
    } finally {
      setMembersLoading(false);
    }
  }, [enabled, operatorId, showNotice]);

  const loadBreakData = useCallback(async () => {
    if (!operatorId || !clubId || !enabled) return;
    setBreaksLoading(true);
    try {
      const [rows, highest, monthly] = await Promise.all([
        getClubBreaks(API_URL, operatorId, {
          month: breakFilterMonth,
          memberId: breakFilterMember || undefined,
          minPoints: breakMinPoints,
          scope: breakScope,
        }).catch(() => []),
        getClubLeaderboardHighest(API_URL, clubId, 10, breakMinPoints, breakScope).catch(() => []),
        getClubLeaderboardMonthly(API_URL, clubId, leaderMonth, 10, breakMinPoints, breakScope).catch(() => []),
      ]);
      setBreaks(Array.isArray(rows) ? rows : []);
      setLeaderHighest(Array.isArray(highest) ? highest : []);
      setLeaderMonthly(Array.isArray(monthly) ? monthly : []);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!msg.includes('feature_disabled')) {
        showNotice(msg || '載入單杆資料失敗', 3000);
      }
    } finally {
      setBreaksLoading(false);
    }
  }, [breakFilterMember, breakFilterMonth, breakMinPoints, breakScope, clubId, enabled, leaderMonth, operatorId, showNotice]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    loadBreakData();
  }, [loadBreakData]);

  if (!enabled) {
    return (
      <div className={`glass rounded-xl p-4 md:p-6 ${className}`.trim()}>
        <div className="text-xl font-bold mb-2">單杆紀錄</div>
        <div className="cue-muted text-sm">此功能未開通</div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl p-4 md:p-6 ${className}`.trim()}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 border-b cue-border pb-2">
        <div>
          <h2 className="text-xl font-bold">場館 Highbreak</h2>
          <div className="text-xs cue-muted mt-1">可按會內 / 賽事 / 綜合口徑查看單杆記錄與排行榜，並標示所屬比賽與場館。</div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <HelpGuide
            title="場館 Highbreak"
            intro="新增場館會內 highbreak 記錄，並按月份、會員、顯示門檻與統計口徑查看列表、排行榜與影片補錄。"
            steps={[
              '右上角先選擇月份、會員、顯示標準與口徑（綜合 / 會內 / 賽事），按「重新整理」更新列表。',
              '要新增記錄：下方選擇會員、輸入分數與日期（可選：影片連結/備註），按「新增」。',
              '比賽完結後，可在列表的「影片」欄直接補上或修改影片連結；若該列來自賽事 fallback，系統會自動轉成正式記錄。',
            ]}
            tips={[
              '影片連結建議使用可直接開啟的 https:// URL。',
              '如看不到某會員，請先到「會員管理」確認該會員已加入場館。',
              '正式賽事 `20+` 由 tournaments 工作台輸入後，會自動出現在這裡，並可按門檻與口徑切換顯示。',
            ]}
          />
          <input
            type="month"
            value={breakFilterMonth}
            onChange={(e) => setBreakFilterMonth(e.target.value)}
            className="px-3 py-2 rounded cue-input text-sm"
          />
          <select
            value={breakFilterMember}
            onChange={(e) => setBreakFilterMember(e.target.value)}
            className="px-3 py-2 rounded cue-input text-sm"
            disabled={membersLoading}
          >
            <option value="">全部會員</option>
            {clubMembers.map((cm: any) => (
              <option key={cm.member?.id || cm.id} value={cm.member?.id || ''}>
                {cm.member?.name || '-'}{cm.member?.email ? ` (${cm.member.email})` : ''}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1 rounded cue-surface px-2 py-1">
            <span className="text-xs cue-muted">標準</span>
            {thresholdOptions.map((value) => (
              <button
                key={value}
                type="button"
                onClick={async () => {
                  setBreakMinPoints(value);
                  if (thresholdMode === 'CUSTOM') return;
                  try {
                    setThresholdSaving(true);
                    await updateClubHighbreakSettings(API_URL, operatorId, {
                      displayThresholdMode: 'CUSTOM',
                      displayThresholdDefault: value,
                    });
                    setThresholdMode('CUSTOM');
                    showNotice(`已改用場館自訂 ${value}+ 標準`);
                  } catch (e: any) {
                    showNotice(e?.message || '更新場館標準失敗', 3000);
                  } finally {
                    setThresholdSaving(false);
                  }
                }}
                className={`px-2 py-1 rounded text-xs ${breakMinPoints === value ? 'cue-button text-white font-semibold' : 'cue-surface-strong hover:brightness-95'}`}
              >
                {value}+
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded cue-surface px-2 py-1">
            <span className="text-xs cue-muted">口徑</span>
            {BREAK_SCOPE_OPTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={async () => {
                  setBreakScope(item.value);
                  if (scopeMode === 'CUSTOM') return;
                  try {
                    setScopeSaving(true);
                    await updateClubHighbreakSettings(API_URL, operatorId, {
                      leaderboardScopeMode: 'CUSTOM',
                      leaderboardScopeDefault: item.value,
                    });
                    setScopeMode('CUSTOM');
                    showNotice(`已改用場館自訂 ${item.label} 口徑`);
                  } catch (e: any) {
                    showNotice(e?.message || '更新場館口徑失敗', 3000);
                  } finally {
                    setScopeSaving(false);
                  }
                }}
                className={`px-2 py-1 rounded text-xs ${breakScope === item.value ? 'cue-button text-white font-semibold' : 'cue-surface-strong hover:brightness-95'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={thresholdSaving}
            onClick={async () => {
              try {
                setThresholdSaving(true);
                const result = await updateClubHighbreakSettings(API_URL, operatorId, {
                  displayThresholdMode: thresholdMode === 'FOLLOW_SYSTEM' ? 'CUSTOM' : 'FOLLOW_SYSTEM',
                  ...(thresholdMode === 'FOLLOW_SYSTEM' ? { displayThresholdDefault: breakMinPoints } : {}),
                });
                const nextMode = String((result as any)?.clubSettings?.displayThresholdMode || '').toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'FOLLOW_SYSTEM';
                const nextEffective = Number((result as any)?.effectiveMinPoints || breakMinPoints);
                setThresholdMode(nextMode);
                if (Number.isFinite(nextEffective) && nextEffective >= 20) {
                  setBreakMinPoints(nextEffective);
                }
                showNotice(nextMode === 'FOLLOW_SYSTEM' ? '已改為跟隨系統預設標準' : '已改為場館自訂標準');
              } catch (e: any) {
                showNotice(e?.message || '更新場館標準失敗', 3000);
              } finally {
                setThresholdSaving(false);
              }
            }}
            className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm"
          >
            {thresholdSaving ? '儲存中...' : thresholdMode === 'FOLLOW_SYSTEM' ? '跟隨系統' : '場館自訂'}
          </button>
          <button
            type="button"
            disabled={scopeSaving}
            onClick={async () => {
              try {
                setScopeSaving(true);
                const result = await updateClubHighbreakSettings(API_URL, operatorId, {
                  leaderboardScopeMode: scopeMode === 'FOLLOW_SYSTEM' ? 'CUSTOM' : 'FOLLOW_SYSTEM',
                  ...(scopeMode === 'FOLLOW_SYSTEM' ? { leaderboardScopeDefault: breakScope } : {}),
                });
                const nextMode = String((result as any)?.clubSettings?.leaderboardScopeMode || '').toUpperCase() === 'CUSTOM' ? 'CUSTOM' : 'FOLLOW_SYSTEM';
                const nextEffectiveScope = String((result as any)?.effectiveScope || 'ALL').toUpperCase();
                setScopeMode(nextMode);
                setBreakScope(nextEffectiveScope === 'VENUE' || nextEffectiveScope === 'TOURNAMENT' ? nextEffectiveScope : 'ALL');
                showNotice(nextMode === 'FOLLOW_SYSTEM' ? '已改為跟隨系統預設口徑' : '已改為場館自訂口徑');
              } catch (e: any) {
                showNotice(e?.message || '更新場館口徑失敗', 3000);
              } finally {
                setScopeSaving(false);
              }
            }}
            className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm"
          >
            {scopeSaving ? '儲存中...' : scopeMode === 'FOLLOW_SYSTEM' ? '口徑跟隨系統' : '口徑場館自訂'}
          </button>
          <button
            type="button"
            onClick={async () => {
              await Promise.all([loadContext(), loadBreakData()]);
              showNotice(`已更新 ${breakScopeLabel} ${breakMinPoints}+ 單杆資料`);
            }}
            className="px-3 py-2 rounded cue-surface-strong hover:brightness-95 text-sm"
          >
            {(membersLoading || breaksLoading) ? '載入中...' : '重新整理'}
          </button>
        </div>
      </div>

      {notice ? <div className="mb-4 text-sm accent-yellow">{notice}</div> : null}

      <div className="grid gap-3 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">會員</label>
          <select
            value={breakMemberId}
            onChange={(e) => setBreakMemberId(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input"
            disabled={membersLoading}
          >
            <option value="">選擇會員</option>
            {clubMembers.map((cm: any) => (
              <option key={cm.member?.id || cm.id} value={cm.member?.id || ''}>
                {cm.member?.name || '-'}{cm.member?.member_code ? ` [${cm.member.member_code}]` : ''}{cm.member?.email ? ` (${cm.member.email})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1 cue-muted">分數</label>
          <input
            value={breakPoints}
            onChange={(e) => setBreakPoints(e.target.value)}
            type="number"
            min={1}
            className="w-full px-3 py-2 rounded cue-input"
            placeholder="例如 78"
          />
        </div>
        <div>
          <label className="block text-sm mb-1 cue-muted">日期</label>
          <input
            value={breakRecordedAt}
            onChange={(e) => setBreakRecordedAt(e.target.value)}
            type="date"
            className="w-full px-3 py-2 rounded cue-input"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1 cue-muted">影片連結（可空）</label>
          <input
            value={breakVideoUrl}
            onChange={(e) => setBreakVideoUrl(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input"
            placeholder="https://..."
          />
        </div>
        <div className="md:col-span-5">
          <label className="block text-sm mb-1 cue-muted">備註（可空）</label>
          <input
            value={breakNote}
            onChange={(e) => setBreakNote(e.target.value)}
            className="w-full px-3 py-2 rounded cue-input"
            placeholder="例如：友誼賽 / 練習"
          />
        </div>
        <div className="md:col-span-1 flex items-end">
          <button
            type="button"
            onClick={async () => {
              try {
                if (!breakMemberId) throw new Error('請先選擇會員');
                const p = Number(breakPoints);
                if (!Number.isFinite(p) || p <= 0) throw new Error('分數無效');
                await createClubBreak(API_URL, operatorId, {
                  memberId: breakMemberId,
                  points: p,
                  recordedAt: breakRecordedAt,
                  videoUrl: breakVideoUrl.trim() || undefined,
                  note: breakNote.trim() || undefined,
                });
                setBreakPoints('');
                setBreakVideoUrl('');
                setBreakNote('');
                await loadBreakData();
                showNotice('已新增單杆紀錄');
              } catch (e: any) {
                showNotice(e?.message || '新增失敗', 3000);
              }
            }}
            className="w-full px-4 py-2 rounded cue-button hover:brightness-95 text-white font-semibold"
          >
            新增
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="cue-surface rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold">{breakScopeLabel}最高 {breakMinPoints}+ Top 10</div>
          </div>
          {leaderHighest.length === 0 ? (
            <div className="text-sm cue-muted">暫無資料</div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="cue-muted border-b cue-border">
                    <th className="py-2 px-2">會員</th>
                    <th className="py-2 px-2">分數</th>
                    <th className="py-2 px-2">日期時間</th>
                    <th className="py-2 px-2">所屬</th>
                    <th className="py-2 px-2">場館</th>
                    <th className="py-2 px-2">影片</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderHighest.map((row: any) => (
                    <tr key={row.id} className="border-b cue-border">
                      <td className="py-2 px-2">{row.member?.name || '-'}</td>
                      <td className="py-2 px-2 font-semibold accent-yellow">{row.points}</td>
                      <td className="py-2 px-2 cue-muted whitespace-nowrap">{formatBreakDateTime(row.recorded_at)}</td>
                      <td className="py-2 px-2">
                        <div>{formatBreakContextLabel(row)}</div>
                        <div className="text-xs cue-muted mt-1">{formatBreakRecordTypeLabel(row.record_type)}</div>
                      </td>
                      <td className="py-2 px-2 cue-muted">{formatBreakClubLabel(row)}</td>
                      <td className="py-2 px-2">
                        {normalizeVideoHref(row.video_url) ? (
                          <a href={normalizeVideoHref(row.video_url) as string} target="_blank" rel="noreferrer" className="accent-blue underline">
                            影片連結
                          </a>
                        ) : (
                          <span className="cue-muted">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="cue-surface rounded-lg p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
            <div className="font-semibold">{breakScopeLabel} {breakMinPoints}+ 本月累計 Top 10</div>
            <input
              type="month"
              value={leaderMonth}
              onChange={(e) => setLeaderMonth(e.target.value)}
              className="px-3 py-2 rounded cue-input text-sm"
            />
          </div>
          {leaderMonthly.length === 0 ? (
            <div className="text-sm cue-muted">暫無資料</div>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="cue-muted border-b cue-border">
                    <th className="py-2 px-2">會員</th>
                    <th className="py-2 px-2">累計</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderMonthly.map((row: any) => (
                    <tr key={row.member?.id || row.member_id} className="border-b cue-border">
                      <td className="py-2 px-2">{row.member?.name || '-'}</td>
                      <td className="py-2 px-2 font-semibold text-emerald-600">{row.totalPoints}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="font-semibold mb-2">{breakScopeLabel} {breakMinPoints}+ 紀錄列表</div>
        {breaksLoading ? (
          <div className="text-sm cue-muted">載入中...</div>
        ) : breaks.length === 0 ? (
          <div className="text-sm cue-muted">暫無紀錄</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="cue-muted border-b cue-border">
                  <th className="py-2 px-2">日期時間</th>
                  <th className="py-2 px-2">會員</th>
                  <th className="py-2 px-2">分數</th>
                  <th className="py-2 px-2">所屬</th>
                  <th className="py-2 px-2">場館</th>
                  <th className="py-2 px-2">影片</th>
                  <th className="py-2 px-2">備註</th>
                  <th className="py-2 px-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {breaks.map((row: any) => (
                  <tr key={row.id} className="border-b cue-border hover:brightness-95">
                    <td className="py-2 px-2 cue-muted whitespace-nowrap">{formatBreakDateTime(row.recorded_at)}</td>
                    <td className="py-2 px-2">{row.member?.name || '-'}</td>
                    <td className="py-2 px-2 font-semibold accent-yellow">{row.points}</td>
                    <td className="py-2 px-2">
                      <div>{formatBreakContextLabel(row)}</div>
                      <div className="text-xs cue-muted mt-1">{formatBreakRecordTypeLabel(row.record_type)}</div>
                    </td>
                    <td className="py-2 px-2 cue-muted">{formatBreakClubLabel(row)}</td>
                    <td className="py-2 px-2">
                      {editingBreakId === row.id ? (
                        <div className="min-w-[220px] space-y-2">
                          <input
                            value={editingVideoUrl}
                            onChange={(e) => setEditingVideoUrl(e.target.value)}
                            className="w-full px-3 py-2 rounded cue-input"
                            placeholder="https://..."
                          />
                          {String(row?.source || '').toUpperCase() === 'FRAME_FALLBACK' ? (
                            <div className="text-[11px] cue-muted">儲存後會把這筆賽事 fallback 轉成正式單杆記錄。</div>
                          ) : null}
                        </div>
                      ) : normalizeVideoHref(row.video_url) ? (
                        <a href={normalizeVideoHref(row.video_url) as string} target="_blank" rel="noreferrer" className="accent-blue underline">
                          連結
                        </a>
                      ) : (
                        <span className="cue-muted">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 cue-muted">{row.note || '-'}</td>
                    <td className="py-2 px-2">
                      {editingBreakId === row.id ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={videoSaving}
                            onClick={async () => {
                              try {
                                setVideoSaving(true);
                                await updateClubBreakVideo(API_URL, operatorId, String(row.id || ''), {
                                  videoUrl: editingVideoUrl.trim() || null,
                                  source: String(row?.source || ''),
                                  tournamentId: row?.tournament_id ? String(row.tournament_id) : undefined,
                                  tournamentMatchId: row?.tournament_match_id ? String(row.tournament_match_id) : undefined,
                                  frameNo: Number(row?.frame_no || 0) || undefined,
                                  points: Number(row?.points || 0) || undefined,
                                  recordedAt: row?.recorded_at ? String(row.recorded_at) : undefined,
                                  thresholdSnapshot: Number(row?.threshold_snapshot || 0) || undefined,
                                  targetMemberId: row?.member_id ? String(row.member_id) : undefined,
                                });
                                setEditingBreakId('');
                                setEditingVideoUrl('');
                                await loadBreakData();
                                showNotice('已更新影片連結');
                              } catch (e: any) {
                                showNotice(e?.message || '更新影片連結失敗', 3000);
                              } finally {
                                setVideoSaving(false);
                              }
                            }}
                            className="px-3 py-1 rounded cue-button text-white text-xs font-semibold disabled:opacity-60"
                          >
                            {videoSaving ? '儲存中...' : '儲存'}
                          </button>
                          <button
                            type="button"
                            disabled={videoSaving}
                            onClick={() => {
                              setEditingBreakId('');
                              setEditingVideoUrl('');
                            }}
                            className="px-3 py-1 rounded cue-surface-strong text-xs"
                          >
                            取消
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBreakId(String(row.id || ''));
                            setEditingVideoUrl(String(row?.video_url || ''));
                          }}
                          className="px-3 py-1 rounded cue-surface-strong text-xs hover:brightness-95"
                        >
                          {normalizeVideoHref(row.video_url) ? '編輯影片' : '補上影片'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default VenueHighbreakModule;
