import express from 'express';
import { randomUUID } from 'crypto';
import { getMyClubId, requireClubAdmin } from '../../core/club/access.js';
import { prisma } from '../../core/db/prisma.js';
import { listUnifiedBreakRows } from '../../core/highbreak/unifiedBreakRows.js';
import { getEffectiveClubHighbreakSettings, getHighbreakModuleSettings } from '../../core/modules/highbreakSettings.js';
import { parseLimit, parseMonthRangeUtc } from '../../core/utils/query.js';

type BreakRecordType = 'VENUE' | 'TOURNAMENT';
type BreakScope = 'ALL' | 'VENUE' | 'TOURNAMENT';

function normalizeBreakRecordType(raw: any): BreakRecordType | null {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'VENUE' || value === 'TOURNAMENT') return value;
  return null;
}

function parseMinPoints(raw: any) {
  if (raw == null || String(raw).trim() === '') return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error('minPoints invalid');
  return Math.floor(value);
}

function parseScope(raw: any, fallback: BreakScope = 'ALL'): BreakScope {
  const value = String(raw == null ? '' : raw).trim().toUpperCase();
  if (!value) return fallback;
  if (value === 'VENUE' || value === 'TOURNAMENT') return value;
  if (value === 'ALL') return 'ALL';
  throw new Error('scope invalid');
}

export function createClubHighbreakRouter() {
  const router = express.Router();

  router.post('/breaks', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });

    const payload = req.body || {};
    const targetMemberId = String(payload.memberId || '').trim();
    const points = Number(payload.points);
    const recordedAtRaw = payload.recordedAt;
    const videoUrl = payload.videoUrl == null ? null : String(payload.videoUrl).trim() || null;
    const note = payload.note == null ? null : String(payload.note).trim() || null;

    if (!targetMemberId) return res.status(400).json({ error: 'memberId required' });
    if (!Number.isFinite(points) || points <= 0) return res.status(400).json({ error: 'points invalid' });

    const membership = await prisma.clubMember.findUnique({
      where: { clubId_memberId: { clubId, memberId: targetMemberId } },
    });
    if (!membership) return res.status(400).json({ error: 'Member not in club' });

    const recorded_at = recordedAtRaw ? new Date(String(recordedAtRaw)) : new Date();
    if (recordedAtRaw && Number.isNaN(recorded_at.getTime())) return res.status(400).json({ error: 'recordedAt invalid' });

    const row = await prisma.breakRecord.create({
      data: {
        id: randomUUID(),
        club_id: clubId,
        member_id: targetMemberId,
        record_type: 'VENUE',
        points: Math.floor(points),
        recorded_at,
        video_url: videoUrl,
        note,
        created_by_member_id: member.id,
      },
      include: {
        member: { select: { id: true, name: true, email: true, member_code: true } },
        club: { select: { id: true, name: true, member: { select: { name: true } } } },
        tournament: { select: { id: true, title: true, startsAt: true } },
      },
    });
    res.json(row);
  });

  router.get('/breaks', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const { month, memberId, minPoints, scope } = req.query as any;
    if (month) {
      const range = parseMonthRangeUtc(String(month));
      if (!range) return res.status(400).json({ error: 'month invalid' });
    }
    let normalizedMinPoints = 0;
    try {
      normalizedMinPoints = parseMinPoints(minPoints);
    } catch (err: any) {
      return res.status(400).json({ error: String(err?.message || err) });
    }
    const effectiveSettings = await getEffectiveClubHighbreakSettings(clubId);
    let normalizedScope: BreakScope = effectiveSettings.effectiveScope;
    try {
      normalizedScope = parseScope(scope, effectiveSettings.effectiveScope);
    } catch (err: any) {
      return res.status(400).json({ error: String(err?.message || err) });
    }
    const rows = await listUnifiedBreakRows({
      prismaClient: prisma,
      clubId,
      memberId: memberId ? String(memberId).trim() : '',
      month: month ? String(month).trim() : '',
      minPoints: normalizedMinPoints,
      scope: normalizedScope,
    });
    res.json(rows);
  });

  router.patch('/breaks/:id/video', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'breakId required' });

    const payload = req.body || {};
    const videoUrl = payload.videoUrl == null ? null : String(payload.videoUrl).trim() || null;
    const note = payload.note == null ? undefined : String(payload.note).trim() || null;
    const source = String(payload.source || '').trim().toUpperCase();

    try {
      if (source === 'FRAME_FALLBACK') {
        const tournamentMatchId = String(payload.tournamentMatchId || '').trim();
        const memberId = String(payload.memberId || '').trim();
        const tournamentId = String(payload.tournamentId || '').trim();
        const frameNo = Math.max(1, Number(payload.frameNo || 0));
        const points = Math.floor(Number(payload.points || 0));
        const recordedAt = payload.recordedAt ? new Date(String(payload.recordedAt)) : new Date();

        if (!tournamentMatchId || !memberId || !tournamentId) return res.status(400).json({ error: 'fallback payload invalid' });
        if (!Number.isFinite(frameNo) || frameNo <= 0) return res.status(400).json({ error: 'frameNo invalid' });
        if (!Number.isFinite(points) || points <= 0) return res.status(400).json({ error: 'points invalid' });
        if (Number.isNaN(recordedAt.getTime())) return res.status(400).json({ error: 'recordedAt invalid' });

        const match = await prisma.tournamentMatch.findUnique({
          where: { id: tournamentMatchId },
          include: {
            tournament: {
              select: {
                id: true,
                clubId: true,
                tracked_break_threshold: true,
              },
            },
            player_a_participant: { select: { member_id: true } },
            player_b_participant: { select: { member_id: true } },
          },
        });
        if (!match || String(match?.tournament?.clubId || '') !== clubId) return res.status(404).json({ error: 'break not found' });
        if (String(match?.tournament?.id || '') !== tournamentId) return res.status(400).json({ error: 'tournamentId mismatch' });

        const allowedMemberIds = new Set([
          String(match?.player_a_participant?.member_id || ''),
          String(match?.player_b_participant?.member_id || ''),
        ].filter(Boolean));
        if (!allowedMemberIds.has(memberId)) return res.status(400).json({ error: 'memberId not in match' });

        const threshold = Math.max(1, Number(match?.tournament?.tracked_break_threshold || 20));
        if (points < threshold) return res.status(400).json({ error: `points must be >= ${threshold}` });

        const existing = await prisma.breakRecord.findFirst({
          where: {
            deleted_at: null,
            club_id: clubId,
            member_id: memberId,
            record_type: 'TOURNAMENT',
            tournament_id: tournamentId,
            tournament_match_id: tournamentMatchId,
            frame_no: frameNo,
          },
          orderBy: [{ points: 'desc' }, { recorded_at: 'desc' }],
          include: {
            member: { select: { id: true, name: true, email: true, member_code: true } },
            club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
            tournament: { select: { id: true, title: true, startsAt: true, format: true, tracked_break_threshold: true } },
          },
        });

        const row = existing
          ? await prisma.breakRecord.update({
              where: { id: existing.id },
              data: {
                video_url: videoUrl,
                ...(note !== undefined ? { note } : {}),
                updated_at: new Date(),
              },
              include: {
                member: { select: { id: true, name: true, email: true, member_code: true } },
                club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
                tournament: { select: { id: true, title: true, startsAt: true, format: true, tracked_break_threshold: true } },
              },
            })
          : await prisma.breakRecord.create({
              data: {
                id: randomUUID(),
                club_id: clubId,
                member_id: memberId,
                record_type: 'TOURNAMENT',
                tournament_id: tournamentId,
                tournament_match_id: tournamentMatchId,
                frame_no: frameNo,
                threshold_snapshot: threshold,
                points,
                recorded_at: recordedAt,
                video_url: videoUrl,
                note: note === undefined ? null : note,
                created_by_member_id: member.id,
              },
              include: {
                member: { select: { id: true, name: true, email: true, member_code: true } },
                club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
                tournament: { select: { id: true, title: true, startsAt: true, format: true, tracked_break_threshold: true } },
              },
            });

        return res.json({
          ...row,
          source: 'EXPLICIT',
          source_key: String(row.id),
          can_edit_video: true,
          video_edit_mode: 'PATCH',
          club: row.club
            ? {
                ...row.club,
                name: row.club.name || row.club.member?.name || '',
              }
            : null,
        });
      }

      const existing = await prisma.breakRecord.findFirst({
        where: {
          id,
          club_id: clubId,
          deleted_at: null,
        },
        include: {
          member: { select: { id: true, name: true, email: true, member_code: true } },
          club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
          tournament: { select: { id: true, title: true, startsAt: true, format: true, tracked_break_threshold: true } },
        },
      });
      if (!existing) return res.status(404).json({ error: 'break not found' });

      const row = await prisma.breakRecord.update({
        where: { id: existing.id },
        data: {
          video_url: videoUrl,
          ...(note !== undefined ? { note } : {}),
          updated_at: new Date(),
        },
        include: {
          member: { select: { id: true, name: true, email: true, member_code: true } },
          club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
          tournament: { select: { id: true, title: true, startsAt: true, format: true, tracked_break_threshold: true } },
        },
      });

      return res.json({
        ...row,
        source: 'EXPLICIT',
        source_key: String(row.id),
        can_edit_video: true,
        video_edit_mode: 'PATCH',
        club: row.club
          ? {
              ...row.club,
              name: row.club.name || row.club.member?.name || '',
            }
          : null,
      });
    } catch (err: any) {
      return res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/:clubId/leaderboard/highest', async (req, res) => {
    const clubId = String(req.params.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(50, Math.max(1, Number(limitRaw || 10) || 10));
    const effectiveSettings = await getEffectiveClubHighbreakSettings(clubId);
    let minPoints = 0;
    let scope: BreakScope = effectiveSettings.effectiveScope;
    try {
      minPoints = parseMinPoints(req.query.minPoints);
      scope = parseScope(req.query.scope, effectiveSettings.effectiveScope);
    } catch (err: any) {
      return res.status(400).json({ error: String(err?.message || err) });
    }

    const allRows = await listUnifiedBreakRows({
      prismaClient: prisma,
      clubId,
      minPoints,
      scope,
    });
    const rows = [...allRows]
      .sort((a: any, b: any) => {
        const pointDiff = Number(b?.points || 0) - Number(a?.points || 0);
        if (pointDiff !== 0) return pointDiff;
        const aTime = a?.recorded_at ? new Date(String(a.recorded_at)).getTime() : 0;
        const bTime = b?.recorded_at ? new Date(String(b.recorded_at)).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);
    res.json(rows);
  });

  router.get('/:clubId/leaderboard/settings', async (req, res) => {
    const clubId = String(req.params.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    try {
      const result = await getEffectiveClubHighbreakSettings(clubId);
      res.json({
        clubId,
        ...result,
      });
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/:clubId/leaderboard/monthly', async (req, res) => {
    const clubId = String(req.params.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const month = req.query.month ? String(req.query.month) : '';
    const range = month ? parseMonthRangeUtc(month) : null;
    if (month && !range) return res.status(400).json({ error: 'month invalid' });

    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(50, Math.max(1, Number(limitRaw || 10) || 10));
    const effectiveSettings = await getEffectiveClubHighbreakSettings(clubId);
    let minPoints = 0;
    let scope: BreakScope = effectiveSettings.effectiveScope;
    try {
      minPoints = parseMinPoints(req.query.minPoints);
      scope = parseScope(req.query.scope, effectiveSettings.effectiveScope);
    } catch (err: any) {
      return res.status(400).json({ error: String(err?.message || err) });
    }

    const allRows = await listUnifiedBreakRows({
      prismaClient: prisma,
      clubId,
      month,
      minPoints,
      scope,
    });
    const groupedMap = new Map<string, { member: any; totalPoints: number }>();
    for (const row of allRows) {
      const memberKey = String(row?.member_id || '');
      if (!memberKey) continue;
      const current = groupedMap.get(memberKey) || {
        member: row?.member || { id: memberKey, name: '-', email: null, member_code: null },
        totalPoints: 0,
      };
      current.totalPoints += Number(row?.points || 0);
      if (!current.member && row?.member) current.member = row.member;
      groupedMap.set(memberKey, current);
    }
    const grouped = Array.from(groupedMap.entries())
      .map(([memberId, value]) => ({
        memberId,
        member: value.member || { id: memberId, name: '-', email: null, member_code: null },
        totalPoints: value.totalPoints,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, limit);

    res.json(grouped.map((row) => ({
      member: row.member,
      totalPoints: row.totalPoints,
    })));
  });

  return router;
}

async function listPublicHighbreakClubIds(regionCode?: string, districtCode?: string) {
  const memberWhere: any = {};
  if (regionCode) memberWhere.region_code = regionCode;
  if (districtCode) memberWhere.district_code = districtCode;
  const rows = await prisma.clubProfile.findMany({
    where: {
      publicEnabled: true,
      publicShowHighbreak: true,
      ...(Object.keys(memberWhere).length > 0 ? { member: memberWhere } : {}),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function listPublicHighbreakMemberIds(regionCode?: string, districtCode?: string) {
  const rows = await prisma.member.findMany({
    where: {
      public_highbreak_enabled: true,
      ...(regionCode ? { region_code: regionCode } : {}),
      ...(districtCode ? { district_code: districtCode } : {}),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export function createSystemHighbreakRouter(adminAuth: express.RequestHandler) {
  const router = express.Router();

  router.get('/api/leaderboard/settings', async (_req, res) => {
    try {
      const settings = await getHighbreakModuleSettings();
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/leaderboard/members/highest', async (req, res) => {
    try {
      const take = parseLimit(req.query.limit, 10);
      const regionCode = String(req.query.regionCode || '').trim().toUpperCase();
      const districtCode = String(req.query.districtCode || '').trim().toUpperCase();
      const settings = await getHighbreakModuleSettings();
      let minPoints = 0;
      let scope: BreakScope = settings.defaultLeaderboardScope;
      try {
        minPoints = parseMinPoints(req.query.minPoints);
        scope = parseScope(req.query.scope, settings.defaultLeaderboardScope);
      } catch (err: any) {
        return res.status(400).json({ error: String(err?.message || err) });
      }
      const [clubIds, memberIds] = await Promise.all([
        listPublicHighbreakClubIds(regionCode || undefined, districtCode || undefined),
        listPublicHighbreakMemberIds(regionCode || undefined, districtCode || undefined),
      ]);
      if (clubIds.length === 0 || memberIds.length === 0) return res.json([]);
      const rows = await listUnifiedBreakRows({
        prismaClient: prisma,
        clubIds,
        memberIds,
        minPoints,
        scope,
      });
      const grouped = new Map<string, { member: any; points: number }>();
      for (const row of rows) {
        const memberKey = String(row?.member_id || '');
        if (!memberKey) continue;
        const current = grouped.get(memberKey);
        const points = Number(row?.points || 0);
        if (!current || points > current.points) {
          grouped.set(memberKey, {
            member: row?.member || null,
            points,
          });
        }
      }
      const ranked = Array.from(grouped.entries())
        .map(([memberId, value]) => ({
          memberId,
          member: value.member,
          points: value.points,
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return String(a.memberId).localeCompare(String(b.memberId));
        })
        .slice(0, take);
      const ids = ranked.map((r) => r.memberId);
      const members = await prisma.member.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, member_code: true },
      });
      const memberMap = new Map(members.map((m) => [m.id, m]));
      res.json(ranked.map((r) => ({
        memberId: r.memberId,
        member: memberMap.get(r.memberId) || r.member || null,
        points: r.points || 0,
      })));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/leaderboard/members/monthly', async (req, res) => {
    try {
      const take = parseLimit(req.query.limit, 10);
      const month = String(req.query.month || '').trim();
      const regionCode = String(req.query.regionCode || '').trim().toUpperCase();
      const districtCode = String(req.query.districtCode || '').trim().toUpperCase();
      const settings = await getHighbreakModuleSettings();
      let minPoints = 0;
      let scope: BreakScope = settings.defaultLeaderboardScope;
      try {
        minPoints = parseMinPoints(req.query.minPoints);
        scope = parseScope(req.query.scope, settings.defaultLeaderboardScope);
      } catch (err: any) {
        return res.status(400).json({ error: String(err?.message || err) });
      }
      const range = parseMonthRangeUtc(month);
      if (!range) return res.status(400).json({ error: 'month invalid' });

      const [clubIds, memberIds] = await Promise.all([
        listPublicHighbreakClubIds(regionCode || undefined, districtCode || undefined),
        listPublicHighbreakMemberIds(regionCode || undefined, districtCode || undefined),
      ]);
      if (clubIds.length === 0 || memberIds.length === 0) return res.json([]);
      const rows = await listUnifiedBreakRows({
        prismaClient: prisma,
        clubIds,
        memberIds,
        month,
        minPoints,
        scope,
      });
      const grouped = new Map<string, { member: any; points: number }>();
      for (const row of rows) {
        const memberKey = String(row?.member_id || '');
        if (!memberKey) continue;
        const current = grouped.get(memberKey) || {
          member: row?.member || null,
          points: 0,
        };
        current.points += Number(row?.points || 0);
        if (!current.member && row?.member) current.member = row.member;
        grouped.set(memberKey, current);
      }
      const ranked = Array.from(grouped.entries())
        .map(([memberId, value]) => ({
          memberId,
          member: value.member,
          points: value.points,
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return String(a.memberId).localeCompare(String(b.memberId));
        })
        .slice(0, take);
      const ids = ranked.map((r) => r.memberId);
      const members = await prisma.member.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, member_code: true },
      });
      const memberMap = new Map(members.map((m) => [m.id, m]));
      res.json(ranked.map((r) => ({
        memberId: r.memberId,
        member: memberMap.get(r.memberId) || r.member || null,
        points: r.points || 0,
      })));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/leaderboard/clubs/highest', async (req, res) => {
    try {
      const take = parseLimit(req.query.limit, 10);
      const regionCode = String(req.query.regionCode || '').trim().toUpperCase();
      const districtCode = String(req.query.districtCode || '').trim().toUpperCase();
      const settings = await getHighbreakModuleSettings();
      let minPoints = 0;
      let scope: BreakScope = settings.defaultLeaderboardScope;
      try {
        minPoints = parseMinPoints(req.query.minPoints);
        scope = parseScope(req.query.scope, settings.defaultLeaderboardScope);
      } catch (err: any) {
        return res.status(400).json({ error: String(err?.message || err) });
      }
      const clubIds = await listPublicHighbreakClubIds(regionCode || undefined, districtCode || undefined);
      if (clubIds.length === 0) return res.json([]);
      const rows = await listUnifiedBreakRows({
        prismaClient: prisma,
        clubIds,
        minPoints,
        scope,
      });
      const grouped = new Map<string, { club: any; points: number }>();
      for (const row of rows) {
        const clubKey = String(row?.club_id || '');
        if (!clubKey) continue;
        const current = grouped.get(clubKey);
        const points = Number(row?.points || 0);
        if (!current || points > current.points) {
          grouped.set(clubKey, {
            club: row?.club || null,
            points,
          });
        }
      }
      const ranked = Array.from(grouped.entries())
        .map(([clubId, value]) => ({
          clubId,
          club: value.club,
          points: value.points,
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return String(a.clubId).localeCompare(String(b.clubId));
        })
        .slice(0, take);
      const ids = ranked.map((r) => r.clubId);
      const clubs = await prisma.clubProfile.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } },
      });
      const clubMap = new Map(clubs.map((c) => [c.id, c]));
      res.json(ranked.map((r) => {
        const club = clubMap.get(r.clubId) || r.club;
        return {
          clubId: r.clubId,
          club: club ? { ...club, name: club.name || club.member?.name || '' } : null,
          points: r.points || 0,
        };
      }));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/leaderboard/clubs/monthly', async (req, res) => {
    try {
      const take = parseLimit(req.query.limit, 10);
      const month = String(req.query.month || '').trim();
      const regionCode = String(req.query.regionCode || '').trim().toUpperCase();
      const districtCode = String(req.query.districtCode || '').trim().toUpperCase();
      const settings = await getHighbreakModuleSettings();
      let minPoints = 0;
      let scope: BreakScope = settings.defaultLeaderboardScope;
      try {
        minPoints = parseMinPoints(req.query.minPoints);
        scope = parseScope(req.query.scope, settings.defaultLeaderboardScope);
      } catch (err: any) {
        return res.status(400).json({ error: String(err?.message || err) });
      }
      const range = parseMonthRangeUtc(month);
      if (!range) return res.status(400).json({ error: 'month invalid' });

      const clubIds = await listPublicHighbreakClubIds(regionCode || undefined, districtCode || undefined);
      if (clubIds.length === 0) return res.json([]);
      const rows = await listUnifiedBreakRows({
        prismaClient: prisma,
        clubIds,
        month,
        minPoints,
        scope,
      });
      const grouped = new Map<string, { club: any; points: number }>();
      for (const row of rows) {
        const clubKey = String(row?.club_id || '');
        if (!clubKey) continue;
        const current = grouped.get(clubKey) || {
          club: row?.club || null,
          points: 0,
        };
        current.points += Number(row?.points || 0);
        if (!current.club && row?.club) current.club = row.club;
        grouped.set(clubKey, current);
      }
      const ranked = Array.from(grouped.entries())
        .map(([clubId, value]) => ({
          clubId,
          club: value.club,
          points: value.points,
        }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return String(a.clubId).localeCompare(String(b.clubId));
        })
        .slice(0, take);
      const ids = ranked.map((r) => r.clubId);
      const clubs = await prisma.clubProfile.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } },
      });
      const clubMap = new Map(clubs.map((c) => [c.id, c]));
      res.json(ranked.map((r) => {
        const club = clubMap.get(r.clubId) || r.club;
        return {
          clubId: r.clubId,
          club: club ? { ...club, name: club.name || club.member?.name || '' } : null,
          points: r.points || 0,
        };
      }));
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) });
    }
  });

  router.get('/api/admin/breaks', adminAuth, async (req, res) => {
    try {
      const page = Number((req.query.page as string) || '1');
      const pageSize = Number((req.query.pageSize as string) || '50');
      const take = Math.max(1, Math.min(Number.isFinite(pageSize) ? Math.floor(pageSize) : 50, 200));
      const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
      const skip = Math.max(0, (safePage - 1) * take);

      const memberId = String((req.query.memberId as string) || '').trim();
      const clubId = String((req.query.clubId as string) || '').trim();
      const month = String((req.query.month as string) || '').trim();
      const q = String((req.query.q as string) || '').trim();
      const recordType = normalizeBreakRecordType(req.query.recordType);
      const includeDeleted = String((req.query.includeDeleted as string) || '').trim() === '1';

      const where: any = {};
      if (!includeDeleted) where.deleted_at = null;
      if (memberId) where.member_id = memberId;
      if (clubId) where.club_id = clubId;
      if (recordType) where.record_type = recordType;
      if (month) {
        const range = parseMonthRangeUtc(month);
        if (!range) return res.status(400).json({ error: 'month invalid' });
        where.recorded_at = { gte: range.start, lt: range.end };
      }
      if (q) {
        where.OR = [
          { note: { contains: q, mode: 'insensitive' } },
          { video_url: { contains: q, mode: 'insensitive' } },
          { member: { name: { contains: q, mode: 'insensitive' } } },
          { member: { member_code: { contains: q, mode: 'insensitive' } } },
          { club: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }

      const [total, rows] = await prisma.$transaction([
        prisma.breakRecord.count({ where }),
        prisma.breakRecord.findMany({
          where,
          orderBy: [{ recorded_at: 'desc' }, { id: 'desc' }],
          skip,
          take,
          include: {
            member: { select: { id: true, name: true, member_code: true } },
            club: { select: { id: true, name: true, logoUrl: true, member: { select: { name: true } } } },
            tournament: { select: { id: true, title: true, startsAt: true } },
          },
        }),
      ]);

      const breaks = rows.map((r: any) => ({
        ...r,
        club: r.club
          ? {
              ...r.club,
              name: r.club.name || r.club.member?.name || '',
            }
          : null,
      }));

      res.json({ total, page: safePage, pageSize: take, breaks });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.patch('/api/admin/breaks/:id', adminAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: '缺少 break ID' });

      const body = (req.body || {}) as {
        points?: number;
        recordedAt?: string;
        videoUrl?: string | null;
        note?: string | null;
        restore?: boolean;
      };

      const data: any = {
        updated_at: new Date(),
        updated_by_admin: 'super_admin',
      };

      if (body.points !== undefined) {
        const p = Number(body.points);
        if (!Number.isFinite(p) || p <= 0) return res.status(400).json({ error: 'points invalid' });
        data.points = Math.floor(p);
      }
      if (body.recordedAt !== undefined) {
        const d = new Date(String(body.recordedAt || ''));
        if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'recordedAt invalid' });
        data.recorded_at = d;
      }
      if (body.videoUrl !== undefined) data.video_url = body.videoUrl ? String(body.videoUrl).trim() : null;
      if (body.note !== undefined) data.note = body.note ? String(body.note).trim() : null;
      if (body.restore) {
        data.deleted_at = null;
        data.deleted_by_admin = null;
        data.delete_reason = null;
      }

      const row = await prisma.breakRecord.update({
        where: { id },
        data,
      });
      res.json(row);
    } catch (err: any) {
      if ((err as any)?.code === 'P2025') return res.status(404).json({ error: 'break 不存在' });
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.delete('/api/admin/breaks/:id', adminAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: '缺少 break ID' });
      const reasonRaw = (req.body || {}).reason;
      const reason = reasonRaw == null ? null : String(reasonRaw).trim() || null;

      const row = await prisma.breakRecord.update({
        where: { id },
        data: {
          deleted_at: new Date(),
          deleted_by_admin: 'super_admin',
          delete_reason: reason,
          updated_at: new Date(),
          updated_by_admin: 'super_admin',
        },
      });
      res.json(row);
    } catch (err: any) {
      if ((err as any)?.code === 'P2025') return res.status(404).json({ error: 'break 不存在' });
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  return router;
}
