import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../../core/db/prisma.js';

const memberSelect = {
  id: true,
  name: true,
  email: true,
  member_code: true,
  phone: true,
  phone_e164: true,
} as const;

export const pointsRepository = {
  getConfig(clubId: string) {
    return prisma.clubPointsConfig.findUnique({ where: { clubId } });
  },

  getConfigId(clubId: string) {
    return prisma.clubPointsConfig.findUnique({ where: { clubId }, select: { id: true } });
  },

  upsertConfig(
    clubId: string,
    existingId: string | undefined,
    data: { currencyCode: string; pointsPerCurrency: string; roundingMinutes: number; minBillableMinutes: number },
  ) {
    return prisma.clubPointsConfig.upsert({
      where: { clubId },
      update: data,
      create: { id: existingId || randomUUID(), clubId, ...data },
    });
  },

  listClubMemberships(clubId: string) {
    return prisma.clubMember.findMany({
      where: { clubId },
      include: { member: { select: memberSelect } },
      orderBy: [{ joinedAt: 'desc' }],
    });
  },

  searchClubMemberships(clubId: string, q: string, limit: number) {
    const where: any = { clubId };
    if (q) {
      where.member = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { member_code: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { phone_e164: { contains: q, mode: 'insensitive' } },
        ],
      };
    }
    return prisma.clubMember.findMany({
      where,
      take: limit,
      orderBy: [{ joinedAt: 'desc' }],
      include: { member: { select: memberSelect } },
    });
  },

  listBalances(clubId: string, memberIds: string[]) {
    if (memberIds.length === 0) return Promise.resolve([]);
    return prisma.pointsBalance.findMany({
      where: { clubId, memberId: { in: memberIds } },
      select: { memberId: true, balance: true, updatedAt: true },
    });
  },

  findClubMembership(clubId: string, memberId: string) {
    return prisma.clubMember.findUnique({ where: { clubId_memberId: { clubId, memberId } } });
  },

  getBalance(clubId: string, memberId: string) {
    return prisma.pointsBalance.findUnique({
      where: { clubId_memberId: { clubId, memberId } },
      select: { balance: true, updatedAt: true },
    });
  },

  listMemberClubMemberships(memberId: string) {
    return prisma.clubMember.findMany({
      where: { memberId },
      select: { clubId: true },
      orderBy: [{ joinedAt: 'desc' }],
      take: 200,
    });
  },

  listMemberBalances(memberId: string, clubIds: string[]) {
    if (clubIds.length === 0) return Promise.resolve([]);
    return prisma.pointsBalance.findMany({
      where: { memberId, clubId: { in: clubIds } },
      select: { clubId: true, balance: true, updatedAt: true },
    });
  },

  listLedger(where: Prisma.PointsLedgerWhereInput, limit: number) {
    return prisma.pointsLedger.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      include: {
        member: { select: memberSelect },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  },

  aggregateLedgerTotal(where: Prisma.PointsLedgerWhereInput) {
    return prisma.pointsLedger.aggregate({ where, _sum: { deltaPoints: true } });
  },

  listLedgerForMonthGrouping(where: Prisma.PointsLedgerWhereInput) {
    return prisma.pointsLedger.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: { createdAt: true, deltaPoints: true },
      take: 5000,
    });
  },

  adjustBalance(clubId: string, targetMemberId: string, delta: number, reason: string, createdByMemberId: string) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.pointsLedger.create({
        data: {
          id: randomUUID(),
          clubId,
          memberId: targetMemberId,
          deltaPoints: delta,
          reason,
          createdByMemberId,
          createdAt: now,
        },
      });
      return tx.pointsBalance.upsert({
        where: { clubId_memberId: { clubId, memberId: targetMemberId } },
        update: { balance: { increment: delta } },
        create: { id: randomUUID(), clubId, memberId: targetMemberId, balance: delta },
        select: { balance: true, updatedAt: true },
      });
    });
  },
};
