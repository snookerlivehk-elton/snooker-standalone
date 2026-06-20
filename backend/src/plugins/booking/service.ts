import {
  computeComboPlans,
  getSchemeMinHours,
  isSchemeApplicable,
  toFiniteNumber,
} from '../../core/booking/pricing.js';
import { buildWebAppUrl, sendEmailIfConfigured } from '../../core/notifications/email.js';
import { getBookingModuleSettings } from '../../core/modules/bookingSettings.js';
import { formatHongKongDateTime } from '../../core/live/utils.js';
import { bookingRepository } from './repository.js';

function normalizePriceValue(v: any) {
  return v == null || v === '' ? null : String(v);
}

function parseReservationWindow(startAt: any, endAt: any, quantityHours: any) {
  const s = new Date(String(startAt));
  const e = endAt
    ? new Date(String(endAt))
    : new Date(s.getTime() + (Number(quantityHours || 0) || 1) * 60 * 60 * 1000);
  return { s, e };
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolvePhone(value: any) {
  const e164 = String(value?.phone_e164 || '').trim();
  if (e164) return e164;
  const plain = String(value?.phone || '').trim();
  if (plain) return plain;
  const country = String(value?.phone_country || '').trim();
  const number = String(value?.phone_number || '').trim();
  const joined = [country, number].filter(Boolean).join(' ');
  return joined || '';
}

async function sendReservationNotificationEmail(
  type: 'created' | 'confirmed' | 'cancelled',
  reservationId: string,
  extra?: { cancelReason?: string | null },
) {
  const settings = await getBookingModuleSettings().catch(() => null);
  const enabled =
    type === 'created'
      ? settings?.reservationCreatedEmailEnabled
      : type === 'confirmed'
        ? settings?.reservationConfirmedEmailEnabled
        : settings?.reservationCancelledEmailEnabled;
  if (!enabled) return;

  const reservation = await bookingRepository.findReservationForNotification(reservationId);
  if (!reservation) return;

  const clubName = String(reservation.club?.name || '').trim() || '場館';
  const tableName = String(reservation.table?.name || '').trim() || '球枱';
  const memberName = String(reservation.member?.name || '').trim() || '會員';
  const memberCode = String((reservation.member as any)?.member_code || '').trim();
  const memberEmail = String(reservation.member?.email || '').trim();
  const memberPhone = resolvePhone(reservation.member);
  const clubPhone = String(reservation.club?.phone || '').trim() || resolvePhone(reservation.club?.member);
  const venueEmail = String(reservation.club?.email || '').trim() || String(reservation.club?.member?.email || '').trim();
  const pricingTitle = String(reservation.pricingScheme?.title || '').trim();
  const venueLoginUrl = buildWebAppUrl('/venue/login');
  const memberLoginUrl = buildWebAppUrl('/members/login');
  const reasonLine =
    type === 'cancelled' && extra?.cancelReason
      ? `<p><strong>取消原因：</strong>${escapeHtml(extra.cancelReason)}</p>`
      : '';

  if (type === 'created') {
    if (!venueEmail) return;
    await sendEmailIfConfigured({
      to: venueEmail,
      subject: `${clubName} 有新預約待確認`,
      html: [
        `<p>你收到一筆新的預約申請，請登入場館後台確認。</p>`,
        `<p><strong>場館：</strong>${escapeHtml(clubName)}</p>`,
        `<p><strong>會員：</strong>${escapeHtml([memberCode, memberName].filter(Boolean).join(' '))}</p>`,
        memberEmail ? `<p><strong>會員 Email：</strong>${escapeHtml(memberEmail)}</p>` : '',
        memberPhone ? `<p><strong>會員聯絡電話：</strong>${escapeHtml(memberPhone)}</p>` : '',
        `<p><strong>球枱：</strong>${escapeHtml(tableName)}</p>`,
        pricingTitle ? `<p><strong>方案：</strong>${escapeHtml(pricingTitle)}</p>` : '',
        `<p><strong>時段：</strong>${escapeHtml(formatHongKongDateTime(reservation.startAt))} 至 ${escapeHtml(formatHongKongDateTime(reservation.endAt))}</p>`,
        reservation.priceQuote != null ? `<p><strong>報價：</strong>${escapeHtml(String(reservation.priceQuote))}</p>` : '',
        `<p><a href="${escapeHtml(venueLoginUrl)}">登入場館後台處理預約</a></p>`,
      ].filter(Boolean).join(''),
    });
    return;
  }

  const email = memberEmail;
  if (!email) return;
  const subject =
    type === 'confirmed'
      ? `${clubName} 預約已確認`
      : `${clubName} 預約已取消`;
  const title =
    type === 'confirmed'
      ? '你的預約已確認'
      : '你的預約已取消';
  await sendEmailIfConfigured({
    to: email,
    subject,
    html: [
      `<p>${escapeHtml(memberName)}，你好。</p>`,
      `<p>${escapeHtml(title)}</p>`,
      `<p><strong>場館：</strong>${escapeHtml(clubName)}</p>`,
      `<p><strong>球枱：</strong>${escapeHtml(tableName)}</p>`,
      pricingTitle ? `<p><strong>方案：</strong>${escapeHtml(pricingTitle)}</p>` : '',
      `<p><strong>時段：</strong>${escapeHtml(formatHongKongDateTime(reservation.startAt))} 至 ${escapeHtml(formatHongKongDateTime(reservation.endAt))}</p>`,
      reservation.priceQuote != null ? `<p><strong>報價：</strong>${escapeHtml(String(reservation.priceQuote))}</p>` : '',
      clubPhone ? `<p><strong>場館聯絡電話：</strong>${escapeHtml(clubPhone)}</p>` : '',
      reasonLine,
      `<p><a href="${escapeHtml(memberLoginUrl)}">登入會員頁面查看預約</a></p>`,
    ].filter(Boolean).join(''),
  });
}

export const bookingService = {
  async createTable(clubId: string, payload: any) {
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('Missing name');
    return bookingRepository.createTable(clubId, {
      name,
      notes: payload.notes ? String(payload.notes) : null,
      basePrice: normalizePriceValue(payload.basePrice),
    });
  },

  async updateTable(clubId: string, id: string, payload: any) {
    const table = await bookingRepository.findTable(id);
    if (!table || table.clubId !== clubId) throw new Error('Not found');
    return bookingRepository.updateTable(id, {
      ...(payload.name === undefined ? {} : { name: payload.name }),
      ...(payload.active === undefined ? {} : { active: payload.active }),
      ...(payload.displayOrder === undefined ? {} : { displayOrder: payload.displayOrder }),
      ...(payload.notes === undefined ? {} : { notes: payload.notes }),
      ...(payload.basePrice === undefined ? {} : { basePrice: normalizePriceValue(payload.basePrice) }),
    });
  },

  async deleteTable(clubId: string, id: string) {
    const table = await bookingRepository.findTable(id);
    if (!table || table.clubId !== clubId) throw new Error('Not found');
    const reservationCount = await bookingRepository.countReservationsByTable(id);
    if (reservationCount > 0) throw new Error('此球枱已有預約紀錄，請改用停用（取消啟用）');
    const schemes = await bookingRepository.listPricingSchemeIdsByTable(clubId, id);
    if (schemes.length > 0) {
      const schemeReservationCount = await bookingRepository.countReservationsByPricingSchemeIds(schemes.map((s) => s.id));
      if (schemeReservationCount > 0) throw new Error('此球枱的方案已有預約紀錄，請先停用相關方案');
    }
    await bookingRepository.deleteTableAndSchemes(clubId, id);
    return { ok: true };
  },

  listPricing(clubId: string) {
    return bookingRepository.listPricing(clubId);
  },

  async createPricing(clubId: string, payload: any) {
    const title = String(payload.title || '').trim();
    if (!title || payload.rulesJson == null) throw new Error('Missing fields');
    return bookingRepository.createPricing(clubId, {
      tableId: payload.tableId || null,
      title,
      description: payload.description || null,
      rulesJson: payload.rulesJson,
      active: payload.active ?? true,
      price: normalizePriceValue(payload.price),
    });
  },

  async updatePricing(clubId: string, id: string, payload: any) {
    const pricing = await bookingRepository.findPricing(id);
    if (!pricing || pricing.clubId !== clubId) throw new Error('Not found');
    return bookingRepository.updatePricing(id, {
      ...(payload.title === undefined ? {} : { title: payload.title }),
      ...(payload.description === undefined ? {} : { description: payload.description }),
      ...(payload.rulesJson === undefined ? {} : { rulesJson: payload.rulesJson }),
      ...(payload.active === undefined ? {} : { active: payload.active }),
      ...(payload.tableId === undefined ? {} : { tableId: payload.tableId || null }),
      ...(payload.price === undefined ? {} : { price: normalizePriceValue(payload.price) }),
    });
  },

  async deletePricing(clubId: string, id: string) {
    const pricing = await bookingRepository.findPricing(id);
    if (!pricing || pricing.clubId !== clubId) throw new Error('Not found');
    const reservationCount = await bookingRepository.countReservationsByPricingScheme(id);
    if (reservationCount > 0) throw new Error('此方案已有預約紀錄，請改用停用（取消啟用）');
    await bookingRepository.deletePricing(id);
    return { ok: true };
  },

  listReservations(clubId: string, status?: string) {
    return bookingRepository.listReservations(clubId, status);
  },

  listPendingReservations(clubId: string) {
    return bookingRepository.listPendingReservations(clubId);
  },

  async confirmReservation(clubId: string, id: string) {
    const reservation = await bookingRepository.findReservation(id);
    if (!reservation || reservation.clubId !== clubId) throw new Error('Not found');
    const overlap = await bookingRepository.countOverlappingReservations(
      reservation.tableId,
      reservation.startAt,
      reservation.endAt,
      id,
    );
    if (overlap > 0) throw new Error('Time slot taken');
    const updated = await bookingRepository.confirmReservation(id);
    try {
      await sendReservationNotificationEmail('confirmed', updated.id);
    } catch (e) {
      console.warn('Failed to send booking confirmation email:', e);
    }
    return updated;
  },

  async cancelReservation(clubId: string, id: string, reason: any) {
    const reservation = await bookingRepository.findReservation(id);
    if (!reservation || reservation.clubId !== clubId) throw new Error('Not found');
    const cancelReason = reason ? String(reason) : null;
    const updated = await bookingRepository.cancelReservation(id, cancelReason);
    try {
      await sendReservationNotificationEmail('cancelled', updated.id, { cancelReason });
    } catch (e) {
      console.warn('Failed to send booking cancellation email:', e);
    }
    return updated;
  },

  listPublicTables(clubId: string) {
    return bookingRepository.listPublicTables(clubId);
  },

  async listPublicPricing(clubId: string, query: any) {
    const tableId = query.tableId ? String(query.tableId) : null;
    const rows = await bookingRepository.listApplicablePricing(clubId, tableId);
    const base = rows.map((r) => ({
      ...r,
      minHours: getSchemeMinHours((r as any).rulesJson),
      effectivePricePerHour: r.price != null ? toFiniteNumber(r.price as any) : null,
    }));
    if (!query.startAt) return base;

    const s = new Date(String(query.startAt));
    if (!Number.isFinite(s.getTime())) throw new Error('Invalid startAt');
    const e = query.endAt
      ? new Date(String(query.endAt))
      : new Date(s.getTime() + (Math.max(1, Number(query.quantityHours || 1) || 1) * 60 * 60 * 1000));
    if (!Number.isFinite(e.getTime()) || !(e > s)) throw new Error('Invalid endAt');
    const requestedHours = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
    const applicable = base
      .map((scheme) => {
        if (scheme.minHours != null && requestedHours + 1e-9 < Number(scheme.minHours)) return null;
        const ok = isSchemeApplicable(scheme as any, s, e, tableId);
        if (!ok || !(ok as any).ok) return null;
        const rulePrice = (ok as any).pricePerHour != null ? toFiniteNumber((ok as any).pricePerHour) : null;
        const effective = rulePrice ?? scheme.effectivePricePerHour ?? null;
        return { ...scheme, effectivePricePerHour: effective };
      })
      .filter(Boolean);
    const combos = computeComboPlans(s, e, base as any[], tableId);
    return [ ...(applicable as any[]), ...(combos as any[]) ];
  },

  async listAvailability(clubId: string, query: any) {
    if (!query.from || !query.to) throw new Error('Missing from/to');
    const start = new Date(String(query.from));
    const end = new Date(String(query.to));
    return bookingRepository.listAvailability(clubId, start, end, query.tableId ? String(query.tableId) : undefined);
  },

  async createManualReservation(clubId: string, actorMemberId: string, payload: any) {
    const tableId = String(payload.tableId || '').trim();
    if (!tableId || !payload.startAt) throw new Error('Missing fields');
    const table = await bookingRepository.findTable(tableId);
    if (!table || table.clubId !== clubId) throw new Error('Table not found');
    const { s, e } = parseReservationWindow(payload.startAt, payload.endAt, payload.quantityHours);
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || !(e > s)) throw new Error('Invalid time range');
    if (e.getTime() < Date.now() - 60_000) throw new Error('不能建立已結束的時段');
    const normalizedMode = String(payload.mode || 'BLOCK').toUpperCase();
    const isBlock = normalizedMode === 'BLOCK';
    const targetMemberId = isBlock ? actorMemberId : String(payload.memberId || '').trim();
    if (!targetMemberId) throw new Error('memberId required');
    const overlap = await bookingRepository.countOverlappingReservations(table.id, s, e);
    if (overlap > 0) throw new Error('該時段已被預約/封鎖，請選擇其他時間');
    return bookingRepository.createReservation({
      clubId,
      tableId: table.id,
      memberId: targetMemberId,
      startAt: s,
      endAt: e,
      status: isBlock ? 'BLOCKED' : 'CONFIRMED',
      confirmedAt: new Date(),
    });
  },

  async createMemberReservation(clubId: string, memberId: string, payload: any) {
    const tableId = String(payload.tableId || '').trim();
    if (!tableId || !payload.startAt) throw new Error('Missing fields');
    const table = await bookingRepository.findTable(tableId);
    if (!table || table.clubId !== clubId) throw new Error('Table not found');

    const { s, e } = parseReservationWindow(payload.startAt, payload.endAt, payload.quantityHours);
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) throw new Error('Invalid time range');
    if (s.getTime() < Date.now() - 60_000) throw new Error('不能預約已過去的時間');
    if (!(e > s)) throw new Error('Invalid time range');

    const overlap = await bookingRepository.countOverlappingReservations(table.id, s, e);
    if (overlap > 0) throw new Error('該時段已被預約，請選擇其他時間');

    const data: any = { clubId, tableId: table.id, memberId, startAt: s, endAt: e, status: 'PENDING' };
    let unitPrice: number | null = null;
    let schemeMinHours: number | null = null;
    const schemeId = payload.schemeId == null ? '' : String(payload.schemeId);

    if (schemeId) {
      if (/^combo:/i.test(schemeId)) {
        const raw = schemeId.split(':', 2)[1] || '';
        const parts = raw.split('+').map((x) => x.trim()).filter(Boolean);
        const unique = Array.from(new Set(parts));
        if (unique.length < 2) throw new Error('Invalid combo scheme');
        const schemes = await bookingRepository.findPricingSchemes(unique);
        if (schemes.length !== unique.length) throw new Error('Pricing scheme not found');
        if (schemes.some((sc) => sc.clubId !== clubId || sc.active !== true)) throw new Error('方案不適用於此時段');
        const canonical = unique.slice().sort().join('+');
        const plans = computeComboPlans(s, e, schemes as any[], table.id);
        const chosen = (plans as any[]).find((p) => String(p?.id || '') === `combo:${canonical}`);
        const hours = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
        const avg = chosen?.effectivePricePerHour != null ? toFiniteNumber(chosen.effectivePricePerHour) : null;
        unitPrice = avg;
        if (unitPrice == null || !(hours > 0)) throw new Error('方案不適用於此時段');
      } else {
        const scheme = await bookingRepository.findPricing(schemeId);
        if (!scheme || scheme.clubId !== clubId) throw new Error('Pricing scheme not found');
        const applicable = isSchemeApplicable(scheme as any, s, e, table.id);
        if (!applicable || !(applicable as any).ok) throw new Error('方案不適用於此時段');
        schemeMinHours = getSchemeMinHours((scheme as any).rulesJson);
        const rulePrice = (applicable as any).pricePerHour != null ? toFiniteNumber((applicable as any).pricePerHour) : null;
        const schemePrice = scheme.price != null ? toFiniteNumber(scheme.price as any) : null;
        unitPrice = rulePrice ?? schemePrice;
        if (unitPrice == null) throw new Error('方案未設定價錢');
        data.pricingSchemeId = schemeId;
      }
    }

    if (unitPrice == null) unitPrice = table.basePrice != null ? toFiniteNumber(table.basePrice as any) : null;
    if (unitPrice == null) throw new Error('No applicable scheme or base price set');

    const hours = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
    if (schemeMinHours != null && hours + 1e-9 < schemeMinHours) throw new Error(`此方案需最少購買 ${schemeMinHours} 小時`);
    data.priceQuote = String(unitPrice * hours);

    const created = await bookingRepository.createReservation(data);
    try {
      const m = await bookingRepository.findMemberBasic(memberId);
      const memberName = String(m?.name || '').trim();
      const memberCode = String(m?.member_code || '').trim();
      const who = [memberCode || '無', memberName].filter(Boolean).join(' ');
      const tableName = String((table as any)?.name || '').trim() || '球枱';
      const content = `會員：${who}\n球枱：${tableName}\n時段：${formatHongKongDateTime(s)} 至 ${formatHongKongDateTime(e)}`;
      await bookingRepository.createClubMessage(clubId, '新預約待確認', content);
    } catch {}
    try {
      await sendReservationNotificationEmail('created', created.id);
    } catch (e) {
      console.warn('Failed to send booking created email:', e);
    }
    return created;
  },

  listMyReservations(clubId: string, memberId: string) {
    return bookingRepository.listMyReservations(clubId, memberId);
  },

  async cancelMyReservation(clubId: string, memberId: string, reservationId: string, reason: any) {
    const reservation = await bookingRepository.findReservation(reservationId);
    if (!reservation || reservation.clubId !== clubId || reservation.memberId !== memberId) throw new Error('Not found');
    const cancelReason = reason ? String(reason) : null;
    const updated = await bookingRepository.cancelReservation(reservationId, cancelReason);
    try {
      await sendReservationNotificationEmail('cancelled', updated.id, { cancelReason });
    } catch (e) {
      console.warn('Failed to send booking self-cancellation email:', e);
    }
    return updated;
  },
};
