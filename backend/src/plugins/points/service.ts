import { getClubFeatureAssignments } from '../../../clubFeatureAccess.js';
import { prisma } from '../../core/db/prisma.js';
import { pointsRepository } from './repository.js';

export const pointsService = {
  async getConfigOrDefault(clubId: string) {
    return (
      await pointsRepository.getConfig(clubId)
    ) || { clubId, currencyCode: 'HKD', pointsPerCurrency: '1', roundingMinutes: 15, minBillableMinutes: 0 };
  },

  async saveConfig(clubId: string, payload: any) {
    const currencyCode = String(payload.currencyCode || 'HKD').trim().toUpperCase();
    const pointsPerCurrencyRaw = payload.pointsPerCurrency;
    const roundingMinutesRaw = payload.roundingMinutes;
    const minBillableMinutesRaw = payload.minBillableMinutes;

    if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('currencyCode invalid');
    const ppc = Number(pointsPerCurrencyRaw);
    if (!Number.isFinite(ppc) || ppc <= 0) throw new Error('pointsPerCurrency invalid');
    const roundingMinutes = Math.floor(Number(roundingMinutesRaw));
    if (!Number.isFinite(roundingMinutes) || roundingMinutes < 1 || roundingMinutes > 180) throw new Error('roundingMinutes invalid');
    const minBillableMinutes = Math.floor(Number(minBillableMinutesRaw));
    if (!Number.isFinite(minBillableMinutes) || minBillableMinutes < 0 || minBillableMinutes > 720) {
      throw new Error('minBillableMinutes invalid');
    }

    const existing = await pointsRepository.getConfigId(clubId);
    return pointsRepository.upsertConfig(clubId, existing?.id, {
      currencyCode,
      pointsPerCurrency: String(ppc),
      roundingMinutes,
      minBillableMinutes,
    });
  },

  async listBalances(clubId: string) {
    const memberships = await pointsRepository.listClubMemberships(clubId);
    const ids = memberships.map((m: any) => m.memberId);
    const balances = await pointsRepository.listBalances(clubId, ids);
    const map = new Map(balances.map((b) => [b.memberId, b]));
    return memberships.map((m: any) => {
      const b = map.get(m.memberId);
      return {
        member: m.member,
        memberId: m.memberId,
        balance: b?.balance ?? 0,
        updatedAt: b?.updatedAt ?? null,
      };
    });
  },

  async searchBalances(clubId: string, q: string, limit: number) {
    const memberships = await pointsRepository.searchClubMemberships(clubId, q, limit);
    const ids = memberships.map((m: any) => m.memberId);
    const balances = await pointsRepository.listBalances(clubId, ids);
    const map = new Map(balances.map((b) => [b.memberId, b]));
    return memberships.map((m: any) => {
      const b = map.get(m.memberId);
      return {
        member: m.member,
        memberId: m.memberId,
        balance: b?.balance ?? 0,
        updatedAt: b?.updatedAt ?? null,
      };
    });
  },

  async getMyBalance(clubId: string, memberId: string) {
    const membership = await pointsRepository.findClubMembership(clubId, memberId);
    if (!membership) throw new Error('Not in club');
    const bal = await pointsRepository.getBalance(clubId, memberId);
    return { clubId, memberId, balance: bal?.balance ?? 0, updatedAt: bal?.updatedAt ?? null };
  },

  async listMyBalances(memberId: string) {
    const memberships = await pointsRepository.listMemberClubMemberships(memberId);
    const clubIds = memberships.map((m) => m.clubId);
    const assignments = clubIds.length === 0 ? {} : await getClubFeatureAssignments(prisma, clubIds, 'points');
    const enabledClubIds = clubIds.filter((clubId) => assignments[clubId]?.assignedEnabled);
    const rows = await pointsRepository.listMemberBalances(memberId, enabledClubIds);
    const map = new Map(rows.map((r) => [r.clubId, r]));
    return enabledClubIds.map((clubId) => {
      const r = map.get(clubId);
      return { clubId, balance: r?.balance ?? 0, updatedAt: r?.updatedAt ?? null };
    });
  },

  buildLedgerWhere(clubId: string, query: any) {
    const memberId = query.memberId == null ? '' : String(query.memberId).trim();
    const fromRaw = query.from == null ? '' : String(query.from).trim();
    const toRaw = query.to == null ? '' : String(query.to).trim();
    const monthRaw = query.month == null ? '' : String(query.month).trim();
    const where: any = { clubId };
    if (memberId) where.memberId = memberId;

    let from: Date | null = null;
    let to: Date | null = null;
    if (monthRaw && /^\d{4}-\d{2}$/.test(monthRaw)) {
      const y = Number(monthRaw.slice(0, 4));
      const m = Number(monthRaw.slice(5, 7));
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
        to = new Date(Date.UTC(y, m, 1, 0, 0, 0));
      }
    }
    if (!from && fromRaw) {
      const d = new Date(fromRaw);
      if (Number.isFinite(d.getTime())) from = d;
    }
    if (!to && toRaw) {
      const d = new Date(toRaw);
      if (Number.isFinite(d.getTime())) to = d;
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }
    return where;
  },

  async getLedger(clubId: string, query: any) {
    const limitRaw = query.limit == null ? '' : String(query.limit);
    const limit = Math.min(200, Math.max(1, Number(limitRaw || 50) || 50));
    const groupBy = query.groupBy == null ? '' : String(query.groupBy).trim();
    const includeTotal = String(query.includeTotal || '').trim() === '1';
    const where = this.buildLedgerWhere(clubId, query);

    if (groupBy === 'month') {
      const rows = await pointsRepository.listLedgerForMonthGrouping(where);
      const map = new Map<string, { month: string; sumDelta: number; count: number }>();
      for (const r of rows) {
        const d = r.createdAt instanceof Date ? r.createdAt : new Date(String((r as any).createdAt));
        if (!Number.isFinite(d.getTime())) continue;
        const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const cur = map.get(month) || { month, sumDelta: 0, count: 0 };
        cur.sumDelta += Number(r.deltaPoints || 0);
        cur.count += 1;
        map.set(month, cur);
      }
      return Array.from(map.values()).sort((a, b) => (a.month < b.month ? 1 : -1));
    }

    const [rows, agg] = await Promise.all([
      pointsRepository.listLedger(where, limit),
      includeTotal ? pointsRepository.aggregateLedgerTotal(where) : Promise.resolve(null as any),
    ]);

    if (includeTotal) return { rows, totalDelta: agg?._sum?.deltaPoints ?? 0 };
    return rows;
  },

  async adjustBalance(clubId: string, createdByMemberId: string, payload: any) {
    const targetMemberId = String(payload.memberId || '').trim();
    const delta = Math.floor(Number(payload.deltaPoints));
    const reason = String(payload.reason || '').trim();
    if (!targetMemberId) throw new Error('memberId required');
    if (!Number.isFinite(delta) || delta === 0) throw new Error('deltaPoints invalid');
    if (!reason) throw new Error('reason required');
    const membership = await pointsRepository.findClubMembership(clubId, targetMemberId);
    if (!membership) throw new Error('Member not in club');
    const result = await pointsRepository.adjustBalance(clubId, targetMemberId, delta, reason, createdByMemberId);
    return { ok: true, memberId: targetMemberId, deltaPoints: delta, balance: result.balance, updatedAt: result.updatedAt };
  },
};
