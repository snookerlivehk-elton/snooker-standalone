import express from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();
const router = express.Router();

async function requireMember(req: express.Request, res: express.Response) {
    const memberId = String(req.headers['x-member-id'] || '').trim();
    if (!memberId) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    const member = await prisma.member.findUnique({
        where: { id: memberId },
        select: { id: true, role: true }
    });
    if (!member) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    return member;
}

async function requireClubAdmin(req: express.Request, res: express.Response) {
    const member = await requireMember(req, res);
    if (!member) return null;
    if (member.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden' });
        return null;
    }
    return member;
}

// Get Club Profile (Public)
router.get('/:id/public', async (req, res) => {
    const { id } = req.params;
    try {
        // Try to find by ClubProfile.id first, then by Member.id (operator)
        // Since relations are manual now (relationMode="prisma"), include might work if schema is correct
        let club = await prisma.clubProfile.findUnique({
            where: { id },
            include: { member: { select: { name: true, email: true } } }
        });

        if (!club) {
             // Fallback: try to find by memberId
             club = await prisma.clubProfile.findUnique({
                 where: { memberId: id },
                 include: { member: { select: { name: true, email: true } } }
             });
        }

        if (!club) {
            return res.status(404).json({ error: 'Club not found' });
        }

        // Return public info
        res.json(club);
    } catch (error) {
        console.error('Error fetching club public profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get My Club Profile (Private - for Operator)
router.get('/my-profile', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const memberId = member.id;

    try {
        const club = await prisma.clubProfile.findUnique({
            where: { memberId },
        });
        res.json(club || {}); // Return empty object if not set yet
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Update/Create My Club Profile
router.post('/my-profile', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const memberId = member.id;
    
    const { name, intro, address, phone, email, logoUrl } = req.body;

    try {
        console.log(`[Club] Update profile request for member ${memberId}`, req.body);

        const club = await prisma.clubProfile.upsert({
            where: { memberId },
            update: { name, intro, address, phone, email, logoUrl },
            create: { memberId, name, intro, address, phone, email, logoUrl },
        });
        
        res.json(club);
    } catch (error) {
        console.error('[Club] Update error:', error);
        res.status(500).json({ error: String(error) });
    }
});

// Join Club
router.post('/join', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const { clubId } = req.body; // clubId is ClubProfile.id
    
    if (!clubId) return res.status(400).json({ error: 'Missing clubId' });

    try {
        // Check if already joined
        const existing = await prisma.clubMember.findUnique({
            where: {
                clubId_memberId: { clubId, memberId }
            }
        });
        
        if (existing) {
            return res.json({ message: 'Already joined', data: existing });
        }

        const joined = await prisma.clubMember.create({
            data: { clubId, memberId }
        });
        
        res.json(joined);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Get My Members (for Club)
router.get('/my-members', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const memberId = member.id;

    try {
        const club = await prisma.clubProfile.findUnique({ where: { memberId } });
        if (!club) return res.status(404).json({ error: 'Club profile not found' });

        const members = await prisma.clubMember.findMany({
            where: { clubId: club.id },
            include: { member: true } 
        });
        
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Get My Joined Clubs (for Member)
router.get('/joined', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;

    try {
        const joined = await prisma.clubMember.findMany({
            where: { memberId },
            include: { club: true }
        });
        res.json(joined);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Broadcast Message (Operator only)
router.post('/broadcast', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const memberId = member.id;
    const { title, content } = req.body;

    try {
        const club = await prisma.clubProfile.findUnique({ where: { memberId } });
        if (!club) return res.status(403).json({ error: 'Club profile not found' });

        const message = await prisma.clubMessage.create({
            data: {
                clubId: club.id,
                title,
                content
            }
        });
        res.json(message);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

// Get My Messages (Member)
router.get('/messages', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;

    try {
        const memberships = await prisma.clubMember.findMany({
            where: { memberId },
            select: { clubId: true }
        });
        
        const clubIds = memberships.map(m => m.clubId);
        
        if (clubIds.length === 0) return res.json([]);

        const messages = await prisma.clubMessage.findMany({
            where: { clubId: { in: clubIds } },
            orderBy: { createdAt: 'desc' },
            include: { club: { select: { name: true, logoUrl: true } } }
        });
        const msgIds = messages.map(m => m.id);
        let readRows: any[] = [];
        try {
            readRows = await prisma.$queryRawUnsafe(`SELECT "messageId" FROM "ClubMessageRead" WHERE "memberId"=$1`, memberId);
        } catch {}
        const readSet = new Set(readRows.map(r => String(r.messageId)));
        const withRead = messages.map(m => ({ ...m, read: readSet.has(m.id) }));
        res.json(withRead);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.get('/messages/:id', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const id = req.params.id;
    try {
        const message = await prisma.clubMessage.findUnique({
            where: { id },
            include: { club: { select: { name: true, logoUrl: true } } }
        });
        if (!message) return res.status(404).json({ error: 'Not found' });
        let read = false;
        try {
            const rows: any[] = await prisma.$queryRawUnsafe(
                `SELECT 1 FROM "ClubMessageRead" WHERE "memberId"=$1 AND "messageId"=$2 LIMIT 1`,
                memberId, id
            );
            read = rows.length > 0;
        } catch {}
        res.json({ ...message, read });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.post('/messages/:id/read', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const id = req.params.id;
    try {
        const mid = id;
        const rows: any[] = await prisma.$queryRawUnsafe(
            `SELECT 1 FROM "ClubMessageRead" WHERE "memberId"=$1 AND "messageId"=$2 LIMIT 1`,
            memberId, mid
        );
        if (rows.length === 0) {
            const rid = randomUUID();
            await prisma.$executeRawUnsafe(
                `INSERT INTO "ClubMessageRead"("id","memberId","messageId","readAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP)`,
                rid, memberId, mid
            );
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

async function getMyClubId(memberId: string) {
    const club = await prisma.clubProfile.findUnique({ where: { memberId } });
    return club?.id || null;
}

router.get('/tables/my', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const rows = await prisma.clubTable.findMany({ where: { clubId }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] });
    res.json(rows);
});

router.post('/tables', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const { name, notes, basePrice } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    const row = await prisma.clubTable.create({
        data: {
            clubId,
            name,
            notes: notes || null,
            basePrice: basePrice == null || basePrice === '' ? null : String(basePrice),
        }
    });
    res.json(row);
});

router.put('/tables/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = req.params.id;
    const t = await prisma.clubTable.findUnique({ where: { id } });
    if (!t || t.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
    const { name, active, displayOrder, notes, basePrice } = req.body;
    const row = await prisma.clubTable.update({
        where: { id },
        data: {
            ...(name === undefined ? {} : { name }),
            ...(active === undefined ? {} : { active }),
            ...(displayOrder === undefined ? {} : { displayOrder }),
            ...(notes === undefined ? {} : { notes }),
            ...(basePrice === undefined ? {} : { basePrice: basePrice == null || basePrice === '' ? null : String(basePrice) }),
        }
    });
    res.json(row);
});

router.delete('/tables/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = req.params.id;
    const t = await prisma.clubTable.findUnique({ where: { id } });
    if (!t || t.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
    const reservationCount = await prisma.tableReservation.count({ where: { tableId: id } });
    if (reservationCount > 0) return res.status(409).json({ error: '此球枱已有預約紀錄，請改用停用（取消啟用）' });
    const schemes = await prisma.tablePricingScheme.findMany({ where: { clubId, tableId: id }, select: { id: true } });
    if (schemes.length > 0) {
        const schemeIds = schemes.map(s => s.id);
        const schemeReservationCount = await prisma.tableReservation.count({ where: { pricingSchemeId: { in: schemeIds } } });
        if (schemeReservationCount > 0) return res.status(409).json({ error: '此球枱的方案已有預約紀錄，請先停用相關方案' });
    }
    await prisma.$transaction([
        prisma.tablePricingScheme.deleteMany({ where: { clubId, tableId: id } }),
        prisma.clubTable.delete({ where: { id } }),
    ]);
    res.json({ ok: true });
});

router.get('/pricing/my', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const rows = await prisma.tablePricingScheme.findMany({ where: { clubId }, orderBy: [{ title: 'asc' }] });
    res.json(rows);
});

router.post('/pricing', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const { title, description, rulesJson, active, price, tableId } = req.body;
    if (!title || rulesJson == null) return res.status(400).json({ error: 'Missing fields' });
    const row = await prisma.tablePricingScheme.create({
        data: {
            clubId,
            tableId: tableId || null,
            title,
            description: description || null,
            rulesJson,
            active: active ?? true,
            price: price == null || price === '' ? null : String(price),
        }
    });
    res.json(row);
});

router.put('/pricing/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = req.params.id;
    const p = await prisma.tablePricingScheme.findUnique({ where: { id } });
    if (!p || p.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
    const { title, description, rulesJson, active, price, tableId } = req.body;
    const row = await prisma.tablePricingScheme.update({
        where: { id },
        data: {
            ...(title === undefined ? {} : { title }),
            ...(description === undefined ? {} : { description }),
            ...(rulesJson === undefined ? {} : { rulesJson }),
            ...(active === undefined ? {} : { active }),
            ...(tableId === undefined ? {} : { tableId: tableId || null }),
            ...(price === undefined ? {} : { price: price == null || price === '' ? null : String(price) }),
        }
    });
    res.json(row);
});

router.delete('/pricing/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = req.params.id;
    const p = await prisma.tablePricingScheme.findUnique({ where: { id } });
    if (!p || p.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
    const reservationCount = await prisma.tableReservation.count({ where: { pricingSchemeId: id } });
    if (reservationCount > 0) return res.status(409).json({ error: '此方案已有預約紀錄，請改用停用（取消啟用）' });
    await prisma.tablePricingScheme.delete({ where: { id } });
    res.json({ ok: true });
});

router.get('/reservations/pending', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const rows = await prisma.tableReservation.findMany({
        where: { clubId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        include: { table: true, member: { select: { id: true, name: true, email: true } }, pricingScheme: true }
    });
    res.json(rows);
});

router.post('/reservations/:id/confirm', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = req.params.id;
    const r = await prisma.tableReservation.findUnique({ where: { id } });
    if (!r || r.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
    const overlap = await prisma.tableReservation.count({
        where: {
            tableId: r.tableId,
            status: 'CONFIRMED',
            AND: [{ startAt: { lt: r.endAt } }, { endAt: { gt: r.startAt } }],
            NOT: { id }
        }
    });
    if (overlap > 0) return res.status(409).json({ error: 'Time slot taken' });
    const updated = await prisma.tableReservation.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
    res.json(updated);
});

router.post('/reservations/:id/cancel', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = req.params.id;
    const r = await prisma.tableReservation.findUnique({ where: { id } });
    if (!r || r.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
    const { reason } = req.body || {};
    const updated = await prisma.tableReservation.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason || null } });
    res.json(updated);
});

router.get('/:clubId/tables', async (req, res) => {
    const { clubId } = req.params;
    const rows = await prisma.clubTable.findMany({ where: { clubId, active: true }, orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] });
    res.json(rows);
});

router.get('/:clubId/pricing', async (req, res) => {
    const { clubId } = req.params;
    const { tableId, startAt, endAt, quantityHours } = req.query as any;
    const where: any = { clubId, active: true };
    if (tableId) {
        where.OR = [{ tableId: null }, { tableId: String(tableId) }];
    }
    const rows = await prisma.tablePricingScheme.findMany({ where, orderBy: [{ title: 'asc' }] });
    const base = rows.map((r) => ({ ...r, effectivePricePerHour: r.price != null ? toFiniteNumber(r.price as any) : null }));
    if (!startAt) return res.json(base);
    const s = new Date(String(startAt));
    if (!Number.isFinite(s.getTime())) return res.status(400).json({ error: 'Invalid startAt' });
    const e = endAt
        ? new Date(String(endAt))
        : new Date(s.getTime() + (Math.max(1, Number(quantityHours || 1) || 1) * 60 * 60 * 1000));
    if (!Number.isFinite(e.getTime()) || !(e > s)) return res.status(400).json({ error: 'Invalid endAt' });
    const tid = tableId ? String(tableId) : null;
    const applicable = base
        .map((scheme) => {
            const ok = isSchemeApplicable(scheme as any, s, e, tid);
            if (!ok || !(ok as any).ok) return null;
            const rulePrice = (ok as any).pricePerHour != null ? toFiniteNumber((ok as any).pricePerHour) : null;
            const effective = rulePrice ?? scheme.effectivePricePerHour ?? null;
            return { ...scheme, effectivePricePerHour: effective };
        })
        .filter(Boolean);
    res.json(applicable);
});

router.get('/:clubId/availability', async (req, res) => {
    const { clubId } = req.params;
    const { from, to, tableId } = req.query as any;
    if (!from || !to) return res.status(400).json({ error: 'Missing from/to' });
    const start = new Date(String(from));
    const end = new Date(String(to));
    const where: any = { clubId, status: { in: ['PENDING', 'CONFIRMED'] }, AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }] };
    if (tableId) where.tableId = String(tableId);
    const rows = await prisma.tableReservation.findMany({ where, include: { table: true }, orderBy: { startAt: 'asc' } });
    res.json(rows);
});

function parseHHMM(hhmm: string) {
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
    return { h: h || 0, m: m || 0 };
}
function toFiniteNumber(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function normalizeRulesJson(rulesJson: any): any[] | null {
    if (Array.isArray(rulesJson)) return rulesJson;
    if (typeof rulesJson === 'string') {
        try {
            const parsed = JSON.parse(rulesJson);
            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).rules)) return (parsed as any).rules;
            return null;
        } catch {
            return null;
        }
    }
    if (rulesJson && typeof rulesJson === 'object' && Array.isArray((rulesJson as any).rules)) return (rulesJson as any).rules;
    return null;
}
function isSchemeApplicable(scheme: any, s: Date, e: Date, tableId?: string | null) {
    if (scheme.active !== true) return false;
    if (scheme.tableId && tableId && scheme.tableId !== tableId) return false;
    // Only support same-day windows for now
    if (s.toDateString() !== e.toDateString()) return false;
    try {
        const rules = normalizeRulesJson(scheme.rulesJson);
        if (rules == null) return false;
        if (rules.length === 0) return { ok: true, pricePerHour: null };
        const dow = ((s.getDay() + 6) % 7) + 1; // Make Monday=1 ... Sunday=7
        for (const r of rules) {
            const days: number[] = Array.isArray(r.daysOfWeek) ? r.daysOfWeek : [];
            if (days.length > 0 && !days.includes(dow)) continue;
            const { h: sh, m: sm } = parseHHMM(r.start || '00:00');
            const { h: eh, m: em } = parseHHMM(r.end || '23:59');
            const rs = new Date(s); rs.setHours(sh, sm, 0, 0);
            const re = new Date(s); re.setHours(eh, em, 0, 0);
            if (s >= rs && e <= re) {
                const pricePerHour = r.pricePerHour != null ? toFiniteNumber(r.pricePerHour) : null;
                return { ok: true, pricePerHour };
            }
        }
    } catch {}
    return false;
}

router.post('/:clubId/reservations', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const { clubId } = req.params;
    const { tableId, startAt, endAt, schemeId, quantityHours } = req.body || {};
    if (!tableId || !startAt) return res.status(400).json({ error: 'Missing fields' });
    const table = await prisma.clubTable.findUnique({ where: { id: String(tableId) } });
    if (!table || table.clubId !== clubId) return res.status(404).json({ error: 'Table not found' });
    const s = new Date(String(startAt));
    const e = endAt ? new Date(String(endAt)) : new Date(s.getTime() + (Number(quantityHours || 0) || 1) * 60 * 60 * 1000);
    if (!(e > s)) return res.status(400).json({ error: 'Invalid time range' });
    const overlap = await prisma.tableReservation.count({
        where: { tableId: table.id, status: { in: ['PENDING', 'CONFIRMED'] }, AND: [{ startAt: { lt: e } }, { endAt: { gt: s } }] }
    });
    if (overlap > 0) return res.status(409).json({ error: 'Time slot taken' });
    const data: any = { clubId, tableId: table.id, memberId, startAt: s, endAt: e, status: 'PENDING' };
    let unitPrice: number | null = null;
    if (schemeId) {
        const sid = String(schemeId);
        const scheme = await prisma.tablePricingScheme.findUnique({ where: { id: sid } });
        if (!scheme || scheme.clubId !== clubId) return res.status(400).json({ error: 'Pricing scheme not found' });
        const applicable = isSchemeApplicable(scheme as any, s, e, table.id);
        if (!applicable || !(applicable as any).ok) return res.status(400).json({ error: '方案不適用於此時段' });
        const rulePrice = (applicable as any).pricePerHour != null ? toFiniteNumber((applicable as any).pricePerHour) : null;
        const schemePrice = scheme.price != null ? toFiniteNumber(scheme.price as any) : null;
        unitPrice = rulePrice ?? schemePrice;
        if (unitPrice == null) return res.status(400).json({ error: '方案未設定價錢' });
        data.pricingSchemeId = sid;
    }
    if (unitPrice == null) {
        unitPrice = table.basePrice != null ? toFiniteNumber(table.basePrice as any) : null;
    }
    if (unitPrice == null) {
        return res.status(400).json({ error: 'No applicable scheme or base price set' });
    }
    const hours = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
    data.priceQuote = String(unitPrice * hours);
    const created = await prisma.tableReservation.create({ data });
    try {
        const messageTitle = '新預約待確認';
        const content = `會員 ${memberId} 預約 ${s.toISOString()} 至 ${e.toISOString()}`;
        await prisma.clubMessage.create({ data: { clubId, title: messageTitle, content } });
    } catch {}
    res.json(created);
});

router.get('/:clubId/reservations/my', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const { clubId } = req.params;
    const rows = await prisma.tableReservation.findMany({
        where: { clubId, memberId },
        include: { table: true, pricingScheme: true },
        orderBy: { startAt: 'desc' }
    });
    res.json(rows);
});

export default router;
