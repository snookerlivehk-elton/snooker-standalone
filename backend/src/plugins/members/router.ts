import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import { randomUUID } from 'crypto';
import { prisma } from '../../core/db/prisma.js';
import { requireMember } from '../../core/club/access.js';
import { resolveMemberTier } from '../../core/members/eligibility.js';
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

  router.get('/api/me/breaks', async (req, res) => {
    try {
      const memberId = String(req.headers['x-member-id'] || '').trim();
      if (!memberId) return res.status(401).json({ error: 'Unauthorized' });
      const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true, is_enabled: true } });
      if (!member) return res.status(401).json({ error: 'Unauthorized' });
      if (member.is_enabled === false) return res.status(403).json({ error: 'Disabled' });

      const clubId = req.query.clubId ? String(req.query.clubId).trim() : '';
      const month = req.query.month ? String(req.query.month).trim() : '';

      const where: any = { member_id: memberId, deleted_at: null };
      if (clubId) where.club_id = clubId;
      if (month) {
        const range = parseMonthRangeUtc(month);
        if (!range) return res.status(400).json({ error: 'month invalid' });
        where.recorded_at = { gte: range.start, lt: range.end };
      }

      const rows = await prisma.breakRecord.findMany({
        where,
        orderBy: [{ recorded_at: 'desc' }],
        include: {
          club: { select: { id: true, name: true, logoUrl: true } },
        },
      });
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: String(err?.message || err) });
    }
  });

  router.post('/api/members/register', async (req, res) => {
    try {
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
