import express from 'express';
import { prisma } from '../db/prisma.js';

export type ClubAuthMember = {
  id: string;
  role: 'MEMBER' | 'ADMIN';
  is_enabled: boolean;
  access_expires_at: Date | null;
};

export async function requireMember(req: express.Request, res: express.Response): Promise<ClubAuthMember | null> {
  const memberId = String(req.headers['x-member-id'] || '').trim();
  if (!memberId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, role: true, is_enabled: true, access_expires_at: true },
  });
  if (!member) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  if (member.is_enabled === false) {
    res.status(403).json({ error: 'Disabled' });
    return null;
  }
  return member as ClubAuthMember;
}

export async function requireClubAdmin(req: express.Request, res: express.Response): Promise<ClubAuthMember | null> {
  const member = await requireMember(req, res);
  if (!member) return null;
  if (member.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  if (member.access_expires_at && new Date(member.access_expires_at).getTime() < Date.now()) {
    res.status(403).json({ error: 'Expired' });
    return null;
  }
  return member;
}

export async function getMyClubId(memberId: string): Promise<string | null> {
  const club = await prisma.clubProfile.findUnique({
    where: { memberId },
    select: { id: true },
  });
  return club?.id || null;
}
