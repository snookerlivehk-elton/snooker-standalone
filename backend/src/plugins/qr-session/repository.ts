import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../../core/db/prisma.js';

export const qrSessionRepository = {
  listTablesWithQr(clubId: string) {
    return prisma.clubTable.findMany({
      where: { clubId },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { qrToken: { select: { token: true, active: true, rotatedAt: true, updatedAt: true } } },
    });
  },

  async ensureQrTokens(clubId: string, tables: any[]) {
    const missing = tables.filter((r: any) => !r.qrToken);
    if (missing.length === 0) return;
    const creates = missing.map((table: any) => prisma.tableQrToken.create({
      data: { id: randomUUID(), clubId, tableId: table.id, token: randomUUID(), active: true },
    }));
    try {
      await prisma.$transaction(creates);
    } catch {}
  },

  findTable(tableId: string) {
    return prisma.clubTable.findUnique({ where: { id: tableId } });
  },

  rotateQrToken(clubId: string, tableId: string, token: string) {
    return prisma.tableQrToken.upsert({
      where: { tableId },
      update: { token, rotatedAt: new Date(), active: true },
      create: { id: randomUUID(), clubId, tableId, token, active: true, rotatedAt: new Date() },
      select: { token: true, active: true, rotatedAt: true, updatedAt: true },
    });
  },

  listActiveSessions(clubId: string) {
    return prisma.tableSession.findMany({
      where: { clubId, status: 'ACTIVE' },
      orderBy: [{ startAt: 'desc' }],
      include: {
        table: { select: { id: true, name: true } },
        startedBy: { select: { id: true, name: true, email: true, member_code: true } },
      },
    });
  },

  findQrByToken(token: string) {
    return prisma.tableQrToken.findUnique({
      where: { token },
      include: {
        club: { select: { id: true, name: true, logoUrl: true } },
        table: { select: { id: true, name: true, basePrice: true, active: true } },
      },
    });
  },

  findActiveSessionForMember(tableId: string, memberId: string) {
    return prisma.tableSession.findFirst({
      where: { tableId, status: 'ACTIVE', startedByMemberId: memberId },
      orderBy: [{ startAt: 'desc' }],
    });
  },

  findAnyActiveSession(tableId: string) {
    return prisma.tableSession.findFirst({ where: { tableId, status: 'ACTIVE' }, select: { id: true } });
  },

  getPointsConfig(clubId: string) {
    return prisma.clubPointsConfig.findUnique({ where: { clubId } });
  },

  createSessionConfirm(data: {
    action: 'START' | 'END';
    token: string;
    clubId: string;
    tableId: string;
    memberId: string;
    sessionId?: string;
    expiresAt: Date;
  }) {
    return prisma.tableSessionConfirm.create({
      data: {
        id: randomUUID(),
        action: data.action,
        token: data.token,
        clubId: data.clubId,
        tableId: data.tableId,
        memberId: data.memberId,
        sessionId: data.sessionId ?? null,
        expiresAt: data.expiresAt,
      },
    });
  },

  async confirmStart(confirmId: string, memberId: string, now: Date, getClubFeatureAssignment: any) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.tableSessionConfirm.findUnique({ where: { id: confirmId } });
      if (!c) throw new Error('confirm_not_found');
      if (c.memberId !== memberId) throw new Error('forbidden');
      if (c.action !== 'START') throw new Error('invalid_action');
      if (c.consumedAt) throw new Error('already_consumed');
      if (new Date(c.expiresAt).getTime() < now.getTime()) throw new Error('expired');
      const qrAssignment = await getClubFeatureAssignment(tx, c.clubId, 'qr_session');
      if (!qrAssignment.assignedEnabled) throw new Error('feature_disabled');
      const qr = await tx.tableQrToken.findUnique({
        where: { token: c.token },
        include: { table: { select: { id: true, active: true } } },
      });
      if (!qr || qr.active === false) throw new Error('not_found');
      if (qr.table.active === false) throw new Error('table_disabled');
      const active = await tx.tableSession.findFirst({ where: { tableId: qr.tableId, status: 'ACTIVE' }, select: { id: true } });
      if (active) throw new Error('already_active');
      await tx.tableSessionConfirm.update({ where: { id: c.id }, data: { consumedAt: now } });
      return tx.tableSession.create({
        data: {
          id: randomUUID(),
          clubId: qr.clubId,
          tableId: qr.tableId,
          startedByMemberId: memberId,
          startAt: now,
          status: 'ACTIVE',
        },
      });
    });
  },

  async endSessionByOperator(
    clubId: string,
    sessionId: string,
    operatorId: string,
    now: Date,
    getClubFeatureAssignment: any,
    calcFn: (input: { session: any; cfg: any; featurePoints: boolean }) => {
      billedMinutes: number;
      amount: number | null;
      currency: string;
      chargedPoints: number;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.tableSession.findUnique({
        where: { id: sessionId },
        include: { table: { select: { id: true, name: true, basePrice: true } } },
      });
      if (!session || session.clubId !== clubId) throw new Error('Not found');
      if (session.status !== 'ACTIVE') throw new Error('Session not active');
      const pointsAssignment = await getClubFeatureAssignment(tx, clubId, 'points');
      const featurePoints = !!pointsAssignment.assignedEnabled;
      const cfg = await tx.clubPointsConfig.findUnique({ where: { clubId } });
      const billing = calcFn({ session, cfg, featurePoints });

      let pointsLedgerId: string | null = null;
      if (featurePoints && billing.chargedPoints > 0) {
        pointsLedgerId = randomUUID();
        await tx.pointsLedger.create({
          data: {
            id: pointsLedgerId,
            clubId,
            memberId: session.startedByMemberId,
            deltaPoints: -billing.chargedPoints,
            reason: `台費抵扣（${session.table.name}）`,
            refType: 'TABLE_SESSION',
            refId: session.id,
            createdByMemberId: operatorId,
            createdAt: now,
          },
        });
        await tx.pointsBalance.upsert({
          where: { clubId_memberId: { clubId, memberId: session.startedByMemberId } },
          update: { balance: { increment: -billing.chargedPoints } },
          create: { id: randomUUID(), clubId, memberId: session.startedByMemberId, balance: -billing.chargedPoints },
        });
      }

      return tx.tableSession.update({
        where: { id: session.id },
        data: {
          status: 'ENDED',
          endAt: now,
          endedByOperatorId: operatorId,
          endSource: 'OPERATOR',
          billedMinutes: billing.billedMinutes,
          chargedAmount: billing.amount == null ? null : String(billing.amount),
          chargedCurrency: billing.currency,
          chargedPoints: billing.chargedPoints || null,
          pointsLedgerId,
        },
        include: {
          table: { select: { id: true, name: true } },
          startedBy: { select: { id: true, name: true, email: true, member_code: true } },
        },
      });
    });
  },

  async confirmEnd(
    confirmId: string,
    memberId: string,
    now: Date,
    featureMap: Record<string, boolean>,
    getClubFeatureAssignment: any,
    calcFn: (input: { session: any; cfg: any; enablePoints: boolean }) => {
      billedMinutes: number;
      amount: number | null;
      currency: string;
      chargedPoints: number;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.tableSessionConfirm.findUnique({ where: { id: confirmId } });
      if (!c) throw new Error('confirm_not_found');
      if (c.memberId !== memberId) throw new Error('forbidden');
      if (c.action !== 'END') throw new Error('invalid_action');
      if (c.consumedAt) throw new Error('already_consumed');
      if (new Date(c.expiresAt).getTime() < now.getTime()) throw new Error('expired');
      if (!c.sessionId) throw new Error('invalid_session');
      const s = await tx.tableSession.findUnique({
        where: { id: c.sessionId },
        include: { table: { select: { id: true, name: true, basePrice: true } } },
      });
      if (!s) throw new Error('not_found');
      if (s.status !== 'ACTIVE') throw new Error('not_active');
      if (s.startedByMemberId !== memberId) throw new Error('forbidden');
      const qrAssignment = await getClubFeatureAssignment(tx, s.clubId, 'qr_session');
      if (!qrAssignment.assignedEnabled) throw new Error('feature_disabled');
      const pointsAssignment = await getClubFeatureAssignment(tx, s.clubId, 'points');
      const enablePoints = featureMap.points !== false && pointsAssignment.assignedEnabled;
      const cfg = await tx.clubPointsConfig.findUnique({ where: { clubId: s.clubId } });
      const billing = calcFn({ session: s, cfg, enablePoints });

      await tx.tableSessionConfirm.update({ where: { id: c.id }, data: { consumedAt: now } });

      let pointsLedgerId: string | null = null;
      if (enablePoints && billing.chargedPoints > 0) {
        pointsLedgerId = randomUUID();
        await tx.pointsLedger.create({
          data: {
            id: pointsLedgerId,
            clubId: s.clubId,
            memberId,
            deltaPoints: -billing.chargedPoints,
            reason: `台費抵扣（${s.table.name}）`,
            refType: 'TABLE_SESSION',
            refId: s.id,
            createdByMemberId: memberId,
            createdAt: now,
          },
        });
        await tx.pointsBalance.upsert({
          where: { clubId_memberId: { clubId: s.clubId, memberId } },
          update: { balance: { increment: -billing.chargedPoints } },
          create: { id: randomUUID(), clubId: s.clubId, memberId, balance: -billing.chargedPoints },
        });
      }

      return tx.tableSession.update({
        where: { id: s.id },
        data: {
          status: 'ENDED',
          endAt: now,
          endedByMemberId: memberId,
          endSource: 'MEMBER',
          billedMinutes: billing.billedMinutes,
          chargedAmount: billing.amount == null ? null : String(billing.amount),
          chargedCurrency: billing.currency,
          chargedPoints: billing.chargedPoints || null,
          pointsLedgerId,
        },
      });
    });
  },
};
