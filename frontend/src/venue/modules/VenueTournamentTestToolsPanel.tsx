import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../../config';
import {
  bootstrapTournamentTestData,
  cleanupTournamentTestData,
  simulateTournamentTestProgress,
} from '../../lib/api';

type VenueTournamentTestToolsPanelProps = {
  operatorId: string;
  tournamentId: string;
  tournamentTitle: string;
  isLeague: boolean;
  confirmedCount: number;
  capacity: number;
  confirmedRows: any[];
  participantsRows: any[];
  matchesRows: any[];
  onCompleted: () => Promise<void> | void;
  showNotice: (message: string, timeout?: number) => void;
};

function buildDefaultBatchLabel() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `TZ${year}${month}${day}${hour}${minute}`;
}

function parseBatchLabel(value: any) {
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^TZ-([A-Z0-9]+)-\d{2}$/);
  return match ? match[1] : '';
}

const VenueTournamentTestToolsPanel: React.FC<VenueTournamentTestToolsPanelProps> = ({
  operatorId,
  tournamentId,
  tournamentTitle,
  isLeague,
  confirmedCount,
  capacity,
  confirmedRows,
  participantsRows,
  matchesRows,
  onCompleted,
  showNotice,
}) => {
  const [count, setCount] = useState(isLeague ? '6' : '8');
  const [batchLabel, setBatchLabel] = useState(() => buildDefaultBatchLabel());
  const [password, setPassword] = useState('Test1234');
  const [includeParticipants, setIncludeParticipants] = useState(true);
  const [includeSchedule, setIncludeSchedule] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [lastSimulation, setLastSimulation] = useState<any>(null);
  const [lastCleanup, setLastCleanup] = useState<any>(null);
  const [simulateMode, setSimulateMode] = useState<'PARTIAL' | 'FULL'>('FULL');
  const [simulateTargetRound, setSimulateTargetRound] = useState('1');
  const [simulateMaxMatches, setSimulateMaxMatches] = useState('');
  const [simulateGenerateBreaks, setSimulateGenerateBreaks] = useState(true);
  const [cleanupBatchLabel, setCleanupBatchLabel] = useState('ALL');
  const [cleanupRemoveMembers, setCleanupRemoveMembers] = useState(true);

  useEffect(() => {
    setCount(isLeague ? '6' : '8');
  }, [isLeague, tournamentId]);

  const nextTotalCount = useMemo(() => {
    const numericCount = Math.max(0, Math.floor(Number(count || 0)));
    return confirmedCount + numericCount;
  }, [confirmedCount, count]);

  const maxRound = useMemo(() => {
    const rounds = matchesRows
      .map((row: any) => Number(row?.round_no || row?.roundNo || 0))
      .filter((value: number) => Number.isFinite(value) && value > 0);
    return rounds.length > 0 ? Math.max(...rounds) : 0;
  }, [matchesRows]);

  const methodZBatchOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of confirmedRows) {
      const label = parseBatchLabel(row?.member?.member_code);
      if (label) values.add(label);
    }
    for (const row of participantsRows) {
      const label = parseBatchLabel(row?.member?.member_code);
      if (label) values.add(label);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [confirmedRows, participantsRows]);

  const credentialsText = useMemo(() => {
    const rows = Array.isArray(lastResult?.createdMembers) ? lastResult.createdMembers : [];
    if (rows.length === 0) return '';
    return [
      `賽事：${tournamentTitle || '-'}`,
      `Batch：${String(lastResult?.batchLabel || '').trim() || '-'}`,
      `密碼：${String(lastResult?.password || '').trim() || '-'}`,
      '',
      ...rows.map((row: any, index: number) => (
        `${index + 1}. ${String(row?.memberCode || '').trim()} | ${String(row?.name || '').trim()} | ${String(row?.email || '').trim()}`
      )),
    ].join('\n');
  }, [lastResult, tournamentTitle]);

  return (
    <div className="mt-3 rounded-lg border cue-border cue-surface p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="font-semibold">方法 Z 測試工具</div>
          <div className="mt-1 text-xs cue-muted">
            一鍵建立測試會員、直接確認報名，並可自動生成正式名單與 {isLeague ? 'League' : 'Knockout'} 賽程。
          </div>
        </div>
        <div className="text-xs cue-muted">
          目前已確認 {confirmedCount} / {capacity}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs cue-muted">建立人數</span>
          <input
            type="number"
            min={2}
            max={64}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-full rounded cue-input px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs cue-muted">批次代號</span>
          <input
            value={batchLabel}
            onChange={(e) => setBatchLabel(e.target.value)}
            className="w-full rounded cue-input px-3 py-2 text-sm uppercase"
            placeholder="例如 TZ250705A"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs cue-muted">測試密碼</span>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded cue-input px-3 py-2 text-sm"
            placeholder="至少 8 碼，需含英數"
          />
        </label>
        <div className="rounded cue-surface-strong px-3 py-2 text-sm">
          <div className="text-xs cue-muted">建立後預估已確認名額</div>
          <div className={`mt-1 font-semibold ${nextTotalCount > capacity ? 'text-rose-300' : ''}`}>
            {nextTotalCount} / {capacity}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeParticipants}
            onChange={(e) => setIncludeParticipants(e.target.checked)}
            disabled={includeSchedule}
          />
          <span>自動生成正式名單</span>
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeSchedule}
            onChange={(e) => {
              const checked = e.target.checked;
              setIncludeSchedule(checked);
              if (checked) setIncludeParticipants(true);
            }}
          />
          <span>自動生成賽程</span>
        </label>
      </div>

      <div className="mt-2 text-xs cue-muted">
        建議用全新測試賽事執行。若賽程已存在，方法 Z 會拒絕自動生成正式名單或賽程，避免污染現有比賽。
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          className={`px-3 py-2 rounded text-sm font-semibold ${saving ? 'cue-surface-strong cue-muted' : 'cue-button'}`}
          onClick={async () => {
            const numericCount = Math.max(2, Math.min(64, Math.floor(Number(count || 0) || 0)));
            if (nextTotalCount > capacity) {
              showNotice('建立後會超出賽事名額，請先減少人數或提高 capacity', 3500);
              return;
            }
            if (!window.confirm(`確定為「${tournamentTitle || '目前賽事'}」建立 ${numericCount} 位測試會員並執行方法 Z？`)) return;
            try {
              setSaving(true);
              const result = await bootstrapTournamentTestData(API_URL, operatorId, tournamentId, {
                count: numericCount,
                batchLabel,
                password,
                includeParticipants,
                includeSchedule,
              });
              setLastResult(result);
              setLastCleanup(null);
              await onCompleted();
              showNotice(`方法 Z 已建立 ${Number(result?.createdSignupCount || numericCount)} 位測試會員`);
            } catch (e: any) {
              showNotice(e?.message || '方法 Z 建立測試資料失敗', 4000);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? '建立中...' : '執行方法 Z'}
        </button>
        <button
          type="button"
          className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
          onClick={() => {
            setBatchLabel(buildDefaultBatchLabel());
            setCount(isLeague ? '6' : '8');
            setPassword('Test1234');
            setIncludeParticipants(true);
            setIncludeSchedule(true);
          }}
        >
          重設建議值
        </button>
        {credentialsText ? (
          <button
            type="button"
            className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(credentialsText);
                showNotice('已複製測試帳號資料');
              } catch {
                showNotice('複製失敗，請手動複製下方清單', 3500);
              }
            }}
          >
            複製帳號清單
          </button>
        ) : null}
      </div>

      {lastResult ? (
        <div className="mt-4 rounded-lg cue-surface-strong p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div><span className="cue-muted">Batch：</span><span className="font-semibold">{String(lastResult?.batchLabel || '-')}</span></div>
            <div><span className="cue-muted">格式：</span><span className="font-semibold">{String(lastResult?.format || '-')}</span></div>
            <div><span className="cue-muted">密碼：</span><span className="font-semibold">{String(lastResult?.password || '-')}</span></div>
            <div><span className="cue-muted">正式名單：</span><span className="font-semibold">{lastResult?.generatedParticipants ? '已生成' : '未生成'}</span></div>
            <div><span className="cue-muted">賽程：</span><span className="font-semibold">{lastResult?.generatedSchedule ? '已生成' : '未生成'}</span></div>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b cue-border cue-muted">
                  <th className="px-2 py-2">會員編號</th>
                  <th className="px-2 py-2">姓名</th>
                  <th className="px-2 py-2">登入 Email</th>
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(lastResult?.createdMembers) ? lastResult.createdMembers : []).map((row: any, index: number) => (
                  <tr key={String(row?.id || index)} className="border-b cue-border">
                    <td className="px-2 py-2 font-semibold">{String(row?.memberCode || '-')}</td>
                    <td className="px-2 py-2">{String(row?.name || '-')}</td>
                    <td className="px-2 py-2">{String(row?.email || '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg cue-surface-strong p-4">
          <div className="font-semibold">自動灌賽果</div>
          <div className="mt-1 text-xs cue-muted">
            直接走正式記分流程，自動完成指定對局，並可同步生成 `20+ / highest break` 測試數據。
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-xs cue-muted">模式</span>
              <select
                value={simulateMode}
                onChange={(e) => setSimulateMode(e.target.value === 'PARTIAL' ? 'PARTIAL' : 'FULL')}
                className="w-full rounded cue-input px-3 py-2 text-sm"
              >
                <option value="FULL">全自動打完整個賽事</option>
                <option value="PARTIAL">半自動打到指定進度</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs cue-muted">目標輪次</span>
              <input
                type="number"
                min={1}
                max={Math.max(1, maxRound || 1)}
                value={simulateTargetRound}
                onChange={(e) => setSimulateTargetRound(e.target.value)}
                disabled={simulateMode !== 'PARTIAL'}
                className="w-full rounded cue-input px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs cue-muted">最多灌幾場</span>
              <input
                type="number"
                min={1}
                value={simulateMaxMatches}
                onChange={(e) => setSimulateMaxMatches(e.target.value)}
                disabled={simulateMode !== 'PARTIAL'}
                className="w-full rounded cue-input px-3 py-2 text-sm"
                placeholder="留空代表不限"
              />
            </label>
          </div>
          <label className="mt-3 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={simulateGenerateBreaks}
              onChange={(e) => setSimulateGenerateBreaks(e.target.checked)}
            />
            <span>同步生成 20+ / highest break 測試數據</span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={simulating}
              className={`px-3 py-2 rounded text-sm font-semibold ${simulating ? 'cue-surface cue-muted' : 'cue-button'}`}
              onClick={async () => {
                if (!window.confirm(`確定為「${tournamentTitle || '目前賽事'}」執行方法 Z 自動灌賽果？`)) return;
                try {
                  setSimulating(true);
                  const result = await simulateTournamentTestProgress(API_URL, operatorId, tournamentId, {
                    mode: simulateMode,
                    targetRound: simulateMode === 'PARTIAL' ? Math.max(1, Number(simulateTargetRound || 1)) : null,
                    maxMatches: simulateMode === 'PARTIAL' && simulateMaxMatches ? Math.max(1, Number(simulateMaxMatches || 1)) : null,
                    generateBreaks: simulateGenerateBreaks,
                  });
                  setLastSimulation(result);
                  await onCompleted();
                  showNotice(`已自動完成 ${Number(result?.simulatedCount || 0)} 場對局`);
                } catch (e: any) {
                  showNotice(e?.message || '方法 Z 自動灌賽果失敗', 4000);
                } finally {
                  setSimulating(false);
                }
              }}
            >
              {simulating ? '灌賽中...' : '執行自動灌賽果'}
            </button>
          </div>
          {lastSimulation ? (
            <div className="mt-3 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <div><span className="cue-muted">模式：</span><span className="font-semibold">{lastSimulation?.mode === 'PARTIAL' ? 'PARTIAL' : 'FULL'}</span></div>
                <div><span className="cue-muted">完成場數：</span><span className="font-semibold">{Number(lastSimulation?.simulatedCount || 0)}</span></div>
                <div><span className="cue-muted">Break：</span><span className="font-semibold">{lastSimulation?.generateBreaks ? '有' : '無'}</span></div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b cue-border cue-muted">
                      <th className="px-2 py-2">輪次</th>
                      <th className="px-2 py-2">場次</th>
                      <th className="px-2 py-2">比數</th>
                      <th className="px-2 py-2">20+</th>
                      <th className="px-2 py-2">最高單杆</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(lastSimulation?.simulatedMatches) ? lastSimulation.simulatedMatches : []).slice(0, 12).map((row: any, index: number) => (
                      <tr key={String(row?.matchId || index)} className="border-b cue-border">
                        <td className="px-2 py-2">{Number(row?.roundNo || 0) || '-'}</td>
                        <td className="px-2 py-2">{Number(row?.matchNo || 0) || '-'}</td>
                        <td className="px-2 py-2 font-semibold">{String(row?.scoreLabel || '-')}</td>
                        <td className="px-2 py-2">{Number(row?.breakCount || 0)}</td>
                        <td className="px-2 py-2">{Number(row?.highestBreak || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg cue-surface-strong p-4">
          <div className="font-semibold">清理 / 重設方法 Z 資料</div>
          <div className="mt-1 text-xs cue-muted">
            會清走方法 Z 生成的 signup / participant，並一併移除目前賽事的 schedule、frames、breaks，讓你可重新排種子與重新生成賽程。
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs cue-muted">清理批次</span>
              <select
                value={cleanupBatchLabel}
                onChange={(e) => setCleanupBatchLabel(e.target.value)}
                className="w-full rounded cue-input px-3 py-2 text-sm"
              >
                <option value="ALL">全部方法 Z batch</option>
                {methodZBatchOptions.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 text-sm md:mt-6">
              <input
                type="checkbox"
                checked={cleanupRemoveMembers}
                onChange={(e) => setCleanupRemoveMembers(e.target.checked)}
              />
              <span>同時刪除測試會員帳號</span>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={cleaning}
              className={`px-3 py-2 rounded text-sm font-semibold ${cleaning ? 'cue-surface cue-muted' : 'bg-rose-500/20 text-rose-200 hover:brightness-95'}`}
              onClick={async () => {
                const labelText = cleanupBatchLabel === 'ALL' ? '全部方法 Z batch' : `batch ${cleanupBatchLabel}`;
                if (!window.confirm(`確定清理「${tournamentTitle || '目前賽事'}」的 ${labelText} 測試資料？此操作會同時清空目前賽事賽程。`)) return;
                try {
                  setCleaning(true);
                  const result = await cleanupTournamentTestData(API_URL, operatorId, tournamentId, {
                    batchLabel: cleanupBatchLabel === 'ALL' ? '' : cleanupBatchLabel,
                    removeMembers: cleanupRemoveMembers,
                  });
                  setLastCleanup(result);
                  setLastSimulation(null);
                  await onCompleted();
                  showNotice('方法 Z 測試資料已清理');
                } catch (e: any) {
                  showNotice(e?.message || '方法 Z 清理測試資料失敗', 4000);
                } finally {
                  setCleaning(false);
                }
              }}
            >
              {cleaning ? '清理中...' : '清理方法 Z 資料'}
            </button>
          </div>
          {lastCleanup ? (
            <div className="mt-3 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <div><span className="cue-muted">刪除 signup：</span><span className="font-semibold">{Number(lastCleanup?.deletedSignupCount || 0)}</span></div>
                <div><span className="cue-muted">刪除 participants：</span><span className="font-semibold">{Number(lastCleanup?.deletedParticipantCount || 0)}</span></div>
                <div><span className="cue-muted">刪除 matches：</span><span className="font-semibold">{Number(lastCleanup?.deletedMatchCount || 0)}</span></div>
                <div><span className="cue-muted">刪除測試會員：</span><span className="font-semibold">{Number(lastCleanup?.deletedMemberCount || 0)}</span></div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default VenueTournamentTestToolsPanel;
