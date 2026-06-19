import { randomUUID } from 'crypto';
import { getClubFeatureAssignment } from '../../../clubFeatureAccess.js';
import { prisma } from '../../core/db/prisma.js';
import { isFeatureEnabled } from '../../core/features/featureAccess.js';
import { calcBilledMinutes, calcChargedAmount, calcChargedPoints } from '../../core/qr-session/billing.js';
import { qrSessionRepository } from './repository.js';
import { settlementService } from '../settlement/service.js';

export const qrSessionService = {
  async listTablesWithQr(clubId: string) {
    let rows = await qrSessionRepository.listTablesWithQr(clubId);
    await qrSessionRepository.ensureQrTokens(clubId, rows);
    rows = await qrSessionRepository.listTablesWithQr(clubId);
    return rows;
  },

  async rotateTableQr(clubId: string, tableId: string) {
    const table = await qrSessionRepository.findTable(tableId);
    if (!table || table.clubId !== clubId) throw new Error('Not found');
    return qrSessionRepository.rotateQrToken(clubId, tableId, randomUUID());
  },

  listActiveSessions(clubId: string) {
    return qrSessionRepository.listActiveSessions(clubId);
  },

  async endSessionByOperator(clubId: string, operatorId: string, sessionId: string) {
    const now = new Date();
    const pointsGlobalEnabled = await isFeatureEnabled('points');
    const result = await qrSessionRepository.endSessionByOperator(
      clubId,
      sessionId,
      operatorId,
      now,
      getClubFeatureAssignment,
      ({ session, cfg, featurePoints }) => {
        const enablePoints = pointsGlobalEnabled && featurePoints;
        const billedMinutes = calcBilledMinutes(session.startAt, now, cfg);
        const amount = calcChargedAmount(session.table.basePrice, billedMinutes);
        return {
          billedMinutes,
          amount,
          currency: String(cfg?.currencyCode || 'HKD'),
          chargedPoints: enablePoints ? calcChargedPoints(amount, cfg) : 0,
          enablePoints,
        } as any;
      },
    );
    if (result.settlement.paymentMethod === 'POINTS') {
      const settlement = await settlementService.completeSettlement(result.settlement.id, operatorId);
      const session = await qrSessionRepository.getSessionById(result.session.id);
      return { ...(session || result.session), settlement };
    }
    return { ...result.session, settlement: result.settlement };
  },

  async getTableInfo(memberId: string, token: string) {
    const qr = await qrSessionRepository.findQrByToken(token);
    if (!qr || qr.active === false) throw new Error('Not found');
    const qrAssignment = await getClubFeatureAssignment(prisma, qr.clubId, 'qr_session').catch(() => null);
    if (!qrAssignment?.assignedEnabled) throw new Error(`feature_disabled:${qr.clubId}`);
    if (qr.table.active === false) throw new Error('Table disabled');
    const session = await qrSessionRepository.findActiveSessionForMember(qr.tableId, memberId);
    return { club: qr.club, table: qr.table, session };
  },

  async startInit(memberId: string, token: string, getFeatureMap: () => Promise<Record<string, boolean>>) {
    const qr = await qrSessionRepository.findQrByToken(token);
    if (!qr || qr.active === false) throw new Error('Not found');
    const qrAssignment = await getClubFeatureAssignment(prisma, qr.clubId, 'qr_session').catch(() => null);
    if (!qrAssignment?.assignedEnabled) throw new Error(`feature_disabled:${qr.clubId}`);
    if (qr.table.active === false) throw new Error('Table disabled');
    const active = await qrSessionRepository.findAnyActiveSession(qr.tableId);
    if (active) throw new Error('already_active');
    const cfg = await qrSessionRepository.getPointsConfig(qr.clubId);
    const pointsAssignment = await getClubFeatureAssignment(prisma, qr.clubId, 'points').catch(() => null);
    const pointsEnabled = (await getFeatureMap()).points !== false && !!pointsAssignment?.assignedEnabled;
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const confirm = await qrSessionRepository.createSessionConfirm({
      action: 'START',
      token,
      clubId: qr.clubId,
      tableId: qr.tableId,
      memberId,
      expiresAt,
    });
    return {
      confirmId: confirm.id,
      expiresAt,
      club: qr.club,
      table: qr.table,
      pointsConfig: pointsEnabled && cfg
        ? {
            currencyCode: cfg.currencyCode,
            pointsPerCurrency: String(cfg.pointsPerCurrency),
            roundingMinutes: cfg.roundingMinutes,
            minBillableMinutes: cfg.minBillableMinutes,
          }
        : null,
    };
  },

  confirmStart(memberId: string, confirmId: string) {
    return qrSessionRepository.confirmStart(confirmId, memberId, new Date(), getClubFeatureAssignment);
  },

  async endInit(memberId: string, token: string, getFeatureMap: () => Promise<Record<string, boolean>>) {
    const qr = await qrSessionRepository.findQrByToken(token);
    if (!qr || qr.active === false) throw new Error('Not found');
    const qrAssignment = await getClubFeatureAssignment(prisma, qr.clubId, 'qr_session').catch(() => null);
    if (!qrAssignment?.assignedEnabled) throw new Error(`feature_disabled:${qr.clubId}`);
    const session = await qrSessionRepository.findActiveSessionForMember(qr.tableId, memberId);
    if (!session) throw new Error('no_active_session');
    const cfg = await qrSessionRepository.getPointsConfig(qr.clubId);
    const pointsAssignment = await getClubFeatureAssignment(prisma, qr.clubId, 'points').catch(() => null);
    const pointsEnabled = (await getFeatureMap()).points !== false && !!pointsAssignment?.assignedEnabled;
    const now = new Date();
    const billedMinutes = calcBilledMinutes(session.startAt, now, cfg);
    const amount = calcChargedAmount(qr.table.basePrice, billedMinutes);
    const chargedPoints = pointsEnabled ? calcChargedPoints(amount, cfg) : 0;
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
    const confirm = await qrSessionRepository.createSessionConfirm({
      action: 'END',
      token,
      clubId: qr.clubId,
      tableId: qr.tableId,
      memberId,
      sessionId: session.id,
      expiresAt,
    });
    return {
      confirmId: confirm.id,
      expiresAt,
      club: qr.club,
      table: qr.table,
      session,
      preview: {
        billedMinutes,
        chargedAmount: amount,
        chargedCurrency: String(cfg?.currencyCode || 'HKD'),
        chargedPoints,
      },
    };
  },

  async confirmEnd(memberId: string, confirmId: string, featureMap: Record<string, boolean>) {
    const now = new Date();
    const result = await qrSessionRepository.confirmEnd(
      confirmId,
      memberId,
      now,
      featureMap,
      getClubFeatureAssignment,
      ({ session, cfg, enablePoints }) => {
        const billedMinutes = calcBilledMinutes(session.startAt, now, cfg);
        const amount = calcChargedAmount(session.table.basePrice, billedMinutes);
        return {
          billedMinutes,
          amount,
          currency: String(cfg?.currencyCode || 'HKD'),
          chargedPoints: enablePoints ? calcChargedPoints(amount, cfg) : 0,
        };
      },
    );
    if (result.settlement.paymentMethod === 'POINTS') {
      const settlement = await settlementService.prepareSettlementQuote(result.settlement.id, memberId);
      const session = await qrSessionRepository.getSessionById(result.session.id);
      return { ...(session || result.session), settlement, requiresSettlementConfirmation: true };
    }
    return { ...result.session, settlement: result.settlement };
  },
};
