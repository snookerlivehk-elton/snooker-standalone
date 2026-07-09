import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'crypto';
import { prisma } from '../../core/db/prisma.js';
import { requireMember } from '../../core/club/access.js';
import { resolveMemberTier } from '../../core/members/eligibility.js';
import { getMembersModuleSettings } from '../../core/modules/membersSettings.js';
import { listUnifiedBreakRows } from '../../core/highbreak/unifiedBreakRows.js';
import {
  findMemberByIdOrEmail,
  generateEmailCode,
  generateUniqueMemberCode,
  hashPassword,
  makeSalt,
  normalizeAndValidateRegionDistrict,
  normalizePhoneE164,
  verifyPassword,
} from '../../core/members/utils.js';
import { sendEmailIfConfigured } from '../../core/notifications/email.js';
import { parseMonthRangeUtc } from '../../core/utils/query.js';
import { getMemberRegisterPageHtml } from './registerPage.js';

type MemberRouterOptions = {
  resendApiKey: string;
  resendFromEmail: string;
  googleClientId: string;
};

function buildMemberAuthPayload(member: any) {
  return {
    id: member.id,
    name: member.name,
    email: member.email,
    member_code: member.member_code,
    role: member.role,
    member_tier: resolveMemberTier(member),
    email_verified_at: member.email_verified_at ?? null,
  };
}

export function createMemberRouter(options: MemberRouterOptions) {
  const router = express.Router();
  const googleClient = new OAuth2Client(options.googleClientId);

  function hasOwnKey(obj: unknown, key: string) {
    return !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key);
  }

  async function issueMemberEmailVerification(options2: {
    memberId: string;
    email: string;
    ip: string | null;
    origin: string;
  }) {
    const email = String(options2.email || '').trim().normalize('NFKC');
    if (!email) throw new Error('email required');

    const recent = await prisma.emailVerification.findFirst({
      where: {
        email,
        purpose: 'member-verify-email',
        created_at: { gt: new Date(Date.now() - 60_000) },
        used_at: null,
      },
      orderBy: { created_at: 'desc' },
    });
    if (recent) throw new Error('請稍後再試');

    const code = generateEmailCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.emailVerification.create({
      data: {
        email,
        code,
        purpose: 'member-verify-email',
        expires_at: expiresAt,
        ip: options2.ip,
      },
    });

    const verifyUrl = `${options2.origin.replace(/\/$/, '')}/verify-email?email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
    await sendEmailIfConfigured({
      to: email,
      subject: '會員 Email 驗證',
      html: [
        `<p>請完成你的會員 Email 驗證。</p>`,
        `<p>驗證碼：<strong>${code}</strong></p>`,
        `<p>你亦可直接點擊以下連結完成驗證：</p>`,
        `<p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
        `<p>此驗證碼將於 15 分鐘後失效。</p>`,
      ].join(''),
    });

    return { code, expiresAt };
  }

  async function verifyMemberEmailByCode(emailRaw: string, codeRaw: string) {
    const email = String(emailRaw || '').trim().normalize('NFKC');
    const code = String(codeRaw || '').trim();
    if (!email || !code) throw new Error('缺少 email 或驗證碼');

    const member = await prisma.member.findFirst({ where: { email } });
    if (!member) throw new Error('會員不存在');

    const now = new Date();
    const verification = await prisma.emailVerification.findFirst({
      where: { email, purpose: 'member-verify-email' },
      orderBy: { created_at: 'desc' },
    });
    if (!verification || verification.used_at || verification.expires_at < now || verification.attempts >= 5) {
      throw new Error('驗證碼錯誤或已過期，請重新取得');
    }
    if (verification.code !== code) {
      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new Error('驗證碼不正確');
    }

    await prisma.$transaction(async (tx) => {
      await tx.emailVerification.update({
        where: { id: verification.id },
        data: { used_at: now },
      });
      await tx.member.update({
        where: { id: member.id },
        data: {
          email_verified_at: now,
          member_tier: 'VERIFIED',
          email_verification_token: null,
          email_verification_expires_at: null,
        },
      });
    });

    return prisma.member.findUnique({ where: { id: member.id } });
  }

  function normalizeTournamentFormatFilter(value: any): 'ALL' | 'KNOCKOUT' | 'LEAGUE' {
    const normalized = String(value || 'ALL').trim().toUpperCase();
    if (normalized === 'KNOCKOUT' || normalized === 'LEAGUE') return normalized;
    return 'ALL';
  }

  function normalizeTournamentHistoryResultFilter(value: any): 'ALL' | 'WIN' | 'LOSS' | 'DRAW' | 'BYE' {
    const normalized = String(value || 'ALL').trim().toUpperCase();
    if (normalized === 'WIN' || normalized === 'LOSS' || normalized === 'DRAW' || normalized === 'BYE') return normalized;
    return 'ALL';
  }

  function buildTournamentMatchHistoryRows(matches: any[], targetId: string) {
    return matches.map((match) => {
      const mySide = String(match?.player_a_participant?.member_id || '') === targetId ? 'A' : 'B';
      const mine = mySide === 'A' ? match?.player_a_participant : match?.player_b_participant;
      const opponent = mySide === 'A' ? match?.player_b_participant : match?.player_a_participant;
      const resultType = String(match?.result_type || 'STANDARD').toUpperCase();
      const format = String(match?.tournament?.format || 'KNOCKOUT').toUpperCase() === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT';
      const framesWon = Number(mySide === 'A' ? match?.player_a_frames_won || 0 : match?.player_b_frames_won || 0);
      const framesLost = Number(mySide === 'A' ? match?.player_b_frames_won || 0 : match?.player_a_frames_won || 0);
      const totalPointsFor = Number(mySide === 'A' ? match?.player_a_total_points || 0 : match?.player_b_total_points || 0);
      const totalPointsAgainst = Number(mySide === 'A' ? match?.player_b_total_points || 0 : match?.player_a_total_points || 0);
      const maxBreak = Number(mySide === 'A' ? match?.player_a_max_break || 0 : match?.player_b_max_break || 0);
      const breaks20Plus = Number(mySide === 'A' ? match?.player_a_20_plus_count || 0 : match?.player_b_20_plus_count || 0);
      const winnerParticipantId = String(match?.winner_participant_id || '');
      const myParticipantId = String(mine?.id || '');
      const isBye = resultType === 'BYE' || !opponent?.member;
      const playedAt = match?.ended_at ?? match?.started_at ?? null;
      const playedDate = playedAt ? new Date(playedAt) : new Date(NaN);
      const year = Number.isFinite(playedDate.getTime()) ? playedDate.getFullYear() : null;
      let roundLabel = '-';
      const roundNo = Number(match?.round_no || 0);
      const stageCode = String(match?.stage_code || '').trim().toUpperCase();
      if (format === 'LEAGUE') {
        roundLabel = roundNo > 0 ? `第 ${roundNo} 輪` : 'League';
      } else if (stageCode === 'KNOCKOUT_PRELIM') {
        roundLabel = '預賽';
      } else if (roundNo > 0) {
        roundLabel = `R${roundNo}`;
      } else if (stageCode) {
        roundLabel = stageCode;
      }

      const resultKey = isBye
        ? 'BYE'
        : winnerParticipantId
          ? winnerParticipantId === myParticipantId ? 'WIN' : 'LOSS'
          : 'DRAW';

      return {
        id: String(match.id),
        tournamentId: String(match?.tournament?.id || ''),
        tournamentTitle: String(match?.tournament?.title || '-'),
        format,
        club: match?.tournament?.club || null,
        roundNo,
        matchNo: Number(match?.match_no || 0),
        roundLabel,
        stageCode,
        resultType,
        resultKey,
        result:
          resultKey === 'BYE'
            ? '輪空'
            : resultKey === 'WIN'
              ? '勝'
              : resultKey === 'LOSS'
                ? '負'
                : '和',
        opponent: opponent?.member ? {
          id: String(opponent.member.id),
          name: String(opponent.member.name || ''),
          memberCode: String(opponent.member.member_code || ''),
        } : null,
        framesWon,
        framesLost,
        scoreLabel: `${framesWon}-${framesLost}`,
        totalPointsFor,
        totalPointsAgainst,
        maxBreak,
        breaks20Plus,
        startedAt: match?.started_at ?? null,
        endedAt: match?.ended_at ?? null,
        playedAt,
        year,
      };
    });
  }

  function buildTournamentHeadToHeadRows(rows: any[]) {
    const map = new Map<string, any>();
    for (const row of rows) {
      const opponentId = String(row?.opponent?.id || '').trim();
      if (!opponentId) continue;
      const key = opponentId;
      const current = map.get(key) || {
        opponent: row.opponent,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        framesWon: 0,
        framesLost: 0,
        frameDiff: 0,
        totalPointsFor: 0,
        totalPointsAgainst: 0,
        totalPointsDiff: 0,
        maxBreak: 0,
        breaks20Plus: 0,
        recentMatchAt: null,
        recentMatch: null,
      };

      current.matchesPlayed += 1;
      current.framesWon += Number(row?.framesWon || 0);
      current.framesLost += Number(row?.framesLost || 0);
      current.totalPointsFor += Number(row?.totalPointsFor || 0);
      current.totalPointsAgainst += Number(row?.totalPointsAgainst || 0);
      current.maxBreak = Math.max(current.maxBreak, Number(row?.maxBreak || 0));
      current.breaks20Plus += Number(row?.breaks20Plus || 0);
      if (row?.resultKey === 'WIN') current.wins += 1;
      else if (row?.resultKey === 'LOSS') current.losses += 1;
      else if (row?.resultKey === 'DRAW') current.draws += 1;

      const recentTime = row?.playedAt ? new Date(row.playedAt).getTime() : 0;
      const currentRecentTime = current.recentMatchAt ? new Date(current.recentMatchAt).getTime() : 0;
      if (recentTime >= currentRecentTime) {
        current.recentMatchAt = row?.playedAt ?? null;
        current.recentMatch = {
          id: row?.id,
          tournamentId: row?.tournamentId,
          tournamentTitle: row?.tournamentTitle,
          format: row?.format,
          roundLabel: row?.roundLabel,
          result: row?.result,
          scoreLabel: row?.scoreLabel,
          playedAt: row?.playedAt ?? null,
        };
      }

      current.frameDiff = current.framesWon - current.framesLost;
      current.totalPointsDiff = current.totalPointsFor - current.totalPointsAgainst;
      current.winRate = current.matchesPlayed > 0 ? Number(((current.wins / current.matchesPlayed) * 100).toFixed(1)) : 0;
      map.set(key, current);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.frameDiff !== a.frameDiff) return b.frameDiff - a.frameDiff;
      if (b.maxBreak !== a.maxBreak) return b.maxBreak - a.maxBreak;
      return String(a?.opponent?.name || '').localeCompare(String(b?.opponent?.name || ''));
    });
  }

  function buildTournamentMatchDetail(match: any, targetId: string) {
    const summary = buildTournamentMatchHistoryRows([match], targetId)[0] || null;
    if (!summary) return null;
    const playerA = match?.player_a_participant || null;
    const playerB = match?.player_b_participant || null;
    const winnerParticipantId = String(match?.winner_participant_id || '');
    const targetParticipantId = String(
      String(playerA?.member_id || '') === targetId ? playerA?.id || '' : playerB?.id || '',
    );
    const targetSide = targetParticipantId && String(playerA?.id || '') === targetParticipantId ? 'A' : 'B';
    const winnerSide = winnerParticipantId
      ? winnerParticipantId === String(playerA?.id || '')
        ? 'A'
        : winnerParticipantId === String(playerB?.id || '')
          ? 'B'
          : null
      : null;

    const buildSide = (participant: any, side: 'A' | 'B') => ({
      side,
      participantId: String(participant?.id || ''),
      memberId: String(participant?.member?.id || participant?.member_id || ''),
      name: String(participant?.member?.name || '-'),
      memberCode: String(participant?.member?.member_code || ''),
      seed: participant?.seed ?? null,
      finalRank: participant?.final_rank ?? null,
      participantStatus: String(participant?.status || ''),
      framesWon: Number(side === 'A' ? match?.player_a_frames_won || 0 : match?.player_b_frames_won || 0),
      totalPoints: Number(side === 'A' ? match?.player_a_total_points || 0 : match?.player_b_total_points || 0),
      maxBreak: Number(side === 'A' ? match?.player_a_max_break || 0 : match?.player_b_max_break || 0),
      breaks20Plus: Number(side === 'A' ? match?.player_a_20_plus_count || 0 : match?.player_b_20_plus_count || 0),
      isTarget: String(participant?.member?.id || participant?.member_id || '') === targetId,
      isWinner: !!winnerParticipantId && winnerParticipantId === String(participant?.id || ''),
    });

    const playerASummary = buildSide(playerA, 'A');
    const playerBSummary = buildSide(playerB, 'B');
    const explicitBreaks = Array.isArray(match?.break_records) ? match.break_records : [];
    const threshold = Math.max(1, Number(match?.tournament?.tracked_break_threshold || 20));
    const explicitKeys = new Set(
      explicitBreaks
        .filter((row: any) => row?.member_id && Number(row?.frame_no || 0) > 0)
        .map((row: any) => `${String(row.member_id)}::${Number(row.frame_no || 0)}`),
    );
    const syntheticBreaks = (Array.isArray(match?.frames) ? match.frames : []).flatMap((frame: any) => {
      const frameNo = Math.max(1, Number(frame?.frame_no || 1));
      const recordedAt = frame?.ended_at ?? frame?.started_at ?? match?.ended_at ?? match?.started_at ?? null;
      const candidates = [
        {
          memberId: String(playerA?.member?.id || playerA?.member_id || ''),
          member: playerA?.member || null,
          points: Number(frame?.player_a_highest_break || 0),
        },
        {
          memberId: String(playerB?.member?.id || playerB?.member_id || ''),
          member: playerB?.member || null,
          points: Number(frame?.player_b_highest_break || 0),
        },
      ];
      return candidates
        .filter((candidate) => candidate.memberId && candidate.member && candidate.points >= threshold)
        .filter((candidate) => !explicitKeys.has(`${candidate.memberId}::${frameNo}`))
        .map((candidate) => ({
          id: `derived-${String(match?.id || '')}-${frameNo}-${candidate.memberId}`,
          member_id: candidate.memberId,
          frame_no: frameNo,
          points: candidate.points,
          threshold_snapshot: threshold,
          recorded_at: recordedAt,
          note: null,
          video_url: null,
          member: candidate.member,
        }));
    });
    const rawBreaks = [...explicitBreaks, ...syntheticBreaks];
    const breaks = rawBreaks.map((row: any) => {
      const memberId = String(row?.member?.id || row?.member_id || '');
      const side = memberId && memberId === playerASummary.memberId ? 'A' : memberId === playerBSummary.memberId ? 'B' : null;
      return {
        id: String(row?.id || ''),
        frameNo: row?.frame_no == null ? null : Number(row.frame_no || 0),
        points: Number(row?.points || 0),
        thresholdSnapshot: row?.threshold_snapshot == null ? null : Number(row.threshold_snapshot || 0),
        recordedAt: row?.recorded_at ?? null,
        note: row?.note ? String(row.note) : null,
        videoUrl: row?.video_url ? String(row.video_url) : null,
        player: {
          id: memberId,
          name: String(row?.member?.name || '-'),
          memberCode: String(row?.member?.member_code || ''),
        },
        side,
        isTarget: memberId === targetId,
      };
    });

    const breaksByFrame = new Map<number, any[]>();
    for (const row of breaks) {
      if (!Number.isFinite(Number(row.frameNo))) continue;
      const frameNo = Number(row.frameNo);
      const current = breaksByFrame.get(frameNo) || [];
      current.push(row);
      breaksByFrame.set(frameNo, current);
    }

    const frames = (Array.isArray(match?.frames) ? match.frames : []).map((frame: any) => {
      const winnerId = String(frame?.winner_participant_id || '');
      const frameWinnerSide = winnerId
        ? winnerId === String(playerA?.id || '')
          ? 'A'
          : winnerId === String(playerB?.id || '')
            ? 'B'
            : null
        : null;
      const frameNo = Number(frame?.frame_no || 0);
      const frameBreaks = breaksByFrame.get(frameNo) || [];
      return {
        id: String(frame?.id || ''),
        frameNo,
        winnerSide: frameWinnerSide,
        playerAScore: Number(frame?.player_a_score || 0),
        playerBScore: Number(frame?.player_b_score || 0),
        playerAHighestBreak: frameBreaks
          .filter((row) => row?.side === 'A')
          .reduce((best, row) => Math.max(best, Number(row?.points || 0)), 0),
        playerBHighestBreak: frameBreaks
          .filter((row) => row?.side === 'B')
          .reduce((best, row) => Math.max(best, Number(row?.points || 0)), 0),
        startedAt: frame?.started_at ?? null,
        endedAt: frame?.ended_at ?? null,
        breaks: frameBreaks,
      };
    });

    return {
      match: summary,
      targetSide,
      winnerSide,
      tournament: {
        id: String(match?.tournament?.id || ''),
        title: String(match?.tournament?.title || '-'),
        format: String(match?.tournament?.format || 'KNOCKOUT').toUpperCase() === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT',
        startsAt: match?.tournament?.startsAt ?? null,
        workflowStatus: String(match?.tournament?.workflow_status || ''),
        status: String(match?.tournament?.status || ''),
        club: match?.tournament?.club || null,
      },
      stageCode: String(match?.stage_code || ''),
      tableNo: match?.table_no ? String(match.table_no) : null,
      scheduledAt: match?.scheduled_at ?? null,
      bestOfFrames: match?.best_of_frames == null ? null : Number(match.best_of_frames || 0),
      resultType: String(match?.result_type || 'STANDARD').toUpperCase(),
      playerA: playerASummary,
      playerB: playerBSummary,
      frames,
      breaks,
      unassignedBreaks: breaks.filter((row: any) => row.frameNo == null),
    };
  }

  function getTournamentFinishLabel(rankRaw: any) {
    const rank = Number(rankRaw || 0);
    if (!Number.isFinite(rank) || rank <= 0) return '-';
    if (rank === 1) return '冠軍';
    if (rank === 2) return '亞軍';
    if (rank === 3) return '四強';
    if (rank === 5) return '八強';
    if (rank === 9) return '16 強';
    return `#${rank}`;
  }

  router.get('/api/member/regions', async (_req, res) => {
    try {
      const regions = await prisma.memberRegion.findMany({
        where: { active: true },
        orderBy: { code3: 'asc' },
      });
      res.json({
        regions: regions.map((r) => ({
          code3: r.code3,
          name: r.name,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/member/districts', async (req, res) => {
    try {
      const regionCodeRaw = (req.query.regionCode as string) || '';
      const regionCode = regionCodeRaw.trim().toUpperCase();
      const where: any = { active: true };
      if (regionCode) where.region_code = regionCode;
      const districts = await prisma.memberDistrict.findMany({
        where,
        orderBy: { code3: 'asc' },
      });
      res.json({
        districts: districts.map((d) => ({
          code3: d.code3,
          name: d.name,
          regionCode: d.region_code,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/admin/register', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(getMemberRegisterPageHtml());
  });

  router.post('/api/members/request-password-reset-code', async (req, res) => {
    try {
      const moduleSettings = await getMembersModuleSettings().catch(() => null);
      if (moduleSettings?.passwordResetEnabled === false) {
        return res.status(403).json({ error: 'member_password_reset_disabled' });
      }
      const { email } = (req.body || {}) as { email?: string };
      const em = String(email || '').trim().normalize('NFKC');
      if (!em) {
        return res.status(400).json({ error: 'email 為必填' });
      }
      const member = await prisma.member.findFirst({ where: { email: em } });
      if (!member) {
        return res.status(404).json({ error: '找不到此 Email 的會員帳號' });
      }

      const recent = await prisma.emailVerification.findFirst({
        where: {
          email: em,
          purpose: 'reset-password',
          created_at: { gt: new Date(Date.now() - 60_000) },
          used_at: null,
        },
        orderBy: { created_at: 'desc' },
      });
      if (recent) {
        return res.status(429).json({ error: '請稍後再試' });
      }

      const code = generateEmailCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const ipHeader = (req.headers['x-forwarded-for'] as string) || '';
      const ip = (req.ip || ipHeader || '').toString().slice(0, 255) || null;

      await prisma.emailVerification.create({
        data: {
          email: em,
          code,
          purpose: 'reset-password',
          expires_at: expiresAt,
          ip,
        },
      });

      try {
        await sendEmailIfConfigured({
          to: em,
          subject: '重設密碼驗證碼',
          html: `<p>你的重設密碼驗證碼為：<strong>${code}</strong></p><p>請在 10 分鐘內輸入此驗證碼以重設密碼。</p>`,
        });
      } catch (e) {
        console.warn('Failed to send reset code email:', e);
      }

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.post('/api/members/reset-password-with-code', async (req, res) => {
    try {
      const moduleSettings = await getMembersModuleSettings().catch(() => null);
      if (moduleSettings?.passwordResetEnabled === false) {
        return res.status(403).json({ error: 'member_password_reset_disabled' });
      }
      const { email, code, newPassword } = (req.body || {}) as { email?: string; code?: string; newPassword?: string };
      const em = String(email || '').trim().normalize('NFKC');
      const c = String(code || '').trim();
      const pw = String(newPassword || '');

      if (!em || !c || !pw) {
        return res.status(400).json({ error: '缺少必要欄位' });
      }

      const member = await prisma.member.findFirst({ where: { email: em } });
      if (!member) {
        return res.status(404).json({ error: '會員不存在' });
      }

      const now = new Date();
      const verification = await prisma.emailVerification.findFirst({
        where: {
          email: em,
          purpose: 'reset-password',
        },
        orderBy: { created_at: 'desc' },
      });

      if (!verification || verification.used_at || verification.expires_at < now || verification.attempts >= 5) {
        return res.status(400).json({ error: '驗證碼錯誤或已過期，請重新取得' });
      }

      if (verification.code !== c) {
        await prisma.emailVerification.update({
          where: { id: verification.id },
          data: { attempts: { increment: 1 } },
        });
        return res.status(400).json({ error: '驗證碼不正確' });
      }

      const pwLenOk = pw.length >= 8;
      const pwHasNum = /\d/.test(pw);
      const pwHasAlpha = /[A-Za-z]/.test(pw);
      if (!pwLenOk || !pwHasNum || !pwHasAlpha) {
        return res.status(400).json({ error: '密碼不符合規則（至少8字元，需含英文字母與數字）' });
      }

      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { used_at: now },
      });

      const salt = makeSalt();
      await prisma.member.update({
        where: { id: member.id },
        data: {
          password_salt: salt,
          password_hash: hashPassword(pw, salt),
          password_updated_at: now,
        },
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/members/:id/matches', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ error: 'id required' });

      let targetId = id;
      if (id.includes('@')) {
        const m = await prisma.member.findFirst({ where: { email: id } });
        if (m) targetId = m.id;
      }

      const matches = await prisma.match.findMany({
        where: {
          players: {
            some: {
              member_id: targetId,
            },
          },
        },
        include: {
          operator: {
            select: { name: true, club_name: true },
          },
          winner_member: {
            select: { id: true, name: true },
          },
          players: {
            include: {
              member: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: {
          started_at: 'desc',
        },
      });

      const result = matches.map((m) => {
        const p0 = m.players[0];
        const p1 = m.players[1];
        const playerUser = m.players.find((p) => p.member_id === targetId);

        let durationSeconds = 0;
        if (m.started_at && m.ended_at) {
          durationSeconds = Math.floor((new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 1000);
        }

        return {
          id: m.id,
          date: m.started_at,
          matchName: m.name,
          matchLevel: m.name_part || '一般',
          operatorName: m.operator?.name || '-',
          operatorClub: m.operator?.club_name || '-',
          players: m.players.map((p) => ({
            id: p.member_id,
            member: {
              id: p.member.id,
              name: p.member.name,
            },
            name: p.member.name,
            framesWon: p.frames_won,
            maxBreak: p.max_break_points,
          })),
          handicaps: [m.handicap0, m.handicap1],
          framesRequired: m.frames_required,
          totalFrames: (p0?.frames_won || 0) + (p1?.frames_won || 0),
          finalScore: `${p0?.frames_won || 0}-${p1?.frames_won || 0}`,
          winnerName: m.winner_member?.name,
          isWinner: m.winner_member_id === targetId,
          userMaxBreak: playerUser?.max_break_points || 0,
          durationSeconds,
        };
      });

      res.json({ matches: result });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/members/:id/tournament-career', async (req, res) => {
    try {
      const idOrEmail = String(req.params.id || '').trim();
      if (!idOrEmail) return res.status(400).json({ error: 'id required' });

      const member = await findMemberByIdOrEmail(idOrEmail);
      if (!member) return res.status(404).json({ error: 'not found' });
      const targetId = String(member.id);

      const [participants, matches, breaks] = await Promise.all([
        prisma.tournamentParticipant.findMany({
          where: { member_id: targetId },
          include: {
            tournament: {
              select: {
                id: true,
                title: true,
                format: true,
                startsAt: true,
                workflow_status: true,
                status: true,
                club: { select: { id: true, name: true, logoUrl: true } },
              },
            },
          },
          orderBy: [{ created_at: 'desc' }],
        }),
        prisma.tournamentMatch.findMany({
          where: {
            status: 'COMPLETED',
            OR: [
              { player_a_participant: { is: { member_id: targetId } } },
              { player_b_participant: { is: { member_id: targetId } } },
            ],
          },
          include: {
            tournament: {
              select: {
                id: true,
                title: true,
                format: true,
                startsAt: true,
                club: { select: { id: true, name: true, logoUrl: true } },
              },
            },
            player_a_participant: {
              include: { member: { select: { id: true, name: true, member_code: true } } },
            },
            player_b_participant: {
              include: { member: { select: { id: true, name: true, member_code: true } } },
            },
            winner_participant: {
              include: { member: { select: { id: true, name: true, member_code: true } } },
            },
          },
          orderBy: [{ ended_at: 'desc' }, { updated_at: 'desc' }],
        }),
        prisma.breakRecord.findMany({
          where: {
            member_id: targetId,
            record_type: 'TOURNAMENT',
            deleted_at: null,
          },
          include: {
            tournament: { select: { id: true, title: true, format: true } },
          },
          orderBy: [{ recorded_at: 'desc' }],
        }),
      ]);

      const summary = {
        tournamentsEntered: participants.length,
        completedTournaments: 0,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
        framesWon: 0,
        framesLost: 0,
        frameDiff: 0,
        totalPointsFor: 0,
        totalPointsAgainst: 0,
        totalPointsDiff: 0,
        breaks20Plus: 0,
        highestBreak: 0,
        championships: 0,
        runnerUps: 0,
        semiFinals: 0,
        finals: 0,
        podiums: 0,
        bestFinishRank: null as number | null,
        bestFinishLabel: '-',
        longestWinStreak: 0,
        currentWinStreak: 0,
        firstChampionshipAt: null as string | null,
        latestChampionshipAt: null as string | null,
      };
      const byFormat: Record<'KNOCKOUT' | 'LEAGUE', any> = {
        KNOCKOUT: {
          tournamentsEntered: 0,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          breaks20Plus: 0,
          highestBreak: 0,
        },
        LEAGUE: {
          tournamentsEntered: 0,
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          breaks20Plus: 0,
          highestBreak: 0,
        },
      };

      for (const participant of participants) {
        const format = String(participant?.tournament?.format || 'KNOCKOUT').toUpperCase() === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT';
        byFormat[format].tournamentsEntered += 1;
        if (String(participant?.tournament?.workflow_status || '').toUpperCase() === 'COMPLETED') {
          summary.completedTournaments += 1;
        }
        const finalRank = Number(participant?.final_rank || 0);
        const isChampion = finalRank === 1 || String(participant?.status || '').toUpperCase() === 'CHAMPION';
        if (isChampion) summary.championships += 1;
        if (finalRank === 2) summary.runnerUps += 1;
        if (finalRank === 3) summary.semiFinals += 1;
        if (finalRank > 0 && (summary.bestFinishRank == null || finalRank < summary.bestFinishRank)) {
          summary.bestFinishRank = finalRank;
        }
        if (isChampion) {
          const championAt = participant?.tournament?.startsAt ? new Date(participant.tournament.startsAt) : new Date(NaN);
          if (Number.isFinite(championAt.getTime())) {
            const iso = championAt.toISOString();
            if (!summary.firstChampionshipAt || new Date(iso).getTime() < new Date(summary.firstChampionshipAt).getTime()) {
              summary.firstChampionshipAt = iso;
            }
            if (!summary.latestChampionshipAt || new Date(iso).getTime() > new Date(summary.latestChampionshipAt).getTime()) {
              summary.latestChampionshipAt = iso;
            }
          }
        }
      }

      summary.finals = summary.championships + summary.runnerUps;
      summary.podiums = summary.championships + summary.runnerUps + summary.semiFinals;
      summary.bestFinishLabel = getTournamentFinishLabel(summary.bestFinishRank);

      const recentMatches = buildTournamentMatchHistoryRows(matches, targetId);

      for (const row of recentMatches) {
        if (row.resultKey === 'BYE') continue;
        if (row.format !== 'KNOCKOUT' && row.format !== 'LEAGUE') continue;
        const format = row.format;
        summary.highestBreak = Math.max(summary.highestBreak, Number(row.maxBreak || 0));
        summary.matchesPlayed += 1;
        summary.framesWon += Number(row.framesWon || 0);
        summary.framesLost += Number(row.framesLost || 0);
        summary.totalPointsFor += Number(row.totalPointsFor || 0);
        summary.totalPointsAgainst += Number(row.totalPointsAgainst || 0);
        byFormat[format].matchesPlayed += 1;
        byFormat[format].highestBreak = Math.max(byFormat[format].highestBreak, Number(row.maxBreak || 0));
        if (row.resultKey === 'WIN') {
          summary.wins += 1;
          byFormat[format].wins += 1;
        } else if (row.resultKey === 'LOSS') {
          summary.losses += 1;
          byFormat[format].losses += 1;
        } else if (row.resultKey === 'DRAW') {
          summary.draws += 1;
          byFormat[format].draws += 1;
        }
      }

      const chronologicalMatches = [...recentMatches]
        .filter((row) => row.resultKey !== 'BYE')
        .sort((a, b) => {
          const aTime = a.playedAt ? new Date(a.playedAt).getTime() : 0;
          const bTime = b.playedAt ? new Date(b.playedAt).getTime() : 0;
          if (aTime !== bTime) return aTime - bTime;
          return Number(a.matchNo || 0) - Number(b.matchNo || 0);
        });
      let runningWinStreak = 0;
      for (const row of chronologicalMatches) {
        if (row.resultKey === 'WIN') {
          runningWinStreak += 1;
          summary.longestWinStreak = Math.max(summary.longestWinStreak, runningWinStreak);
        } else {
          runningWinStreak = 0;
        }
      }
      for (const row of recentMatches) {
        if (row.resultKey === 'BYE') continue;
        if (row.resultKey === 'WIN') {
          summary.currentWinStreak += 1;
        } else {
          break;
        }
      }

      for (const row of breaks) {
        const format = String(row?.tournament?.format || 'KNOCKOUT').toUpperCase() === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT';
        const points = Math.max(0, Number(row?.points || 0));
        summary.breaks20Plus += 1;
        summary.highestBreak = Math.max(summary.highestBreak, points);
        byFormat[format].breaks20Plus += 1;
        byFormat[format].highestBreak = Math.max(byFormat[format].highestBreak, points);
      }

      summary.frameDiff = summary.framesWon - summary.framesLost;
      summary.totalPointsDiff = summary.totalPointsFor - summary.totalPointsAgainst;
      summary.winRate = summary.matchesPlayed > 0 ? Number(((summary.wins / summary.matchesPlayed) * 100).toFixed(1)) : 0;

      const recentTournaments = participants
        .map((participant) => ({
          tournamentId: String(participant?.tournament?.id || ''),
          title: String(participant?.tournament?.title || '-'),
          format: String(participant?.tournament?.format || 'KNOCKOUT').toUpperCase() === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT',
          startsAt: participant?.tournament?.startsAt ?? null,
          workflowStatus: String(participant?.tournament?.workflow_status || ''),
          participantStatus: String(participant?.status || ''),
          finalRank: participant?.final_rank ?? null,
          seed: participant?.seed ?? null,
          club: participant?.tournament?.club || null,
        }))
        .sort((a, b) => {
          const aTime = a.startsAt ? new Date(a.startsAt).getTime() : 0;
          const bTime = b.startsAt ? new Date(b.startsAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 10);

      res.json({
        member: {
          id: member.id,
          name: member.name,
          memberCode: member.member_code,
        },
        summary,
        byFormat,
        recentMatches: recentMatches.slice(0, 10),
        recentTournaments,
      });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/members/:id/tournament-history', async (req, res) => {
    try {
      const idOrEmail = String(req.params.id || '').trim();
      if (!idOrEmail) return res.status(400).json({ error: 'id required' });

      const member = await findMemberByIdOrEmail(idOrEmail);
      if (!member) return res.status(404).json({ error: 'not found' });
      const targetId = String(member.id);
      const formatFilter = normalizeTournamentFormatFilter(req.query.format);
      const resultFilter = normalizeTournamentHistoryResultFilter(req.query.result);
      const yearFilter = Number(req.query.year);
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;

      const matches = await prisma.tournamentMatch.findMany({
        where: {
          status: 'COMPLETED',
          OR: [
            { player_a_participant: { is: { member_id: targetId } } },
            { player_b_participant: { is: { member_id: targetId } } },
          ],
        },
        include: {
          tournament: {
            select: {
              id: true,
              title: true,
              format: true,
              startsAt: true,
              club: { select: { id: true, name: true, logoUrl: true } },
            },
          },
          player_a_participant: {
            include: { member: { select: { id: true, name: true, member_code: true } } },
          },
          player_b_participant: {
            include: { member: { select: { id: true, name: true, member_code: true } } },
          },
          winner_participant: {
            include: { member: { select: { id: true, name: true, member_code: true } } },
          },
        },
        orderBy: [{ ended_at: 'desc' }, { updated_at: 'desc' }],
      });

      const rows = buildTournamentMatchHistoryRows(matches, targetId);
      const availableYears = Array.from(new Set(
        rows
          .map((row) => Number(row.year || 0))
          .filter((value) => Number.isFinite(value) && value > 0),
      )).sort((a, b) => b - a);

      const filtered = rows.filter((row) => {
        if (formatFilter !== 'ALL' && row.format !== formatFilter) return false;
        if (resultFilter !== 'ALL' && row.resultKey !== resultFilter) return false;
        if (Number.isFinite(yearFilter) && yearFilter > 0 && row.year !== yearFilter) return false;
        return true;
      });

      res.json({
        member: {
          id: member.id,
          name: member.name,
          memberCode: member.member_code,
        },
        filters: {
          format: formatFilter,
          result: resultFilter,
          year: Number.isFinite(yearFilter) && yearFilter > 0 ? yearFilter : null,
          limit,
        },
        availableYears,
        total: filtered.length,
        history: filtered.slice(0, limit),
      });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/members/:id/tournament-head-to-head', async (req, res) => {
    try {
      const idOrEmail = String(req.params.id || '').trim();
      if (!idOrEmail) return res.status(400).json({ error: 'id required' });

      const member = await findMemberByIdOrEmail(idOrEmail);
      if (!member) return res.status(404).json({ error: 'not found' });
      const targetId = String(member.id);
      const formatFilter = normalizeTournamentFormatFilter(req.query.format);
      const yearFilter = Number(req.query.year);
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 30;

      const matches = await prisma.tournamentMatch.findMany({
        where: {
          status: 'COMPLETED',
          OR: [
            { player_a_participant: { is: { member_id: targetId } } },
            { player_b_participant: { is: { member_id: targetId } } },
          ],
        },
        include: {
          tournament: {
            select: {
              id: true,
              title: true,
              format: true,
              startsAt: true,
              club: { select: { id: true, name: true, logoUrl: true } },
            },
          },
          player_a_participant: {
            include: { member: { select: { id: true, name: true, member_code: true } } },
          },
          player_b_participant: {
            include: { member: { select: { id: true, name: true, member_code: true } } },
          },
          winner_participant: {
            include: { member: { select: { id: true, name: true, member_code: true } } },
          },
        },
        orderBy: [{ ended_at: 'desc' }, { updated_at: 'desc' }],
      });

      const historyRows = buildTournamentMatchHistoryRows(matches, targetId);
      const availableYears = Array.from(new Set(
        historyRows
          .map((row) => Number(row.year || 0))
          .filter((value) => Number.isFinite(value) && value > 0),
      )).sort((a, b) => b - a);

      const filteredHistory = historyRows.filter((row) => {
        if (!row?.opponent?.id) return false;
        if (row.resultKey === 'BYE') return false;
        if (formatFilter !== 'ALL' && row.format !== formatFilter) return false;
        if (Number.isFinite(yearFilter) && yearFilter > 0 && row.year !== yearFilter) return false;
        return true;
      });

      const rows = buildTournamentHeadToHeadRows(filteredHistory);
      res.json({
        member: {
          id: member.id,
          name: member.name,
          memberCode: member.member_code,
        },
        filters: {
          format: formatFilter,
          year: Number.isFinite(yearFilter) && yearFilter > 0 ? yearFilter : null,
          limit,
        },
        availableYears,
        total: rows.length,
        headToHead: rows.slice(0, limit),
      });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/members/:id/tournament-history/:matchId', async (req, res) => {
    try {
      const idOrEmail = String(req.params.id || '').trim();
      const matchId = String(req.params.matchId || '').trim();
      if (!idOrEmail) return res.status(400).json({ error: 'id required' });
      if (!matchId) return res.status(400).json({ error: 'matchId required' });

      const member = await findMemberByIdOrEmail(idOrEmail);
      if (!member) return res.status(404).json({ error: 'not found' });
      const targetId = String(member.id);

      const match = await prisma.tournamentMatch.findFirst({
        where: {
          id: matchId,
          status: 'COMPLETED',
          OR: [
            { player_a_participant: { is: { member_id: targetId } } },
            { player_b_participant: { is: { member_id: targetId } } },
          ],
        },
        include: {
          tournament: {
            select: {
              id: true,
              title: true,
              format: true,
              startsAt: true,
              tracked_break_threshold: true,
              workflow_status: true,
              status: true,
              club: { select: { id: true, name: true, logoUrl: true } },
            },
          },
          player_a_participant: {
            include: { member: { select: { id: true, name: true, member_code: true } } },
          },
          player_b_participant: {
            include: { member: { select: { id: true, name: true, member_code: true } } },
          },
          winner_participant: {
            include: { member: { select: { id: true, name: true, member_code: true } } },
          },
          frames: {
            orderBy: [{ frame_no: 'asc' }],
          },
          break_records: {
            where: {
              deleted_at: null,
              record_type: 'TOURNAMENT',
            },
            orderBy: [{ frame_no: 'asc' }, { recorded_at: 'asc' }, { created_at: 'asc' }],
            include: {
              member: { select: { id: true, name: true, member_code: true } },
            },
          },
        },
      });

      if (!match) return res.status(404).json({ error: 'not found' });
      const detail = buildTournamentMatchDetail(match, targetId);
      if (!detail) return res.status(404).json({ error: 'not found' });

      res.json({
        member: {
          id: member.id,
          name: member.name,
          memberCode: member.member_code,
        },
        detail,
      });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/me/breaks', async (req, res) => {
    try {
      const memberId = String(req.headers['x-member-id'] || '').trim();
      if (!memberId) return res.status(401).json({ error: 'Unauthorized' });
      const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, is_enabled: true } });
      if (!member) return res.status(401).json({ error: 'Unauthorized' });
      if (member.is_enabled === false) return res.status(403).json({ error: 'Disabled' });

      const clubId = req.query.clubId ? String(req.query.clubId).trim() : '';
      const month = req.query.month ? String(req.query.month).trim() : '';

      if (month) {
        const range = parseMonthRangeUtc(month);
        if (!range) return res.status(400).json({ error: 'month invalid' });
      }

      const rows = await listUnifiedBreakRows({
        prismaClient: prisma,
        memberId,
        clubId,
        month,
      });
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.post('/api/members/register', async (req, res) => {
    try {
      const moduleSettings = await getMembersModuleSettings().catch(() => null);
      const payload = (req.body || {}) as {
        email?: string;
        name?: string;
        password?: string;
        phone?: string;
        phoneCountry?: string;
        phoneNumber?: string;
        birthDate?: string;
        clubName?: string;
        regionCode?: string;
        districtCode?: string;
      };

      const email = String(payload.email || '').trim().normalize('NFKC');
      const name = String(payload.name || '').trim();
      const password = String(payload.password || '');
      const phone = payload.phone ? String(payload.phone).trim() : undefined;
      const phoneE164 = normalizePhoneE164({
        ...(payload.phoneCountry ? { country: String(payload.phoneCountry).trim() } : {}),
        ...(payload.phoneNumber ? { number: String(payload.phoneNumber).trim() } : {}),
      });
      const clubName = payload.clubName ? String(payload.clubName).trim() : undefined;
      const birthDateStr = payload.birthDate ? String(payload.birthDate).trim() : undefined;
      const regionDistrict = await normalizeAndValidateRegionDistrict({
        regionCode: (payload as any).regionCode ?? (payload as any).region_code ?? null,
        districtCode: (payload as any).districtCode ?? (payload as any).district_code ?? null,
      });

      if (!name) return res.status(400).json({ error: 'name 為必填' });
      const emailOk = email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) : false;
      if (email && !emailOk) return res.status(400).json({ error: 'email 格式不正確' });
      if (!email && !phoneE164) return res.status(400).json({ error: '請輸入 email 或 手機號碼' });
      if (email && moduleSettings?.emailRegistrationEnabled === false) {
        return res.status(403).json({ error: 'member_email_registration_disabled' });
      }
      if (!email && moduleSettings?.phoneRegistrationEnabled === false) {
        return res.status(403).json({ error: 'member_phone_registration_disabled' });
      }

      const hasPassword = password.length > 0;
      if (hasPassword) {
        const pwLenOk = password.length >= 8;
        const pwHasNum = /\d/.test(password);
        const pwHasAlpha = /[A-Za-z]/.test(password);
        if (!pwLenOk || !pwHasNum || !pwHasAlpha) {
          return res.status(400).json({ error: '密碼不符合規則（至少8字元，需含英文字母與數字）' });
        }
      }

      const birthDate = birthDateStr ? new Date(birthDateStr) : undefined;
      if (birthDateStr && Number.isNaN(birthDate!.getTime())) {
        return res.status(400).json({ error: '出生日期格式無效，請使用 ISO 格式，如 1990-01-31' });
      }

      const result = await prisma.$transaction(async (tx) => {
        if (email) {
          const existsEmail = await tx.member.findFirst({ where: { email } });
          if (existsEmail) throw new Error('email 已存在');
        }
        if (phoneE164) {
          const existsPhone = await tx.member.findFirst({ where: { phone_e164: phoneE164 } });
          if (existsPhone) throw new Error('手機號碼已存在');
        }

        const memberCode = await generateUniqueMemberCode(tx);
        const salt = hasPassword ? makeSalt() : null;
        const digest = hasPassword && salt ? hashPassword(password, salt) : null;

        const created = await tx.member.create({
          data: {
            id: randomUUID(),
            name,
            email: email || null,
            region_code: regionDistrict.regionCode,
            district_code: regionDistrict.districtCode,
            phone: phone ?? null,
            phone_country: payload.phoneCountry ? String(payload.phoneCountry).trim() : null,
            phone_number: payload.phoneNumber ? String(payload.phoneNumber).trim() : null,
            phone_e164: phoneE164 || null,
            club_name: clubName ?? null,
            birth_date: birthDate ?? null,
            member_code: memberCode,
            member_tier: 'BASIC',
            membership_expires_at: null,
            password_salt: salt,
            password_hash: digest,
            password_updated_at: hasPassword ? new Date() : null,
          },
        });
        return { id: created.id, memberCode, email: created.email };
      });

      if (result.email) {
        const ipHeader = (req.headers['x-forwarded-for'] as string) || '';
        const ip = (req.ip || ipHeader || '').toString().slice(0, 255) || null;
        const origin = `${req.protocol}://${req.get('host') || ''}`;
        try {
          await issueMemberEmailVerification({
            memberId: result.id,
            email: result.email,
            ip,
            origin,
          });
        } catch (mailErr) {
          console.warn('Failed to issue member verification email:', mailErr);
        }
      }

      res.status(201).json({ id: result.id, memberCode: result.memberCode });
    } catch (err: any) {
      const msg = String(err?.message || err);
      const status = msg.includes('已存在') ? 409 : (msg.includes('地方') || msg.includes('分區') || msg.includes('請同時選擇地方及分區')) ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });

  router.post('/api/members/request-register-code', async (req, res) => {
    try {
      const moduleSettings = await getMembersModuleSettings().catch(() => null);
      if (moduleSettings?.emailRegistrationEnabled === false) {
        return res.status(403).json({ error: 'member_email_registration_disabled' });
      }
      const { email } = (req.body || {}) as { email?: string };
      const em = String(email || '').trim().normalize('NFKC');
      if (!em) return res.status(400).json({ error: 'email 為必填' });
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);
      if (!emailOk) return res.status(400).json({ error: 'email 格式不正確' });
      const exists = await prisma.member.findFirst({ where: { email: em } });
      if (exists) return res.status(409).json({ error: '此 email 已註冊' });
      const recent = await prisma.emailVerification.findFirst({
        where: {
          email: em,
          purpose: 'register',
          created_at: { gt: new Date(Date.now() - 60_000) },
          used_at: null,
        },
        orderBy: { created_at: 'desc' },
      });
      if (recent) return res.status(429).json({ error: '請稍後再試' });
      const code = generateEmailCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const ipHeader = (req.headers['x-forwarded-for'] as string) || '';
      const ip = (req.ip || ipHeader || '').toString().slice(0, 255) || null;
      await prisma.emailVerification.create({
        data: {
          email: em,
          code,
          purpose: 'register',
          expires_at: expiresAt,
          ip,
        },
      });
      try {
        await sendEmailIfConfigured({
          to: em,
          subject: '會員註冊驗證碼',
          html: `<p>你的驗證碼為：<strong>${code}</strong></p><p>請在 10 分鐘內於註冊頁面輸入此驗證碼以完成註冊。</p>`,
        });
      } catch (e) {
        console.warn('Failed to send register code email:', e);
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.post('/api/members/register-with-code', async (req, res) => {
    try {
      const moduleSettings = await getMembersModuleSettings().catch(() => null);
      if (moduleSettings?.emailRegistrationEnabled === false) {
        return res.status(403).json({ error: 'member_email_registration_disabled' });
      }
      const payload = (req.body || {}) as {
        email?: string;
        code?: string;
        name?: string;
        password?: string;
        phone?: string;
        birthDate?: string;
        clubName?: string;
        regionCode?: string;
        districtCode?: string;
      };
      const email = String(payload.email || '').trim().normalize('NFKC');
      const code = String(payload.code || '').trim();
      const name = String(payload.name || '').trim();
      const password = String(payload.password || '');
      const phone = payload.phone ? String(payload.phone).trim() : undefined;
      const clubName = payload.clubName ? String(payload.clubName).trim() : undefined;
      const birthDateStr = payload.birthDate ? String(payload.birthDate).trim() : undefined;
      const regionDistrict = await normalizeAndValidateRegionDistrict({
        regionCode: (payload as any).regionCode ?? (payload as any).region_code ?? null,
        districtCode: (payload as any).districtCode ?? (payload as any).district_code ?? null,
      });
      if (!email || !name || !code || !password) {
        return res.status(400).json({ error: 'email、name、驗證碼與密碼為必填' });
      }
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk) return res.status(400).json({ error: 'email 格式不正確' });
      const pwLenOk = password.length >= 8;
      const pwHasNum = /\d/.test(password);
      const pwHasAlpha = /[A-Za-z]/.test(password);
      if (!pwLenOk || !pwHasNum || !pwHasAlpha) {
        return res.status(400).json({ error: '密碼不符合規則（至少8字元，需含英文字母與數字）' });
      }
      const birthDate = birthDateStr ? new Date(birthDateStr) : undefined;
      if (birthDateStr && Number.isNaN(birthDate!.getTime())) {
        return res.status(400).json({ error: '出生日期格式無效，請使用 ISO 格式，如 1990-01-31' });
      }
      const existing = await prisma.member.findFirst({ where: { email } });
      if (existing) return res.status(409).json({ error: 'email 已存在' });
      const now = new Date();
      const verification = await prisma.emailVerification.findFirst({
        where: {
          email,
          purpose: 'register',
        },
        orderBy: { created_at: 'desc' },
      });
      if (!verification || verification.used_at || verification.expires_at < now || verification.attempts >= 5) {
        return res.status(400).json({ error: '驗證碼錯誤或已過期，請重新取得' });
      }
      if (verification.code !== code) {
        await prisma.emailVerification.update({
          where: { id: verification.id },
          data: { attempts: { increment: 1 } },
        });
        return res.status(400).json({ error: '驗證碼不正確' });
      }
      await prisma.emailVerification.update({
        where: { id: verification.id },
        data: { used_at: now },
      });
      const result = await prisma.$transaction(async (tx) => {
        const existsEmail = await tx.member.findFirst({ where: { email } });
        if (existsEmail) throw new Error('email 已存在');
        const memberCode = await generateUniqueMemberCode(tx);
        const salt = makeSalt();
        const created = await tx.member.create({
          data: {
            id: randomUUID(),
            name,
            email,
            region_code: regionDistrict.regionCode,
            district_code: regionDistrict.districtCode,
            phone: phone ?? null,
            club_name: clubName ?? null,
            birth_date: birthDate ?? null,
            member_code: memberCode,
            member_tier: 'VERIFIED',
            membership_expires_at: null,
            password_salt: salt,
            password_hash: hashPassword(password, salt),
            password_updated_at: now,
            email_verified_at: now,
          },
        });
        return { id: created.id, memberCode };
      });
      res.status(201).json({ id: result.id, memberCode: result.memberCode });
    } catch (err: any) {
      const msg = String(err?.message || err);
      const status = msg.includes('email 已存在') ? 409 : (msg.includes('地方') || msg.includes('分區') || msg.includes('請同時選擇地方及分區')) ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });

  router.post('/api/me/email-verification/resend', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    try {
      const fullMember = await prisma.member.findUnique({
        where: { id: member.id },
        select: {
          id: true,
          email: true,
          email_verified_at: true,
          member_tier: true,
        },
      });
      if (!fullMember) return res.status(404).json({ error: '會員不存在' });
      if (!fullMember.email) return res.status(400).json({ error: '此會員尚未設定 email' });
      if (resolveMemberTier(fullMember) === 'VERIFIED') {
        return res.json({ ok: true, alreadyVerified: true });
      }
      const ipHeader = (req.headers['x-forwarded-for'] as string) || '';
      const ip = (req.ip || ipHeader || '').toString().slice(0, 255) || null;
      const origin = `${req.protocol}://${req.get('host') || ''}`;
      await issueMemberEmailVerification({
        memberId: fullMember.id,
        email: fullMember.email,
        ip,
        origin,
      });
      res.json({ ok: true });
    } catch (err: any) {
      const msg = String(err?.message || err);
      const status = msg.includes('請稍後再試') ? 429 : 500;
      res.status(status).json({ error: msg });
    }
  });

  router.post('/api/members/verify-email', async (req, res) => {
    try {
      const email = String((req.body || {}).email || '').trim().normalize('NFKC');
      const code = String((req.body || {}).code || '').trim();
      const member = await verifyMemberEmailByCode(email, code);
      res.json({ ok: true, member: member ? buildMemberAuthPayload(member) : null });
    } catch (err: any) {
      const msg = String(err?.message || err);
      const status = msg.includes('不存在') ? 404 : msg.includes('驗證碼') ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });

  router.post('/api/auth/google', async (req, res) => {
    try {
      const moduleSettings = await getMembersModuleSettings().catch(() => null);
      if (moduleSettings?.googleLoginEnabled === false) {
        return res.status(403).json({ error: 'member_google_login_disabled' });
      }
      const { credential } = req.body;
      if (!credential) return res.status(400).json({ error: 'Missing credential' });

      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: options.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) return res.status(400).json({ error: 'Invalid token' });

      const email = payload.email.toLowerCase();
      const displayName = String(payload.name || payload.given_name || '').trim() || (email.split('@')[0] || email);
      const emailVerified = Boolean((payload as any).email_verified);

      const member = await prisma.member.findUnique({ where: { email } });
      if (member) {
        if ((member as any).is_enabled === false) {
          return res.status(403).json({ error: '此帳號已被停用' });
        }
        if (emailVerified && resolveMemberTier(member) !== 'VERIFIED') {
          await prisma.member.update({
            where: { id: member.id },
            data: {
              email_verified_at: new Date(),
              member_tier: 'VERIFIED',
            },
          });
          const refreshed = await prisma.member.findUnique({ where: { id: member.id } });
          return res.json({
            ok: true,
            id: member.id,
            member: buildMemberAuthPayload(refreshed || member),
          });
        }
        return res.json({
          ok: true,
          id: member.id,
          member: buildMemberAuthPayload(member),
        });
      }

      if (!emailVerified) {
        return res.status(400).json({ error: 'Google Email 尚未驗證，無法註冊' });
      }

      const created = await prisma.$transaction(async (tx) => {
        const memberCode = await generateUniqueMemberCode(tx);
        return tx.member.create({
          data: {
            id: randomUUID(),
            name: displayName,
            email,
            district_code: null,
            phone: null,
            club_name: null,
            birth_date: null,
            member_code: memberCode,
            member_tier: 'VERIFIED',
            email_verified_at: new Date(),
            membership_expires_at: null,
            is_enabled: true,
          },
        });
      });

      return res.status(201).json({
        ok: true,
        id: created.id,
        member: buildMemberAuthPayload(created),
      });
    } catch (err: any) {
      console.error('Google login error:', err);
      res.status(500).json({ error: 'Login failed: ' + err.message });
    }
  });

  router.post('/api/members/login', async (req, res) => {
    try {
      const body = (req.body || {}) as { email?: string; identifier?: string; phoneE164?: string; phoneCountry?: string; phoneNumber?: string; password?: string };
      const idRaw = String((body.identifier || body.email || '') || '').trim().normalize('NFKC');
      const pw = String(body.password || '');
      if (!idRaw || !pw) return res.status(400).json({ error: '缺少帳號或密碼' });
      const isEmail = idRaw.includes('@');
      const email = isEmail ? idRaw.toLowerCase() : '';
      const phoneE164 = !isEmail
        ? (() => {
            if (body.phoneE164) return normalizePhoneE164(String(body.phoneE164));
            if (body.phoneCountry || body.phoneNumber) {
              return normalizePhoneE164({
                ...(body.phoneCountry ? { country: String(body.phoneCountry) } : {}),
                ...(body.phoneNumber ? { number: String(body.phoneNumber) } : {}),
              });
            }
            return normalizePhoneE164(idRaw);
          })()
        : '';
      if (!isEmail && !phoneE164) return res.status(400).json({ error: '手機號碼格式不正確' });
      const m = isEmail
        ? await prisma.member.findUnique({ where: { email } })
        : await prisma.member.findUnique({ where: { phone_e164: phoneE164 } });
      if (!m) return res.status(404).json({ error: '會員不存在' });
      const mh = (m as any).password_hash as string | undefined;
      const ms = (m as any).password_salt as string | undefined;
      if (!mh || !ms) return res.status(400).json({ error: '尚未設定密碼' });
      if (!verifyPassword(pw, String(ms), String(mh))) {
        return res.status(401).json({ error: '帳號或密碼不正確' });
      }
      return res.json({
        ok: true,
        id: m.id,
        member: buildMemberAuthPayload(m),
      });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/verify-email', async (req, res) => {
    const email = String(req.query.email || '').trim().normalize('NFKC');
    const code = String(req.query.code || '').trim();
    try {
      await verifyMemberEmailByCode(email, code);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(200).send([
        '<!doctype html>',
        '<html><head><meta charset="utf-8"><title>Email 驗證成功</title></head>',
        '<body style="font-family:Arial,sans-serif;padding:24px;background:#0f172a;color:#e5e7eb;">',
        '<div style="max-width:560px;margin:0 auto;background:#111827;padding:24px;border-radius:16px;">',
        '<h1 style="margin:0 0 12px;">Email 驗證成功</h1>',
        '<p style="line-height:1.6;">你的會員帳戶已升級為認證會員，現在可使用需要 email 驗證的功能。</p>',
        '</div></body></html>',
      ].join(''));
    } catch (err: any) {
      const msg = String(err?.message || err || '驗證失敗');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.status(400).send([
        '<!doctype html>',
        '<html><head><meta charset="utf-8"><title>Email 驗證失敗</title></head>',
        '<body style="font-family:Arial,sans-serif;padding:24px;background:#0f172a;color:#e5e7eb;">',
        '<div style="max-width:560px;margin:0 auto;background:#111827;padding:24px;border-radius:16px;">',
        '<h1 style="margin:0 0 12px;">Email 驗證失敗</h1>',
        `<p style="line-height:1.6;">${msg}</p>`,
        '</div></body></html>',
      ].join(''));
    }
  });

  router.get('/api/members/:id', async (req, res) => {
    try {
      const idOrEmail = String(req.params.id || '').trim();
      const m = await findMemberByIdOrEmail(idOrEmail);
      if (!m) return res.status(404).json({ error: 'not found' });
      res.json(m);
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.post('/api/members/:id/renew', async (req, res) => {
    try {
      const idOrEmail = String(req.params.id || '').trim();
      if (!idOrEmail) return res.status(400).json({ error: '缺少會員 ID' });
      const yearsRaw = (req.body as any)?.years;
      const years = Number.isFinite(Number(yearsRaw)) && Number(yearsRaw) > 0 ? Number(yearsRaw) : 3;
      const member = await findMemberByIdOrEmail(idOrEmail);
      if (!member) return res.status(404).json({ error: '會員不存在' });
      const now = new Date();
      const base = (member as any).membership_expires_at && (member as any).membership_expires_at > now
        ? (member as any).membership_expires_at
        : now;
      const next = new Date(base.getTime());
      next.setFullYear(next.getFullYear() + years);
      const updated = await prisma.member.update({
        where: { id: member.id },
        data: { membership_expires_at: next },
      });
      res.json({ member: updated });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.put('/api/members/:id', async (req, res) => {
    try {
      const moduleSettings = await getMembersModuleSettings().catch(() => null);
      const id = String(req.params.id || '').trim();
      if (!id) return res.status(400).json({ error: '缺少會員 ID' });

      const body = (req.body || {}) as {
        phone?: string;
        birthDate?: string;
        birth_date?: string;
        clubName?: string;
        club_name?: string;
        password?: string;
        regionCode?: string | null;
        region_code?: string | null;
        districtCode?: string | null;
        district_code?: string | null;
        publicHighbreakEnabled?: boolean;
        public_highbreak_enabled?: boolean;
      };

      const wantsProfileEdit =
        hasOwnKey(body, 'phone') ||
        hasOwnKey(body, 'birthDate') ||
        hasOwnKey(body, 'birth_date') ||
        hasOwnKey(body, 'clubName') ||
        hasOwnKey(body, 'club_name') ||
        hasOwnKey(body, 'regionCode') ||
        hasOwnKey(body, 'region_code') ||
        hasOwnKey(body, 'districtCode') ||
        hasOwnKey(body, 'district_code') ||
        hasOwnKey(body, 'publicHighbreakEnabled') ||
        hasOwnKey(body, 'public_highbreak_enabled');
      const wantsPasswordChange = !!body.password;

      if (wantsProfileEdit && moduleSettings?.selfProfileEditEnabled === false) {
        return res.status(403).json({ error: 'member_self_profile_edit_disabled' });
      }
      if (wantsPasswordChange && moduleSettings?.selfPasswordChangeEnabled === false) {
        return res.status(403).json({ error: 'member_self_password_change_disabled' });
      }

      const data: any = {};
      if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
      if (body.club_name !== undefined) data.club_name = body.club_name ? String(body.club_name).trim() : null;
      if (body.clubName !== undefined) data.club_name = body.clubName ? String(body.clubName).trim() : null;
      const pubRaw = (body as any).publicHighbreakEnabled ?? (body as any).public_highbreak_enabled;
      if (pubRaw !== undefined) data.public_highbreak_enabled = !!pubRaw;

      const regionRaw = (body as any).regionCode ?? (body as any).region_code;
      const districtRaw = (body as any).districtCode ?? (body as any).district_code;
      if (regionRaw !== undefined || districtRaw !== undefined) {
        const pair = await normalizeAndValidateRegionDistrict({ regionCode: regionRaw ?? null, districtCode: districtRaw ?? null });
        data.region_code = pair.regionCode;
        data.district_code = pair.districtCode;
      }

      const bdRaw = body.birthDate ?? body.birth_date;
      if (bdRaw !== undefined) {
        if (!bdRaw) {
          data.birth_date = null;
        } else {
          const d = new Date(bdRaw);
          if (Number.isNaN(d.getTime())) {
            return res.status(400).json({ error: '出生日期格式不正確' });
          }
          data.birth_date = d;
        }
      }

      if (body.password) {
        const pw = String(body.password);
        const salt = makeSalt();
        data.password_hash = hashPassword(pw, salt);
        data.password_salt = salt;
        data.password_updated_at = new Date();
      }

      const member = await prisma.member.update({
        where: { id },
        data,
      });
      res.json({ member });
    } catch (err: any) {
      if ((err as any)?.code === 'P2025') {
        return res.status(404).json({ error: '會員不存在' });
      }
      const msg = String(err?.message || err);
      const status = (msg.includes('地方') || msg.includes('分區') || msg.includes('請同時選擇地方及分區')) ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });

  return router;
}
