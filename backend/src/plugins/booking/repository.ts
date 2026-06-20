import { prisma } from '../../core/db/prisma.js';

const reservationInclude = {
  table: true,
  member: { select: { id: true, name: true, email: true } },
  pricingScheme: true,
} as const;

const reservationNotificationInclude = {
  club: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      member: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phone_country: true,
          phone_number: true,
          phone_e164: true,
        },
      },
    },
  },
  table: { select: { id: true, name: true } },
  member: {
    select: {
      id: true,
      name: true,
      email: true,
      member_code: true,
      phone: true,
      phone_country: true,
      phone_number: true,
      phone_e164: true,
    },
  },
  pricingScheme: { select: { id: true, title: true } },
} as const;

export const bookingRepository = {
  createTable(clubId: string, data: { name: string; notes: string | null; basePrice: string | null }) {
    return prisma.clubTable.create({ data: { clubId, ...data } });
  },

  findTable(id: string) {
    return prisma.clubTable.findUnique({ where: { id } });
  },

  updateTable(id: string, data: any) {
    return prisma.clubTable.update({ where: { id }, data });
  },

  countReservationsByTable(tableId: string) {
    return prisma.tableReservation.count({ where: { tableId } });
  },

  listPricingSchemeIdsByTable(clubId: string, tableId: string) {
    return prisma.tablePricingScheme.findMany({ where: { clubId, tableId }, select: { id: true } });
  },

  countReservationsByPricingSchemeIds(ids: string[]) {
    if (ids.length === 0) return Promise.resolve(0);
    return prisma.tableReservation.count({ where: { pricingSchemeId: { in: ids } } });
  },

  deleteTableAndSchemes(clubId: string, tableId: string) {
    return prisma.$transaction([
      prisma.tablePricingScheme.deleteMany({ where: { clubId, tableId } }),
      prisma.clubTable.delete({ where: { id: tableId } }),
    ]);
  },

  listPricing(clubId: string) {
    return prisma.tablePricingScheme.findMany({ where: { clubId }, orderBy: [{ title: 'asc' }] });
  },

  createPricing(clubId: string, data: any) {
    return prisma.tablePricingScheme.create({ data: { clubId, ...data } });
  },

  findPricing(id: string) {
    return prisma.tablePricingScheme.findUnique({ where: { id } });
  },

  updatePricing(id: string, data: any) {
    return prisma.tablePricingScheme.update({ where: { id }, data });
  },

  countReservationsByPricingScheme(id: string) {
    return prisma.tableReservation.count({ where: { pricingSchemeId: id } });
  },

  deletePricing(id: string) {
    return prisma.tablePricingScheme.delete({ where: { id } });
  },

  listReservations(clubId: string, status?: string) {
    const where: any = { clubId };
    if (status) where.status = status;
    return prisma.tableReservation.findMany({
      where,
      orderBy: { startAt: 'desc' },
      include: reservationInclude,
    });
  },

  listPendingReservations(clubId: string) {
    return prisma.tableReservation.findMany({
      where: { clubId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: reservationInclude,
    });
  },

  findReservation(id: string) {
    return prisma.tableReservation.findUnique({ where: { id } });
  },

  findReservationForNotification(id: string) {
    return prisma.tableReservation.findUnique({
      where: { id },
      include: reservationNotificationInclude,
    });
  },

  countOverlappingReservations(tableId: string, startAt: Date, endAt: Date, excludeId?: string) {
    const where: any = {
      tableId,
      status: { in: ['PENDING', 'CONFIRMED', 'BLOCKED'] },
      AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
    };
    if (excludeId) where.NOT = { id: excludeId };
    return prisma.tableReservation.count({ where });
  },

  confirmReservation(id: string) {
    return prisma.tableReservation.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
  },

  cancelReservation(id: string, reason: string | null) {
    return prisma.tableReservation.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
    });
  },

  listPublicTables(clubId: string) {
    return prisma.clubTable.findMany({ where: { clubId, active: true }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] });
  },

  listApplicablePricing(clubId: string, tableId?: string | null) {
    const where: any = { clubId, active: true };
    if (tableId) where.OR = [{ tableId: null }, { tableId }];
    return prisma.tablePricingScheme.findMany({ where, orderBy: [{ title: 'asc' }] });
  },

  listAvailability(clubId: string, startAt: Date, endAt: Date, tableId?: string) {
    const where: any = {
      clubId,
      status: { in: ['PENDING', 'CONFIRMED', 'BLOCKED'] },
      AND: [{ startAt: { lt: endAt } }, { endAt: { gt: startAt } }],
    };
    if (tableId) where.tableId = tableId;
    return prisma.tableReservation.findMany({ where, include: { table: true }, orderBy: { startAt: 'asc' } });
  },

  createReservation(data: any) {
    return prisma.tableReservation.create({ data });
  },

  findPricingSchemes(ids: string[]) {
    return prisma.tablePricingScheme.findMany({ where: { id: { in: ids } } });
  },

  findMemberBasic(memberId: string) {
    return prisma.member.findUnique({ where: { id: memberId }, select: { name: true, member_code: true } });
  },

  createClubMessage(clubId: string, title: string, content: string) {
    return prisma.clubMessage.create({ data: { clubId, title, content } });
  },

  listMyReservations(clubId: string, memberId: string) {
    return prisma.tableReservation.findMany({
      where: { clubId, memberId },
      include: { table: true, pricingScheme: true },
      orderBy: { startAt: 'desc' },
    });
  },
};
