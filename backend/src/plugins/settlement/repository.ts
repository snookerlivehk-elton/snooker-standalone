import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../../core/db/prisma.js';

type DbClient = typeof prisma | Prisma.TransactionClient;

function getDb(db?: DbClient) {
  return db || prisma;
}

export const settlementRepository = {
  createSettlement(
    data: {
      sessionId: string;
      clubId: string;
      memberId: string;
      tableId: string;
      paymentMethod?: 'POINTS' | 'MANUAL' | 'CASH' | 'WALLET' | 'PACKAGE' | null;
      status?: 'PENDING' | 'QUOTED' | 'AWAITING_CONFIRMATION' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
      durationMinutes?: number | null;
      billableMinutes?: number | null;
      baseAmount?: string | null;
      chargedAmount?: string | null;
      chargedCurrency?: string | null;
      quotePayload?: any;
      pointsLedgerId?: string | null;
      confirmedAt?: Date | null;
      completedAt?: Date | null;
      failedAt?: Date | null;
      failureReason?: string | null;
    },
    db?: DbClient,
  ) {
    return getDb(db).sessionSettlement.create({
      data: {
        id: randomUUID(),
        sessionId: data.sessionId,
        clubId: data.clubId,
        memberId: data.memberId,
        tableId: data.tableId,
        paymentMethod: data.paymentMethod ?? null,
        status: data.status ?? 'PENDING',
        durationMinutes: data.durationMinutes ?? null,
        billableMinutes: data.billableMinutes ?? null,
        baseAmount: data.baseAmount ?? null,
        chargedAmount: data.chargedAmount ?? null,
        chargedCurrency: data.chargedCurrency ?? null,
        quotePayload: data.quotePayload ?? undefined,
        pointsLedgerId: data.pointsLedgerId ?? null,
        confirmedAt: data.confirmedAt ?? null,
        completedAt: data.completedAt ?? null,
        failedAt: data.failedAt ?? null,
        failureReason: data.failureReason ?? null,
      },
    });
  },

  updateSettlement(id: string, data: any, db?: DbClient) {
    return getDb(db).sessionSettlement.update({ where: { id }, data });
  },

  createAttempt(
    data: {
      settlementId: string;
      providerKey: string;
      status: string;
      requestPayload?: any;
      responsePayload?: any;
      failureReason?: string | null;
    },
    db?: DbClient,
  ) {
    return getDb(db).sessionSettlementAttempt.create({
      data: {
        id: randomUUID(),
        settlementId: data.settlementId,
        providerKey: data.providerKey,
        status: data.status,
        requestPayload: data.requestPayload ?? undefined,
        responsePayload: data.responsePayload ?? undefined,
        failureReason: data.failureReason ?? null,
      },
    });
  },

  createOutbox(
    data: { eventType: string; aggregateType: string; aggregateId: string; payload: any },
    db?: DbClient,
  ) {
    return getDb(db).domainEventOutbox.create({
      data: {
        id: randomUUID(),
        eventType: data.eventType,
        aggregateType: data.aggregateType,
        aggregateId: data.aggregateId,
        payload: data.payload,
      },
    });
  },

  findSettlement(id: string) {
    return prisma.sessionSettlement.findUnique({
      where: { id },
      include: {
        attempts: { orderBy: { createdAt: 'desc' } },
      },
    });
  },

  listMySettlements(memberId: string, limit: number) {
    return prisma.sessionSettlement.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        attempts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  },

  listSettlements(limit: number, status?: string) {
    const where = status ? { status: status as any } : {};
    return prisma.sessionSettlement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        attempts: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  },
};
