import React, { useCallback, useEffect, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  createClubBreak,
  getClubBreaks,
  getClubLeaderboardHighest,
  getClubLeaderboardMonthly,
  getClubMembers,
  getClubProfile,
} from '../../lib/api';
import { useFeatureEnabled } from '../../lib/features';

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
  const [leaderMonth, setLeaderMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [leaderHighest, setLeaderHighest] = useState<any[]>([]);
  const [leaderMonthly, setLeaderMonthly] = useState<any[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

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
        getClubBreaks(API_URL, operatorId, { month: breakFilterMonth, memberId: breakFilterMember || undefined }).catch(() => []),
        getClubLeaderboardHighest(API_URL, clubId, 10).catch(() => []),
        getClubLeaderboardMonthly(API_URL, clubId, leaderMonth, 10).catch(() => []),
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
  }, [breakFilterMember, breakFilterMonth, clubId, enabled, leaderMonth, operatorId, showNotice]);

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
          <div className="text-xs cue-muted mt-1">此模式只作場館會內營銷/小遊戲紀錄，不會當作正式比賽單杆。</div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <HelpGuide
            title="場館 Highbreak"
            intro="新增場館會內 highbreak 記錄，並按月份/會員查詢與統計。"
            steps={[
              '右上角先選擇月份與會員（可選）作為篩選條件，按「重新整理」更新列表。',
              '要新增記錄：下方選擇會員、輸入分數與日期（可選：影片連結/備註），按「新增」。',
              '列表可查看已記錄的會內單杆，包含影片連結（如有）。',
            ]}
            tips={[
              '影片連結建議使用可直接開啟的 https:// URL。',
              '如看不到某會員，請先到「會員管理」確認該會員已加入場館。',
              '正式比賽 highbreak 會保留到之後與 tournaments 流程接線。',
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
          <button
            type="button"
            onClick={async () => {
              await Promise.all([loadContext(), loadBreakData()]);
              showNotice('已更新單杆資料');
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
            <div className="font-semibold">會內最高單杆 Top 10</div>
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
                    <th className="py-2 px-2">日期</th>
                    <th className="py-2 px-2">影片</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderHighest.map((row: any) => (
                    <tr key={row.id} className="border-b cue-border">
                      <td className="py-2 px-2">{row.member?.name || '-'}</td>
                      <td className="py-2 px-2 font-semibold accent-yellow">{row.points}</td>
                      <td className="py-2 px-2 cue-muted">{row.recorded_at ? new Date(row.recorded_at).toLocaleDateString() : '-'}</td>
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
            <div className="font-semibold">會內本月累計 Top 10</div>
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
        <div className="font-semibold mb-2">會內紀錄列表</div>
        {breaksLoading ? (
          <div className="text-sm cue-muted">載入中...</div>
        ) : breaks.length === 0 ? (
          <div className="text-sm cue-muted">暫無紀錄</div>
        ) : (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="cue-muted border-b cue-border">
                  <th className="py-2 px-2">日期</th>
                  <th className="py-2 px-2">會員</th>
                  <th className="py-2 px-2">分數</th>
                  <th className="py-2 px-2">影片</th>
                  <th className="py-2 px-2">備註</th>
                </tr>
              </thead>
              <tbody>
                {breaks.map((row: any) => (
                  <tr key={row.id} className="border-b cue-border hover:brightness-95">
                    <td className="py-2 px-2 cue-muted whitespace-nowrap">{row.recorded_at ? new Date(row.recorded_at).toLocaleDateString() : '-'}</td>
                    <td className="py-2 px-2">{row.member?.name || '-'}</td>
                    <td className="py-2 px-2 font-semibold accent-yellow">{row.points}</td>
                    <td className="py-2 px-2">
                      {normalizeVideoHref(row.video_url) ? (
                        <a href={normalizeVideoHref(row.video_url) as string} target="_blank" rel="noreferrer" className="accent-blue underline">
                          連結
                        </a>
                      ) : (
                        <span className="cue-muted">-</span>
                      )}
                    </td>
                    <td className="py-2 px-2 cue-muted">{row.note || '-'}</td>
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
