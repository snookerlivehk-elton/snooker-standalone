import { prisma } from '../../core/db/prisma.js';
import { pointsRepository } from '../points/repository.js';
import { pointsService } from '../points/service.js';
import { settlementRepository } from './repository.js';

export const settlementService = {
  listMySettlements(memberId: string, limitRaw: any) {
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 20) || 20));
    return settlementRepository.listMySettlements(memberId, limit);
  },

  async getSettlementForMember(id: string, member: { id: string; role: 'MEMBER' | 'ADMIN' }, adminClubId?: string | null) {
    const row = await settlementRepository.findSettlement(id);
    if (!row) throw new Error('Not found');
    if (row.memberId === member.id) return row;
    if (member.role === 'ADMIN' && adminClubId && row.clubId === adminClubId) return row;
    throw new Error('Not found');
  },

  listSettlements(limitRaw: any, statusRaw: any) {
    const limit = Math.min(200, Math.max(1, Number(limitRaw || 50) || 50));
    const status = statusRaw == null ? undefined : String(statusRaw).trim().toUpperCase();
    return settlementRepository.listSettlements(limit, status || undefined);
  },

  async prepareSettlementQuote(id: string, actorMemberId?: string) {
    return prisma.$transaction(async (tx) => {
      const row = await tx.sessionSettlement.findUnique({
        where: { id },
        include: { session: { include: { table: { select: { name: true } } } } },
      });
      if (!row) throw new Error('Not found');
      if (actorMemberId && row.memberId !== actorMemberId) throw new Error('Not found');
      if (row.paymentMethod !== 'POINTS') return row;
      if (String(row.status || '') === 'COMPLETED') return row;

      const quote = await pointsService.quoteSettlement(row);
      const quoted = await settlementRepository.updateSettlement(row.id, {
        status: 'AWAITING_CONFIRMATION',
        failureReason: null,
        quotePayload: {
          ...((row.quotePayload as any) || {}),
          requiredPoints: quote.requiredPoints,
          availablePoints: quote.availablePoints,
          canAfford: quote.availablePoints >= quote.requiredPoints,
          currencyCode: quote.currencyCode,
          pointsPerCurrency: quote.pointsPerCurrency,
        },
      }, tx);

      await settlementRepository.createAttempt({
        settlementId: row.id,
        providerKey: 'points',
        status: 'QUOTED',
        requestPayload: {
          sessionId: row.sessionId,
          chargedAmount: row.chargedAmount == null ? null : String(row.chargedAmount),
          baseAmount: row.baseAmount == null ? null : String(row.baseAmount),
        },
        responsePayload: {
          requiredPoints: quote.requiredPoints,
          availablePoints: quote.availablePoints,
          canAfford: quote.availablePoints >= quote.requiredPoints,
          currencyCode: quote.currencyCode,
          pointsPerCurrency: quote.pointsPerCurrency,
        },
      }, tx);

      await settlementRepository.createOutbox({
        eventType: 'points.quote.generated',
        aggregateType: 'session_settlement',
        aggregateId: row.id,
        payload: {
          settlementId: row.id,
          memberId: row.memberId,
          clubId: row.clubId,
          requiredPoints: quote.requiredPoints,
          availablePoints: quote.availablePoints,
          canAfford: quote.availablePoints >= quote.requiredPoints,
          currency: quote.currencyCode,
          baseAmount: row.baseAmount == null ? null : String(row.baseAmount),
          quoteVersion: 1,
        },
      }, tx);

      return quoted;
    });
  },

  async completeSettlement(id: string, actorMemberId: string) {
    return prisma.$transaction(async (tx) => {
      const row = await tx.sessionSettlement.findUnique({
        where: { id },
        include: { session: { include: { table: { select: { name: true } } } } },
      });
      if (!row) throw new Error('Not found');
      if (!['PENDING', 'QUOTED', 'AWAITING_CONFIRMATION', 'PROCESSING'].includes(String(row.status || ''))) {
        return row;
      }

      const quote = await pointsService.quoteSettlement(row);
      const now = new Date();

      await settlementRepository.createAttempt({
        settlementId: row.id,
        providerKey: row.paymentMethod === 'POINTS' ? 'points' : 'manual',
        status: row.paymentMethod === 'POINTS' ? 'PROCESSING' : 'COMPLETED',
        requestPayload: {
          sessionId: row.sessionId,
          chargedAmount: row.chargedAmount == null ? null : String(row.chargedAmount),
          baseAmount: row.baseAmount == null ? null : String(row.baseAmount),
        },
        responsePayload: row.paymentMethod === 'POINTS' ? {
          requiredPoints: quote.requiredPoints,
          availablePoints: quote.availablePoints,
        } : {
          mode: 'manual',
        },
      }, tx);

      if (row.paymentMethod === 'POINTS') {
        if (quote.availablePoints < quote.requiredPoints) {
          const failed = await settlementRepository.updateSettlement(row.id, {
            status: 'FAILED',
            confirmedAt: now,
            failedAt: now,
            failureReason: 'INSUFFICIENT_POINTS',
            quotePayload: {
              ...(row.quotePayload as any || {}),
              requiredPoints: quote.requiredPoints,
              availablePoints: quote.availablePoints,
              currencyCode: quote.currencyCode,
              pointsPerCurrency: quote.pointsPerCurrency,
            },
          }, tx);
          await settlementRepository.createOutbox({
            eventType: 'settlement.failed',
            aggregateType: 'session_settlement',
            aggregateId: row.id,
            payload: {
              settlementId: row.id,
              sessionId: row.sessionId,
              reason: 'INSUFFICIENT_POINTS',
              failedAt: now.toISOString(),
            },
          }, tx);
          throw new Error('Insufficient points');
        }

        const ledger = await pointsRepository.createSettlementLedger({
          clubId: row.clubId,
          memberId: row.memberId,
          deltaPoints: -quote.requiredPoints,
          reason: `台費抵扣（${row.session?.table?.name || '球枱'}）`,
          refType: 'TABLE_SESSION',
          refId: row.sessionId,
          createdByMemberId: actorMemberId,
        }, tx);
        const balance = await pointsRepository.incrementBalance(row.clubId, row.memberId, -quote.requiredPoints, tx);

        const completed = await settlementRepository.updateSettlement(row.id, {
          status: 'COMPLETED',
          confirmedAt: now,
          completedAt: now,
          pointsLedgerId: ledger.id,
          quotePayload: {
            ...(row.quotePayload as any || {}),
            requiredPoints: quote.requiredPoints,
            availablePoints: quote.availablePoints,
            balanceAfter: balance.balance,
            currencyCode: quote.currencyCode,
            pointsPerCurrency: quote.pointsPerCurrency,
          },
        }, tx);

        await tx.tableSession.update({
          where: { id: row.sessionId },
          data: {
            chargedPoints: quote.requiredPoints || null,
            pointsLedgerId: ledger.id,
          },
        });

        await settlementRepository.createOutbox({
          eventType: 'points.payment.completed',
          aggregateType: 'session_settlement',
          aggregateId: row.id,
          payload: {
            settlementId: row.id,
            memberId: row.memberId,
            clubId: row.clubId,
            deltaPoints: -quote.requiredPoints,
            balanceAfter: balance.balance,
            ledgerId: ledger.id,
            completedAt: now.toISOString(),
          },
        }, tx);

        await settlementRepository.createOutbox({
          eventType: 'settlement.completed',
          aggregateType: 'session_settlement',
          aggregateId: row.id,
          payload: {
            settlementId: row.id,
            sessionId: row.sessionId,
            status: 'COMPLETED',
            paymentMethod: row.paymentMethod,
            completedAt: now.toISOString(),
          },
        }, tx);

        return completed;
      }

      const completed = await settlementRepository.updateSettlement(row.id, {
        status: 'COMPLETED',
        confirmedAt: now,
        completedAt: now,
        quotePayload: {
          ...(row.quotePayload as any || {}),
          requiredPoints: 0,
          availablePoints: 0,
          mode: 'manual',
        },
      }, tx);

      await settlementRepository.createOutbox({
        eventType: 'settlement.completed',
        aggregateType: 'session_settlement',
        aggregateId: row.id,
        payload: {
          settlementId: row.id,
          sessionId: row.sessionId,
          status: 'COMPLETED',
          paymentMethod: row.paymentMethod,
          completedAt: now.toISOString(),
        },
      }, tx);
      return completed;
    });
  },

  async confirmSettlement(id: string, memberId: string) {
    const row = await settlementRepository.findSettlement(id);
    if (!row || row.memberId !== memberId) throw new Error('Not found');
    if (row.paymentMethod === 'POINTS') {
      await this.prepareSettlementQuote(id, memberId);
    }
    return this.completeSettlement(id, memberId);
  },
};
