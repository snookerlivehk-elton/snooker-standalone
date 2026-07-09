import { parseMonthRangeUtc } from '../utils/query.js';

type ListUnifiedBreakRowsArgs = {
  prismaClient: any;
  memberId?: string;
  clubId?: string;
  month?: string;
  minPoints?: number;
};

function toRecordedAt(row: any): Date | null {
  const raw = row?.ended_at
    ?? row?.started_at
    ?? row?.tournament_match?.ended_at
    ?? row?.tournament_match?.started_at
    ?? row?.tournament_match?.tournament?.startsAt
    ?? row?.tournament?.startsAt
    ?? null;
  if (!raw) return null;
  const date = new Date(String(raw));
  return Number.isFinite(date.getTime()) ? date : null;
}

function withinMonth(date: Date | null, month?: string) {
  if (!month) return true;
  const range = parseMonthRangeUtc(month);
  if (!range) throw new Error('month invalid');
  if (!date) return false;
  const time = date.getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
}

function buildBreakKey(matchId: string, frameNo: number, memberId: string) {
  return `${matchId}::${frameNo}::${memberId}`;
}

function normalizeMinPoints(raw?: number) {
  const value = Number(raw || 0);
  if (!Number.isFinite(value)) throw new Error('minPoints invalid');
  if (value <= 0) return 0;
  return Math.max(1, Math.floor(value));
}

export async function listUnifiedBreakRows({
  prismaClient,
  memberId = '',
  clubId = '',
  month = '',
  minPoints = 0,
}: ListUnifiedBreakRowsArgs) {
  const normalizedMinPoints = normalizeMinPoints(minPoints);
  const explicitWhere: any = { deleted_at: null };
  if (memberId) explicitWhere.member_id = memberId;
  if (clubId) explicitWhere.club_id = clubId;
  if (normalizedMinPoints > 0) explicitWhere.points = { gte: normalizedMinPoints };
  if (month) {
    const range = parseMonthRangeUtc(month);
    if (!range) throw new Error('month invalid');
    explicitWhere.recorded_at = { gte: range.start, lt: range.end };
  }

  const explicitRows = await prismaClient.breakRecord.findMany({
    where: explicitWhere,
    orderBy: [{ recorded_at: 'desc' }],
    include: {
      member: { select: { id: true, name: true, email: true, member_code: true } },
      club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
      tournament: { select: { id: true, title: true, startsAt: true, format: true, tracked_break_threshold: true } },
    },
  });

  const explicitKeys = new Set(
    explicitRows
      .filter((row: any) => (
        String(row?.record_type || '').trim().toUpperCase() === 'TOURNAMENT'
        && row?.tournament_match_id
        && Number(row?.frame_no || 0) > 0
        && row?.member_id
      ))
      .map((row: any) => buildBreakKey(
        String(row.tournament_match_id),
        Number(row.frame_no || 0),
        String(row.member_id),
      )),
  );

  const frameWhere: any = {
    OR: [
      { player_a_highest_break: { gte: Math.max(20, normalizedMinPoints || 20) } },
      { player_b_highest_break: { gte: Math.max(20, normalizedMinPoints || 20) } },
    ],
  };
  if (clubId || memberId) {
    frameWhere.tournament_match = {};
    if (memberId) {
      frameWhere.tournament_match.OR = [
        { player_a_participant: { is: { member_id: memberId } } },
        { player_b_participant: { is: { member_id: memberId } } },
      ];
    }
    if (clubId) {
      frameWhere.tournament_match.tournament = { is: { clubId } };
    }
  }

  const frames = await prismaClient.tournamentFrame.findMany({
    where: frameWhere,
    include: {
      tournament_match: {
        include: {
          tournament: {
            select: {
              id: true,
              title: true,
              startsAt: true,
              format: true,
              tracked_break_threshold: true,
              club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
            },
          },
          player_a_participant: {
            include: { member: { select: { id: true, name: true, email: true, member_code: true } } },
          },
          player_b_participant: {
            include: { member: { select: { id: true, name: true, email: true, member_code: true } } },
          },
        },
      },
    },
    orderBy: [{ ended_at: 'desc' }, { started_at: 'desc' }, { frame_no: 'desc' }],
  });

  const syntheticRows: any[] = [];
  for (const frame of frames) {
    const match = frame?.tournament_match;
    const tournament = match?.tournament;
    if (!match || !tournament) continue;
    const threshold = Math.max(1, Number(tournament?.tracked_break_threshold || 20));
    const recordedAt = toRecordedAt(frame) ?? toRecordedAt(match) ?? null;
    if (!withinMonth(recordedAt, month || undefined)) continue;

    const playerA = match?.player_a_participant;
    const playerB = match?.player_b_participant;
    const frameNo = Math.max(1, Number(frame?.frame_no || 1));
    const candidates = [
      {
        side: 'A',
        memberId: String(playerA?.member?.id || playerA?.member_id || ''),
        member: playerA?.member || null,
        points: Number(frame?.player_a_highest_break || 0),
      },
      {
        side: 'B',
        memberId: String(playerB?.member?.id || playerB?.member_id || ''),
        member: playerB?.member || null,
        points: Number(frame?.player_b_highest_break || 0),
      },
    ];

    for (const candidate of candidates) {
      if (!candidate.memberId || !candidate.member) continue;
      if (memberId && candidate.memberId !== memberId) continue;
      if (candidate.points < threshold) continue;
      const key = buildBreakKey(String(match.id), frameNo, candidate.memberId);
      if (explicitKeys.has(key)) continue;

      syntheticRows.push({
        id: `derived-${String(match.id)}-${frameNo}-${candidate.memberId}`,
        club_id: String(tournament?.club?.id || clubId || ''),
        member_id: candidate.memberId,
        record_type: 'TOURNAMENT',
        tournament_id: String(tournament.id),
        tournament_match_id: String(match.id),
        frame_no: frameNo,
        threshold_snapshot: threshold,
        points: candidate.points,
        recorded_at: recordedAt,
        video_url: null,
        note: null,
        created_at: recordedAt,
        source: 'FRAME_FALLBACK',
        source_key: key,
        can_edit_video: true,
        video_edit_mode: 'MATERIALIZE',
        member: candidate.member,
        club: tournament.club
          ? {
              ...tournament.club,
              name: tournament.club.name || tournament.club.member?.name || '',
            }
          : null,
        tournament: {
          id: tournament.id,
          title: tournament.title,
          startsAt: tournament.startsAt,
          format: tournament.format,
          tracked_break_threshold: tournament.tracked_break_threshold,
        },
      });
    }
  }

  const mergedRows = [
    ...explicitRows.map((row: any) => ({
      ...row,
      source: 'EXPLICIT',
      source_key: String(row?.id || ''),
      can_edit_video: true,
      video_edit_mode: 'PATCH',
      club: row.club
        ? {
            ...row.club,
            name: row.club.name || row.club.member?.name || '',
          }
        : null,
    })),
    ...syntheticRows,
  ];

  mergedRows.sort((a: any, b: any) => {
    const aTime = a?.recorded_at ? new Date(String(a.recorded_at)).getTime() : 0;
    const bTime = b?.recorded_at ? new Date(String(b.recorded_at)).getTime() : 0;
    if (aTime !== bTime) return bTime - aTime;
    return Number(b?.points || 0) - Number(a?.points || 0);
  });

  return mergedRows;
}
