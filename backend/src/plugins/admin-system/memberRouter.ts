import { Prisma } from '@prisma/client';
import express from 'express';
import { hashPassword, makeSalt, normalizeAndValidateRegionDistrict } from '../../core/members/utils.js';
import { prisma } from '../../core/db/prisma.js';

type MemberAdminRouterOptions = {
  adminAuth: express.RequestHandler;
};

export function createAdminMemberRouter(options: MemberAdminRouterOptions) {
  const { adminAuth } = options;
  const router = express.Router();

  router.post('/api/admin/members/:id/password', adminAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      const { newPassword } = (req.body || {}) as { newPassword?: string };
      const pw = String(newPassword || '');
      if (!id || !pw) {
        return res.status(400).json({ error: '缺少會員 ID 或新密碼' });
      }
      const salt = makeSalt();
      const updated = await prisma.member.update({
        where: { id },
        data: { password_salt: salt, password_hash: hashPassword(pw, salt), password_updated_at: new Date() },
        select: { id: true },
      });
      res.json({ ok: true, id: updated.id });
    } catch (err: any) {
      if ((err as any)?.code === 'P2025') return res.status(404).json({ error: '會員不存在' });
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.post('/api/admin/wipe-test-data', adminAuth, async (_req, res) => {
    try {
      await prisma.$transaction([
        prisma.matchPlayer.deleteMany({}),
        prisma.match.deleteMany({}),
        prisma.memberCodeSequence.deleteMany({}),
        prisma.memberSequence.deleteMany({}),
        prisma.member.deleteMany({}),
      ]);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/admin/member/regions', adminAuth, async (_req, res) => {
    try {
      const regions = await prisma.memberRegion.findMany({
        orderBy: { code3: 'asc' },
      });
      res.json({ regions });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.post('/api/admin/member/regions', adminAuth, async (req, res) => {
    try {
      const { code3, name, active } = (req.body || {}) as { code3?: string; name?: string; active?: boolean };
      const code = String(code3 || '').trim().toUpperCase();
      const nm = String(name || '').trim();
      if (!code || !nm) {
        return res.status(400).json({ error: 'code3 與 name 為必填' });
      }
      const existing = await prisma.memberRegion.findUnique({
        where: { code3: code },
      });
      if (existing) {
        return res.status(409).json({ error: '地方代碼已存在' });
      }
      const region = await prisma.memberRegion.create({
        data: { code3: code, name: nm, active: typeof active === 'boolean' ? active : true },
      });
      res.json({ region });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.put('/api/admin/member/regions/:code3', adminAuth, async (req, res) => {
    try {
      const codeParam = String(req.params.code3 || '').trim().toUpperCase();
      const { name, active } = (req.body || {}) as { name?: string; active?: boolean };
      const nm = String(name || '').trim();
      if (!codeParam || !nm) {
        return res.status(400).json({ error: 'code3 與 name 為必填' });
      }
      const existing = await prisma.memberRegion.findUnique({
        where: { code3: codeParam },
      });
      if (!existing) {
        return res.status(404).json({ error: '地方不存在' });
      }
      const region = await prisma.memberRegion.update({
        where: { code3: codeParam },
        data: {
          name: nm,
          ...(typeof active === 'boolean' ? { active } : {}),
        },
      });
      res.json({ region });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/admin/member/districts', adminAuth, async (_req, res) => {
    try {
      const districts = await prisma.memberDistrict.findMany({
        where: {},
        orderBy: [{ region_code: 'asc' }, { code3: 'asc' }],
      });
      res.json({ districts });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.post('/api/admin/member/districts', adminAuth, async (req, res) => {
    try {
      const { regionCode, code3, name, active } = (req.body || {}) as {
        regionCode?: string;
        code3?: string;
        name?: string;
        active?: boolean;
      };
      const region = String(regionCode || '').trim().toUpperCase();
      const code = String(code3 || '').trim().toUpperCase();
      const nm = String(name || '').trim();
      if (!region || !code || !nm) {
        return res.status(400).json({ error: 'regionCode、code3 與 name 為必填' });
      }
      const existing = await prisma.memberDistrict.findUnique({
        where: { region_code_code3: { region_code: region, code3: code } },
      });
      if (existing) {
        return res.status(409).json({ error: '分區代碼已存在' });
      }
      const district = await prisma.memberDistrict.create({
        data: { region_code: region, code3: code, name: nm, active: typeof active === 'boolean' ? active : true },
      });
      res.json({ district });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.put('/api/admin/member/districts/:regionCode/:code3', adminAuth, async (req, res) => {
    try {
      const regionParam = String(req.params.regionCode || '').trim().toUpperCase();
      const codeParam = String(req.params.code3 || '').trim().toUpperCase();
      const { name, active } = (req.body || {}) as { name?: string; active?: boolean };
      const nm = String(name || '').trim();
      if (!regionParam || !codeParam || !nm) {
        return res.status(400).json({ error: 'regionCode、code3 與 name 為必填' });
      }
      const existing = await prisma.memberDistrict.findUnique({
        where: { region_code_code3: { region_code: regionParam, code3: codeParam } },
      });
      if (!existing) {
        return res.status(404).json({ error: '分區不存在' });
      }
      const district = await prisma.memberDistrict.update({
        where: { region_code_code3: { region_code: regionParam, code3: codeParam } },
        data: {
          name: nm,
          ...(typeof active === 'boolean' ? { active } : {}),
        },
      });
      res.json({ district });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.delete('/api/admin/member/districts/:regionCode/:code3', adminAuth, async (req, res) => {
    try {
      const regionParam = String(req.params.regionCode || '').trim().toUpperCase();
      const codeParam = String(req.params.code3 || '').trim().toUpperCase();
      if (!regionParam || !codeParam) {
        return res.status(400).json({ error: 'regionCode 與 code3 為必填' });
      }
      const existing = await prisma.memberDistrict.findUnique({
        where: { region_code_code3: { region_code: regionParam, code3: codeParam } },
      });
      if (!existing) {
        return res.status(404).json({ error: '分區不存在' });
      }
      await prisma.memberDistrict.delete({
        where: { region_code_code3: { region_code: regionParam, code3: codeParam } },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.get('/api/admin/members', adminAuth, async (req, res) => {
    try {
      const page = Number((req.query.page as string) || '1');
      const pageSize = Number((req.query.pageSize as string) || '20');
      const take = Math.max(1, Math.min(pageSize, 100));
      const skip = Math.max(0, (page - 1) * take);

      const [total, members] = await prisma.$transaction([
        prisma.member.count(),
        prisma.member.findMany({ skip, take, orderBy: { created_at: 'desc' } }),
      ]);

      res.json({ total, page, pageSize: take, members });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.put('/api/admin/members/:id', adminAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: '缺少會員 ID' });
      }
      const body = (req.body || {}) as {
        name?: string;
        email?: string | null;
        region_code?: string | null;
        regionCode?: string | null;
        district_code?: string | null;
        districtCode?: string | null;
        member_code?: string | null;
        phone?: string | null;
        birthDate?: string | null;
        birth_date?: string | null;
        role?: string | null;
        membershipExpiresAt?: string | null;
        membership_expires_at?: string | null;
        club_name?: string | null;
        clubName?: string | null;
        is_enabled?: boolean | null;
        isEnabled?: boolean | null;
        access_expires_at?: string | null;
        accessExpiresAt?: string | null;
      };

      const data: any = {};
      if (body.name !== undefined) data.name = String(body.name ?? '').trim();
      if (body.email !== undefined) data.email = body.email ? String(body.email).trim() : null;
      const regionRaw = body.regionCode ?? body.region_code;
      const districtRaw = body.districtCode ?? body.district_code;
      if (regionRaw !== undefined || districtRaw !== undefined) {
        const pair = await normalizeAndValidateRegionDistrict({ regionCode: regionRaw ?? null, districtCode: districtRaw ?? null });
        data.region_code = pair.regionCode;
        data.district_code = pair.districtCode;
      }
      if (body.member_code !== undefined) data.member_code = body.member_code ? String(body.member_code).trim() : null;
      if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).trim() : null;
      if (body.club_name !== undefined) data.club_name = body.club_name ? String(body.club_name).trim() : null;
      if (body.clubName !== undefined) data.club_name = body.clubName ? String(body.clubName).trim() : null;

      const bdRaw = body.birthDate ?? body.birth_date;
      if (bdRaw !== undefined) {
        if (!bdRaw) {
          data.birth_date = null;
        } else {
          const d = new Date(bdRaw);
          if (Number.isNaN(d.getTime())) return res.status(400).json({ error: '出生日期格式不正確' });
          data.birth_date = d;
        }
      }

      const membershipRaw = body.membershipExpiresAt ?? body.membership_expires_at;
      if (membershipRaw !== undefined) {
        const s = String(membershipRaw || '').trim();
        if (!s) {
          data.membership_expires_at = null;
        } else {
          const d = new Date(s);
          if (Number.isNaN(d.getTime())) return res.status(400).json({ error: '會員有效期格式不正確' });
          data.membership_expires_at = d;
        }
      }
      if (body.role !== undefined) {
        const r = String(body.role || 'MEMBER').toUpperCase();
        data.role = r === 'ADMIN' ? 'ADMIN' : 'MEMBER';
      }

      const enabledRaw = body.is_enabled ?? body.isEnabled;
      if (enabledRaw !== undefined) data.is_enabled = Boolean(enabledRaw);

      const accessRaw = body.access_expires_at ?? body.accessExpiresAt;
      if (accessRaw !== undefined) {
        const s = String(accessRaw || '').trim();
        if (!s) {
          data.access_expires_at = null;
        } else {
          const d = new Date(s);
          if (Number.isNaN(d.getTime())) return res.status(400).json({ error: '場館限期格式不正確' });
          data.access_expires_at = d;
        }
      }

      const member = await prisma.member.update({
        where: { id },
        data,
      });
      res.json({ member });
    } catch (err: any) {
      if ((err as any)?.code === 'P2025') return res.status(404).json({ error: '會員不存在' });
      const msg = String(err?.message || err);
      const status = (msg.includes('地方') || msg.includes('分區') || msg.includes('請同時選擇地方及分區')) ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  });

  router.delete('/api/admin/members/:id', adminAuth, async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        return res.status(400).json({ error: '缺少會員 ID' });
      }
      const purge = String((req.query as any)?.purge || '').trim() === '1';
      try {
        if (purge) {
          const club = await prisma.clubProfile.findUnique({
            where: { memberId: id },
            select: { id: true },
          });
          const clubId = club?.id || null;

          const matchPlayers = await prisma.matchPlayer.findMany({
            where: { member_id: id },
            select: { match_id: true },
          });
          const matchIdsFromPlayers = matchPlayers.map((r) => r.match_id);

          const matchesDirect = await prisma.match.findMany({
            where: {
              OR: [
                { operator_id: id },
                { winner_member_id: id },
              ],
            },
            select: { id: true },
          });
          const matchIdsDirect = matchesDirect.map((m) => m.id);
          const matchIds = Array.from(new Set([...matchIdsFromPlayers, ...matchIdsDirect]));

          await prisma.$transaction(async (tx) => {
            if (clubId) {
              await tx.$executeRaw(
                Prisma.sql`DELETE FROM "ClubMessageRead" WHERE "messageId" IN (SELECT "id" FROM "ClubMessage" WHERE "clubId" = ${clubId})`,
              );
              await tx.tableSessionConfirm.deleteMany({ where: { clubId } });
              await tx.tournamentSignup.deleteMany({ where: { tournament: { clubId } } });
              await tx.tournament.deleteMany({ where: { clubId } });
              await tx.liveAnnouncement.deleteMany({ where: { clubId } });
              await tx.clubMessage.deleteMany({ where: { clubId } });
              await tx.breakRecord.deleteMany({ where: { club_id: clubId } });
              await tx.clubFeatureAccess.deleteMany({ where: { clubId } });
              await tx.pointsLedger.deleteMany({ where: { clubId } });
              await tx.pointsBalance.deleteMany({ where: { clubId } });
              await tx.clubPointsConfig.deleteMany({ where: { clubId } });
              await tx.tableSession.deleteMany({ where: { clubId } });
              await tx.tableQrToken.deleteMany({ where: { clubId } });
              await tx.tableReservation.deleteMany({ where: { clubId } });
              await tx.tablePricingScheme.deleteMany({ where: { clubId } });
              await tx.clubTable.deleteMany({ where: { clubId } });
              await tx.clubMember.deleteMany({ where: { clubId } });
              await tx.clubProfile.deleteMany({ where: { id: clubId } });
            }

            await tx.$executeRaw(Prisma.sql`DELETE FROM "ClubMessageRead" WHERE "memberId" = ${id}`);
            await tx.clubMember.deleteMany({ where: { memberId: id } });
            await tx.tournamentSignup.deleteMany({ where: { memberId: id } });
            await tx.liveAnnouncement.deleteMany({ where: { createdByMemberId: id } });
            await tx.tableSessionConfirm.deleteMany({ where: { memberId: id } });
            await tx.tableReservation.deleteMany({ where: { memberId: id } });
            await tx.pointsLedger.deleteMany({ where: { memberId: id } });
            await tx.pointsLedger.deleteMany({ where: { createdByMemberId: id } });
            await tx.pointsBalance.deleteMany({ where: { memberId: id } });
            await tx.tableSession.deleteMany({ where: { startedByMemberId: id } });
            await tx.tableSession.deleteMany({ where: { endedByMemberId: id } });
            await tx.tableSession.deleteMany({ where: { endedByOperatorId: id } });
            await tx.breakRecord.deleteMany({ where: { member_id: id } });
            await tx.breakRecord.deleteMany({ where: { created_by_member_id: id } });

            if (matchIds.length) {
              await tx.match.deleteMany({ where: { id: { in: matchIds } } });
            }

            await tx.member.delete({ where: { id } });
          });
        } else {
          await prisma.member.delete({ where: { id } });
        }
      } catch (err: any) {
        if ((err as any)?.code === 'P2025') {
          return res.status(404).json({ error: '會員不存在' });
        }
        if ((err as any)?.code === 'P2003') {
          if (purge) {
            const meta = (err as any)?.meta;
            const field = meta?.field_name ? String(meta.field_name) : '';
            return res.status(400).json({ error: `永久刪除失敗：仍有外鍵關聯未清理${field ? `（${field}）` : ''}` });
          }
          return res.status(400).json({ error: '會員已有關聯資料（例如比賽/場館/預約），無法直接刪除。若要連同相關資料永久刪除，請使用 purge=1' });
        }
        throw err;
      }
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  return router;
}
