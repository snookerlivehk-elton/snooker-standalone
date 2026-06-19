import express from 'express';
import { getClubFeatureAssignment } from '../../../clubFeatureAccess.js';
import { prisma } from '../db/prisma.js';

export const FEATURE_DEFAULTS: Record<string, boolean> = {
  booking: true,
  qr_session: true,
  points: true,
  highbreak: true,
  tournaments: true,
  club_messages: true,
  club_dashboard: true,
  system_portal: true,
  member_portal: true,
  live: true,
};

export async function isFeatureEnabled(key: string): Promise<boolean> {
  try {
    const row = await prisma.featureFlag.findUnique({ where: { key }, select: { enabled: true } });
    if (row) return row.enabled;
  } catch {}
  return FEATURE_DEFAULTS[key] ?? true;
}

export async function requireClubFeatureForClubId(
  res: express.Response,
  clubId: string,
  key: 'points',
): Promise<boolean> {
  const globalEnabled = await isFeatureEnabled(key);
  if (!globalEnabled) {
    res.status(403).json({ error: 'feature_disabled', feature: key });
    return false;
  }
  const assignment = await getClubFeatureAssignment(prisma, clubId, key);
  if (!assignment.assignedEnabled) {
    res.status(403).json({ error: 'feature_disabled', feature: key, scope: 'club', clubId });
    return false;
  }
  return true;
}
