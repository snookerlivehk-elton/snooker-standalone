import React, { useCallback, useEffect, useMemo, useState } from 'react';
import HelpGuide from '../../components/HelpGuide';
import { API_URL } from '../../config';
import {
  cancelTournamentSignup,
  closeClubTournament,
  confirmTournamentSignup,
  createTournamentMatchBreak,
  createClubTournament,
  generateTournamentKnockoutSchedule,
  generateTournamentParticipants,
  getMyClubTournaments,
  getTournamentMatches,
  getTournamentParticipants,
  getTournamentSignups,
  publishClubTournament,
  recordTournamentMatchResult,
  updateTournamentParticipant,
  updateClubTournament,
} from '../../lib/api';

type VenueTournamentsModuleProps = {
  operatorId: string;
  enabled: boolean;
  className?: string;
};

type EditableFrame = {
  frameNo: number;
  winnerSide: 'A' | 'B';
  playerAScore: string;
  playerBScore: string;
  playerAHighestBreak: string;
  playerBHighestBreak: string;
};

function formatDateTimeLocalInput(raw: any) {
  if (!raw) return '';
  const d = new Date(String(raw));
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${dd}T${hh}:${mm}`;
}

function formatMemberLabel(member: any) {
  return [
    String(member?.member_code || '').trim(),
    String(member?.name || '').trim(),
  ].filter(Boolean).join(' ') || '-';
}

function buildFramesFromMatch(match: any): EditableFrame[] {
  const frames = Array.isArray(match?.frames) ? match.frames : [];
  if (frames.length > 0) {
    return frames.map((frame: any, index: number) => ({
      frameNo: Number(frame?.frame_no || index + 1),
      winnerSide: String(frame?.winner_participant_id || '') === String(match?.player_b_participant_id || '') ? 'B' : 'A',
      playerAScore: String(frame?.player_a_score ?? 0),
      playerBScore: String(frame?.player_b_score ?? 0),
      playerAHighestBreak: String(frame?.player_a_highest_break ?? 0),
      playerBHighestBreak: String(frame?.player_b_highest_break ?? 0),
    }));
  }
  return [{
    frameNo: 1,
    winnerSide: 'A',
    playerAScore: '0',
    playerBScore: '0',
    playerAHighestBreak: '0',
    playerBHighestBreak: '0',
  }];
}

function nextPowerOfTwo(n: number) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function formatKnockoutRoundLabel(match: any, participantCount: number) {
  const roundNo = Number(match?.round_no || 0);
  if (roundNo <= 0) return '-';
  const bracketSize = nextPowerOfTwo(Math.max(2, participantCount || 2));
  const hasPreliminaryRound = participantCount > 0 && participantCount !== bracketSize;
  if (hasPreliminaryRound && roundNo === 1) return '預賽';
  const roundOffset = hasPreliminaryRound ? 1 : 0;
  const stageSize = bracketSize / (2 ** Math.max(0, roundNo - 1));
  if (stageSize <= 2) return '決賽';
  if (stageSize === 4) return '4 強';
  if (stageSize === 8) return '8 強';
  if (stageSize === 16) return '16 強';
  if (stageSize === 32) return '32 強';
  if (stageSize === 64) return '64 強';
  if (stageSize === 128) return '128 強';
  if (stageSize === 256) return '256 強';
  return `Round ${Math.max(1, roundNo - roundOffset)}`;
}

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
  const [participantsRows, setParticipantsRows] = useState<any[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantSeedDrafts, setParticipantSeedDrafts] = useState<Record<string, string>>({});
  const [participantSeedSavingId, setParticipantSeedSavingId] = useState('');
  const [matchesRows, setMatchesRows] = useState<any[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [resultStartedAt, setResultStartedAt] = useState('');
  const [resultEndedAt, setResultEndedAt] = useState('');
  const [resultFrames, setResultFrames] = useState<EditableFrame[]>([{
    frameNo: 1,
    winnerSide: 'A',
    playerAScore: '0',
    playerBScore: '0',
    playerAHighestBreak: '0',
    playerBHighestBreak: '0',
  }]);
  const [resultSaving, setResultSaving] = useState(false);
  const [breakSaving, setBreakSaving] = useState(false);
  const [breakMemberId, setBreakMemberId] = useState('');
  const [breakFrameNo, setBreakFrameNo] = useState('1');
  const [breakPoints, setBreakPoints] = useState('');
  const [breakRecordedAt, setBreakRecordedAt] = useState(() => formatDateTimeLocalInput(new Date()));
  const [breakNote, setBreakNote] = useState('');
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
    setParticipantsRows([]);
    setParticipantSeedDrafts({});
    setParticipantSeedSavingId('');
    setMatchesRows([]);
    setSelectedMatchId('');
    setResultStartedAt('');
    setResultEndedAt('');
    setResultFrames([{
      frameNo: 1,
      winnerSide: 'A',
      playerAScore: '0',
      playerBScore: '0',
      playerAHighestBreak: '0',
      playerBHighestBreak: '0',
    }]);
    setBreakMemberId('');
    setBreakFrameNo('1');
    setBreakPoints('');
    setBreakRecordedAt(formatDateTimeLocalInput(new Date()));
    setBreakNote('');
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

  const loadSelectedPhase1Data = useCallback(async () => {
    if (!operatorId || !enabled || !selectedId) {
      setParticipantsRows([]);
      setMatchesRows([]);
      return;
    }
    setParticipantsLoading(true);
    setMatchesLoading(true);
    try {
      const [participantsNext, matchesNext] = await Promise.all([
        getTournamentParticipants(API_URL, operatorId, selectedId).catch(() => []),
        getTournamentMatches(API_URL, operatorId, selectedId).catch(() => []),
      ]);
      const normalizedParticipants = Array.isArray(participantsNext) ? participantsNext : [];
      setParticipantsRows(normalizedParticipants);
      setParticipantSeedDrafts(Object.fromEntries(normalizedParticipants.map((row: any, index: number) => [String(row?.id || index), String(row?.seed ?? index + 1)])));
      setMatchesRows(Array.isArray(matchesNext) ? matchesNext : []);
    } catch (e: any) {
      showNotice(e?.message || '載入賽程資料失敗', 3000);
    } finally {
      setParticipantsLoading(false);
      setMatchesLoading(false);
    }
  }, [enabled, operatorId, selectedId, showNotice]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    loadSelectedSignups();
  }, [loadSelectedSignups]);

  useEffect(() => {
    loadSelectedPhase1Data();
  }, [loadSelectedPhase1Data]);

  const selectedMatch = matchesRows.find((row: any) => String(row?.id || '') === selectedMatchId) || null;
  const selectedMatchMemberOptions = selectedMatch ? [
    {
      value: String(selectedMatch?.player_a_participant?.member?.id || ''),
      label: formatMemberLabel(selectedMatch?.player_a_participant?.member),
    },
    {
      value: String(selectedMatch?.player_b_participant?.member?.id || ''),
      label: formatMemberLabel(selectedMatch?.player_b_participant?.member),
    },
  ].filter((item) => item.value) : [];
  const bracketColumns = useMemo(() => {
    const grouped = new Map<string, Array<any>>();
    for (const row of matchesRows) {
      const key = formatKnockoutRoundLabel(row, participantsRows.length);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }
    return Array.from(grouped.entries()).map(([label, items]) => ({
      label,
      items: [...items].sort((a, b) => Number(a?.match_no || 0) - Number(b?.match_no || 0)),
    }));
  }, [matchesRows, participantsRows.length]);

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
            intro="建立、更新、上架或關閉比賽報名，並逐步管理待確認報名、正式參賽名單、淘汰賽賽程、賽果與比賽 20+。"
          steps={[
            '填寫標題、上限、截止日期、比賽時間（可選）、詳情與參賽指引後按「新增」。',
              '在下方列表可「選擇」某個比賽以查看報名名單與賽事工作台。',
            '按「上架」讓會員端可見並可報名；按「關閉」停止報名與後續操作。',
              '確認報名後，可生成正式參賽名單與淘汰賽賽程，再在同頁輸入每局賽果與記錄比賽 20+。',
          ]}
          tips={[
            '建議先完成內容後再上架，避免會員看到未完成資訊。',
            '如要在場館公開頁顯示比賽入口，請同時於場館公開設定開啟「公開比賽入口」。',
              'Phase 1 目前先接上 Knockout MVP；League 積分榜與更多賽事工作流之後再補。',
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

      {selectedId ? (
        <div className="mt-4 cue-surface-strong rounded-lg p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
            <div>
              <div className="font-semibold">正式參賽名單 / 淘汰賽工作台</div>
              <div className="text-xs cue-muted mt-1">先由已確認報名生成正式名單，再生成 Knockout 賽程。</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded cue-button text-sm font-semibold"
                onClick={async () => {
                  try {
                    await generateTournamentParticipants(API_URL, operatorId, selectedId);
                    await Promise.all([loadSelectedPhase1Data(), loadRows()]);
                    showNotice('已生成正式參賽名單');
                  } catch (e: any) {
                    showNotice(e?.message || '生成正式參賽名單失敗', 3000);
                  }
                }}
              >
                生成正式名單
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded cue-button text-sm font-semibold"
                onClick={async () => {
                  if (!confirm('確定按目前正式名單生成 Knockout 賽程？')) return;
                  try {
                    await generateTournamentKnockoutSchedule(API_URL, operatorId, selectedId);
                    await loadSelectedPhase1Data();
                    showNotice('已生成淘汰賽賽程');
                  } catch (e: any) {
                    showNotice(e?.message || '生成淘汰賽賽程失敗', 3000);
                  }
                }}
              >
                生成 Knockout 賽程
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                onClick={loadSelectedPhase1Data}
              >
                {participantsLoading || matchesLoading ? '更新中...' : '重新整理工作台'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">正式參賽名單</div>
                <div className="text-xs cue-muted">{participantsLoading ? '讀取中…' : `${participantsRows.length} 人`}</div>
              </div>
              {participantsLoading ? (
                <div className="text-sm cue-muted">讀取中…</div>
              ) : participantsRows.length === 0 ? (
                <div className="text-sm cue-muted">尚未生成正式參賽名單</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">Seed</th>
                        <th className="py-2 px-2">球手</th>
                        <th className="py-2 px-2">狀態</th>
                        <th className="py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participantsRows.map((row: any, index) => {
                        const rowId = String(row?.id || index);
                        const seedDraft = participantSeedDrafts[rowId] ?? String(row?.seed ?? index + 1);
                        const isSaving = participantSeedSavingId === rowId;
                        return (
                        <tr key={rowId} className="border-b cue-border hover:brightness-95">
                          <td className="py-2 px-2 w-28">
                            <input
                              type="number"
                              min={1}
                              value={seedDraft}
                              onChange={(e) => setParticipantSeedDrafts((prev) => ({ ...prev, [rowId]: e.target.value }))}
                              className="w-full px-2 py-1 rounded cue-input"
                              disabled={isSaving}
                            />
                          </td>
                          <td className="py-2 px-2 font-semibold">{formatMemberLabel(row?.member)}</td>
                          <td className="py-2 px-2 cue-muted">{String(row?.status || '-')}</td>
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              disabled={isSaving}
                              className={`px-3 py-1 rounded text-sm font-semibold ${isSaving ? 'cue-surface-strong cue-muted' : 'cue-surface hover:brightness-95'}`}
                              onClick={async () => {
                                try {
                                  const seed = Math.max(1, Math.floor(Number(seedDraft || 1)));
                                  setParticipantSeedSavingId(rowId);
                                  const result = await updateTournamentParticipant(API_URL, operatorId, selectedId, rowId, { seed });
                                  const next = Array.isArray((result as any)?.participants) ? (result as any).participants : [];
                                  setParticipantsRows(next);
                                  setParticipantSeedDrafts(Object.fromEntries(next.map((item: any, itemIndex: number) => [String(item?.id || itemIndex), String(item?.seed ?? itemIndex + 1)])));
                                  showNotice('已更新 seed');
                                } catch (e: any) {
                                  showNotice(e?.message || '更新 seed 失敗', 3000);
                                } finally {
                                  setParticipantSeedSavingId('');
                                }
                              }}
                            >
                              {isSaving ? '儲存中...' : '更新 seed'}
                            </button>
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="font-semibold">Knockout 賽程</div>
                <div className="text-xs cue-muted">{matchesLoading ? '讀取中…' : `${matchesRows.length} 場`}</div>
              </div>
              {matchesLoading ? (
                <div className="text-sm cue-muted">讀取中…</div>
              ) : matchesRows.length === 0 ? (
                <div className="text-sm cue-muted">尚未生成賽程</div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="cue-muted border-b cue-border">
                        <th className="py-2 px-2">輪次</th>
                        <th className="py-2 px-2">對賽</th>
                        <th className="py-2 px-2">狀態</th>
                        <th className="py-2 px-2">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matchesRows.map((row: any) => {
                        const id = String(row?.id || '');
                        const aLabel = formatMemberLabel(row?.player_a_participant?.member);
                        const bLabel = formatMemberLabel(row?.player_b_participant?.member);
                        const roundLabel = formatKnockoutRoundLabel(row, participantsRows.length);
                        return (
                          <tr key={id} className={`border-b cue-border hover:brightness-95 ${selectedMatchId === id ? 'bg-white/5' : ''}`}>
                            <td className="py-2 px-2 whitespace-nowrap">
                              <div>{roundLabel}</div>
                              <div className="text-xs cue-muted mt-0.5">R{row?.round_no || '-'} / M{row?.match_no || '-'}</div>
                            </td>
                            <td className="py-2 px-2">{aLabel} vs {bLabel}</td>
                            <td className="py-2 px-2 cue-muted">{String(row?.status || '-')}</td>
                            <td className="py-2 px-2">
                              <button
                                type="button"
                                className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                                onClick={() => {
                                  setSelectedMatchId(id);
                                  setResultStartedAt(formatDateTimeLocalInput(row?.started_at));
                                  setResultEndedAt(formatDateTimeLocalInput(row?.ended_at));
                                  setResultFrames(buildFramesFromMatch(row));
                                  setBreakMemberId(String(row?.player_a_participant?.member?.id || row?.player_b_participant?.member?.id || ''));
                                  setBreakFrameNo(String((Array.isArray(row?.frames) && row.frames.length > 0 ? row.frames.length : 1) || 1));
                                }}
                              >
                                {selectedMatchId === id ? '已選擇' : '記錄賽果'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {matchesRows.length > 0 ? (
            <div className="mt-5">
              <div className="font-semibold mb-2">Knockout Bracket</div>
              <div className="overflow-x-auto -mx-2 px-2">
                <div className="flex gap-3 min-w-max">
                  {bracketColumns.map((column) => (
                    <div key={column.label} className="w-72 cue-surface rounded-lg p-3">
                      <div className="font-semibold mb-3">{column.label}</div>
                      <div className="grid gap-3">
                        {column.items.map((row: any) => {
                          const id = String(row?.id || '');
                          const aLabel = formatMemberLabel(row?.player_a_participant?.member);
                          const bLabel = formatMemberLabel(row?.player_b_participant?.member);
                          const winnerId = String(row?.winner_participant_id || '');
                          const aParticipantId = String(row?.player_a_participant_id || '');
                          const bParticipantId = String(row?.player_b_participant_id || '');
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => {
                                setSelectedMatchId(id);
                                setResultStartedAt(formatDateTimeLocalInput(row?.started_at));
                                setResultEndedAt(formatDateTimeLocalInput(row?.ended_at));
                                setResultFrames(buildFramesFromMatch(row));
                                setBreakMemberId(String(row?.player_a_participant?.member?.id || row?.player_b_participant?.member?.id || ''));
                                setBreakFrameNo(String((Array.isArray(row?.frames) && row.frames.length > 0 ? row.frames.length : 1) || 1));
                              }}
                              className={`text-left rounded-lg border p-3 transition-colors ${selectedMatchId === id ? 'border-yellow-400 bg-white/5' : 'cue-border hover:brightness-95'}`}
                            >
                              <div className="text-xs cue-muted mb-2">M{row?.match_no || '-'} / {String(row?.status || '-')}</div>
                              <div className={`font-semibold ${winnerId && winnerId === aParticipantId ? 'accent-yellow' : ''}`}>{aLabel}</div>
                              <div className="text-xs cue-muted my-1">
                                {Number(row?.player_a_frames_won ?? 0)} : {Number(row?.player_b_frames_won ?? 0)}
                              </div>
                              <div className={`font-semibold ${winnerId && winnerId === bParticipantId ? 'accent-yellow' : ''}`}>{bLabel}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedId && selectedMatch ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="cue-surface-strong rounded-lg p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-semibold">輸入賽果</div>
                <div className="text-xs cue-muted mt-1">
                  {formatMemberLabel(selectedMatch?.player_a_participant?.member)} vs {formatMemberLabel(selectedMatch?.player_b_participant?.member)}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                  onClick={() => {
                    setResultFrames((prev) => [
                      ...prev,
                      {
                        frameNo: prev.length + 1,
                        winnerSide: 'A',
                        playerAScore: '0',
                        playerBScore: '0',
                        playerAHighestBreak: '0',
                        playerBHighestBreak: '0',
                      },
                    ]);
                  }}
                >
                  加一局
                </button>
                <button
                  type="button"
                  className="px-3 py-1 rounded cue-surface hover:brightness-95 text-sm font-semibold"
                  onClick={() => setResultFrames((prev) => prev.length > 1 ? prev.slice(0, -1) : prev)}
                >
                  減一局
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 mb-3">
              <div>
                <label className="block text-sm mb-1 cue-muted">開賽時間（可選）</label>
                <input type="datetime-local" value={resultStartedAt} onChange={(e) => setResultStartedAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">完賽時間（可選）</label>
                <input type="datetime-local" value={resultEndedAt} onChange={(e) => setResultEndedAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" />
              </div>
            </div>

            <div className="grid gap-3">
              {resultFrames.map((frame, index) => (
                <div key={frame.frameNo} className="rounded-lg border cue-border p-3">
                  <div className="font-semibold mb-2">第 {index + 1} 局</div>
                  <div className="grid gap-3 md:grid-cols-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1 cue-muted">勝方</label>
                      <select
                        value={frame.winnerSide}
                        onChange={(e) => {
                          const winnerSide = (e.target.value === 'B' ? 'B' : 'A');
                          setResultFrames((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, winnerSide } : item));
                        }}
                        className="w-full px-3 py-2 rounded cue-input"
                      >
                        <option value="A">{formatMemberLabel(selectedMatch?.player_a_participant?.member)}</option>
                        <option value="B">{formatMemberLabel(selectedMatch?.player_b_participant?.member)}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm mb-1 cue-muted">A 分數</label>
                      <input value={frame.playerAScore} onChange={(e) => setResultFrames((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, playerAScore: e.target.value } : item))} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 cue-muted">B 分數</label>
                      <input value={frame.playerBScore} onChange={(e) => setResultFrames((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, playerBScore: e.target.value } : item))} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 cue-muted">A 最高 break</label>
                      <input value={frame.playerAHighestBreak} onChange={(e) => setResultFrames((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, playerAHighestBreak: e.target.value } : item))} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 cue-muted">B 最高 break</label>
                      <input value={frame.playerBHighestBreak} onChange={(e) => setResultFrames((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, playerBHighestBreak: e.target.value } : item))} className="w-full px-3 py-2 rounded cue-input" type="number" min={0} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={resultSaving}
                className={`px-4 py-2 rounded font-semibold ${resultSaving ? 'cue-surface-strong cue-muted' : 'brand-button text-black'}`}
                onClick={async () => {
                  try {
                    if (!selectedMatchId) throw new Error('請先選擇賽事對局');
                    const frames = resultFrames.map((frame, index) => ({
                      frameNo: index + 1,
                      winnerSide: frame.winnerSide,
                      playerAScore: Math.max(0, Math.floor(Number(frame.playerAScore || 0))),
                      playerBScore: Math.max(0, Math.floor(Number(frame.playerBScore || 0))),
                      playerAHighestBreak: Math.max(0, Math.floor(Number(frame.playerAHighestBreak || 0))),
                      playerBHighestBreak: Math.max(0, Math.floor(Number(frame.playerBHighestBreak || 0))),
                    }));
                    setResultSaving(true);
                    await recordTournamentMatchResult(API_URL, operatorId, selectedId, selectedMatchId, {
                      startedAt: resultStartedAt ? new Date(resultStartedAt).toISOString() : null,
                      endedAt: resultEndedAt ? new Date(resultEndedAt).toISOString() : null,
                      frames,
                    });
                    await loadSelectedPhase1Data();
                    showNotice('已記錄賽果');
                  } catch (e: any) {
                    showNotice(e?.message || '記錄賽果失敗', 3000);
                  } finally {
                    setResultSaving(false);
                  }
                }}
              >
                {resultSaving ? '儲存中...' : '儲存賽果'}
              </button>
            </div>
          </div>

          <div className="cue-surface-strong rounded-lg p-4">
            <div className="font-semibold mb-3">記錄比賽 20+</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">球手</label>
                <select value={breakMemberId} onChange={(e) => setBreakMemberId(e.target.value)} className="w-full px-3 py-2 rounded cue-input">
                  <option value="">選擇球手</option>
                  {selectedMatchMemberOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">第幾局</label>
                <input value={breakFrameNo} onChange={(e) => setBreakFrameNo(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="number" min={1} />
              </div>
              <div>
                <label className="block text-sm mb-1 cue-muted">Break 分數</label>
                <input value={breakPoints} onChange={(e) => setBreakPoints(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="number" min={20} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">記錄時間（可選）</label>
                <input value={breakRecordedAt} onChange={(e) => setBreakRecordedAt(e.target.value)} className="w-full px-3 py-2 rounded cue-input" type="datetime-local" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm mb-1 cue-muted">備註（可空）</label>
                <input value={breakNote} onChange={(e) => setBreakNote(e.target.value)} className="w-full px-3 py-2 rounded cue-input" placeholder="例如：清枱 34、關鍵局" />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={breakSaving}
                className={`px-4 py-2 rounded font-semibold ${breakSaving ? 'cue-surface-strong cue-muted' : 'brand-button text-black'}`}
                onClick={async () => {
                  try {
                    if (!selectedMatchId) throw new Error('請先選擇賽事對局');
                    if (!breakMemberId) throw new Error('請先選擇球手');
                    const points = Math.floor(Number(breakPoints));
                    if (!Number.isFinite(points) || points < 20) throw new Error('20+ 分數不正確');
                    setBreakSaving(true);
                    await createTournamentMatchBreak(API_URL, operatorId, selectedId, selectedMatchId, {
                      memberId: breakMemberId,
                      points,
                      frameNo: Math.max(1, Math.floor(Number(breakFrameNo || 1))),
                      recordedAt: breakRecordedAt ? new Date(breakRecordedAt).toISOString() : null,
                      note: breakNote || null,
                    });
                    await loadSelectedPhase1Data();
                    setBreakPoints('');
                    setBreakNote('');
                    showNotice('已記錄比賽 20+');
                  } catch (e: any) {
                    showNotice(e?.message || '記錄 20+ 失敗', 3000);
                  } finally {
                    setBreakSaving(false);
                  }
                }}
              >
                {breakSaving ? '儲存中...' : '新增 20+ 記錄'}
              </button>
            </div>
            <div className="mt-4 text-xs cue-muted">
              提示：目前 Phase 1 先把 `20+ break` 正式寫入比賽紀錄；League、完整 standings 與更細 live scoring 之後再補。
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default VenueTournamentsModule;
