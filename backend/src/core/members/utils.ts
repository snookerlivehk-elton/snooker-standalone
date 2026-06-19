import { createHash, randomBytes } from 'crypto';
import { prisma } from '../db/prisma.js';

export async function normalizeAndValidateRegionDistrict(input: {
  regionCode?: string | null;
  districtCode?: string | null;
}): Promise<{ regionCode: string | null; districtCode: string | null }> {
  const region = String(input.regionCode ?? '').trim().toUpperCase();
  const district = String(input.districtCode ?? '').trim().toUpperCase();
  if (!region && !district) return { regionCode: null, districtCode: null };
  if (!region || !district) throw new Error('請同時選擇地方及分區');
  const r = await prisma.memberRegion.findUnique({ where: { code3: region }, select: { active: true } });
  if (!r || r.active === false) throw new Error('地方無效');
  const d = await prisma.memberDistrict.findUnique({
    where: { region_code_code3: { region_code: region, code3: district } },
    select: { active: true },
  });
  if (!d || d.active === false) throw new Error('分區無效');
  return { regionCode: region, districtCode: district };
}

export function makeSalt(): string {
  return randomBytes(16).toString('hex');
}

export function hashPassword(password: string, salt: string): string {
  const h = createHash('sha256');
  h.update(`${salt}${password}`);
  return h.digest('hex');
}

export function verifyPassword(password: string, salt: string, digest: string): boolean {
  return hashPassword(password, salt) === digest;
}

export function normalizePhoneE164(input: { country?: string; number?: string } | string): string {
  const raw = typeof input === 'string' ? input : `${String(input.country || '')}${String(input.number || '')}`;
  const s0 = String(raw || '').trim();
  if (!s0) return '';
  let s = s0.replace(/[()\s\-.]/g, '');
  s = s.replace(/^00/, '+');
  if (!s.startsWith('+')) {
    s = `+${s}`;
  }
  if (!/^\+\d{6,20}$/.test(s)) return '';
  return s;
}

export function generateEmailCode(): string {
  const buf = randomBytes(3);
  const num = buf.readUIntBE(0, 3) % 1000000;
  return String(num).padStart(6, '0');
}

export async function generateUniqueMemberCode(tx: {
  member: {
    findFirst: typeof prisma.member.findFirst;
  };
}): Promise<string | null> {
  for (let i = 0; i < 5; i++) {
    const code = `M${randomBytes(6).toString('hex').toUpperCase()}`;
    const exists = await tx.member.findFirst({ where: { member_code: code } });
    if (!exists) return code;
  }
  return null;
}

export async function findMemberByIdOrEmail(identifier: string) {
  const value = String(identifier || '').trim();
  if (!value) return null;
  return prisma.member.findFirst({
    where: {
      OR: [
        { id: value },
        { email: value },
      ],
    },
  });
}
