import express from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getClubFeatureAssignment, getClubFeatureAssignments } from '../clubFeatureAccess.js';

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
        select: { id: true, role: true, is_enabled: true, access_expires_at: true }
    });
    if (!member) {
        res.status(401).json({ error: 'Unauthorized' });
        return null;
    }
    if (member.is_enabled === false) {
        res.status(403).json({ error: 'Disabled' });
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
    if (member.access_expires_at && new Date(member.access_expires_at).getTime() < Date.now()) {
        res.status(403).json({ error: 'Expired' });
        return null;
    }
    return member;
}

const FEATURE_DEFAULTS: Record<string, boolean> = {
    booking: true,
    qr_session: true,
    points: true,
    highbreak: true,
    tournaments: true,
    club_messages: true,
    club_dashboard: true,
    system_portal: true,
    member_portal: true,
    scoring: true,
    live: true,
};

async function isFeatureEnabled(key: string): Promise<boolean> {
    try {
        const row = await prisma.featureFlag.findUnique({ where: { key }, select: { enabled: true } });
        if (row) return row.enabled;
    } catch {}
    return FEATURE_DEFAULTS[key] ?? true;
}

async function isClubFeatureEnabled(clubId: string, key: 'points'): Promise<boolean> {
    const globalEnabled = await isFeatureEnabled(key);
    if (!globalEnabled) return false;
    const assignment = await getClubFeatureAssignment(prisma, clubId, key);
    return assignment.assignedEnabled;
}

async function requireClubFeatureForClubId(res: express.Response, clubId: string, key: 'points') {
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

router.use(async (req, res, next) => {
    const p = String(req.path || '');
    let key: string | null = null;
    if (p.startsWith('/messages') || p.startsWith('/broadcast')) key = 'club_messages';
    else if (p.startsWith('/breaks') || p.includes('/leaderboard/')) key = 'highbreak';
    else if (p.startsWith('/live-announcements')) key = 'live';
    else if (p.includes('/tournaments')) key = 'tournaments';
    else if (p.startsWith('/sessions')) key = 'qr_session';
    else if (p.startsWith('/tables') && p.includes('/qr/')) key = 'qr_session';
    else if (p.startsWith('/tables') || p.startsWith('/pricing') || p.startsWith('/reservations')) key = 'booking';
    else if (p.startsWith('/points')) key = 'points';
    if (!key) return next();
    const ok = await isFeatureEnabled(key);
    if (!ok) return res.status(403).json({ error: 'feature_disabled', feature: key });
    next();
});

router.get('/features/access', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
        const globalEnabled = await isFeatureEnabled('points');
        const assignment = await getClubFeatureAssignment(prisma, clubId, 'points');
        res.json({
            clubId,
            features: {
                points: {
                    globalEnabled,
                    assignedEnabled: assignment.assignedEnabled,
                    effectiveEnabled: globalEnabled && assignment.assignedEnabled,
                    explicitEnabled: assignment.explicitEnabled,
                    source: assignment.source,
                    updatedAt: assignment.updatedAt,
                },
            },
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.get('/public', async (req, res) => {
    try {
        const qRaw = req.query.q ?? req.query.keyword ?? '';
        const q = String(qRaw || '').trim();
        const limitRaw = req.query.limit ?? '';
        const limitNum = Number(limitRaw);
        const take = Number.isFinite(limitNum) ? Math.max(1, Math.min(200, Math.floor(limitNum))) : 50;
        const now = new Date();

        const where: any = {
            member: {
                role: 'ADMIN',
                is_enabled: true,
                OR: [
                    { access_expires_at: null },
                    { access_expires_at: { gt: now } },
                ],
            },
        };

        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { intro: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
            ];
        }

        const rows = await prisma.clubProfile.findMany({
            where,
            orderBy: [{ updatedAt: 'desc' }],
            take,
            select: {
                id: true,
                name: true,
                intro: true,
                address: true,
                phone: true,
                logoUrl: true,
                member: { select: { name: true } },
            },
        });

        const result = rows.map((r) => ({
            ...r,
            name: r.name || r.member?.name || '',
        }));

        res.json(result);
    } catch (error) {
        console.error('Error listing public clubs:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

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
    
    const {
        name,
        intro,
        address,
        mapUrl,
        phone,
        email,
        logoUrl,
        paymentInfo,
        coverImageUrl,
        galleryUrls,
        facilities,
        policies,
        publicEnabled,
        publicShowHighbreak,
        publicShowTournaments,
        publicShowLive,
    } = req.body;

    const normalizeStringList = (raw: any, max: number) => {
        const out = raw
            .map((x: any) => String(x || '').trim())
            .filter((x: string) => x.length > 0)
            .slice(0, max);
        return out;
    };

    const safeGalleryUrls = Array.isArray(galleryUrls) ? normalizeStringList(galleryUrls, 12) : undefined;
    const safeFacilities = Array.isArray(facilities) ? normalizeStringList(facilities, 24) : undefined;

    try {
        console.log(`[Club] Update profile request for member ${memberId}`, req.body);

        const updateData: any = {
            name,
            intro,
            address,
            mapUrl,
            phone,
            email,
            logoUrl,
            paymentInfo,
            coverImageUrl,
            policies,
        };
        if (typeof publicEnabled === 'boolean') updateData.publicEnabled = publicEnabled;
        if (typeof publicShowHighbreak === 'boolean') updateData.publicShowHighbreak = publicShowHighbreak;
        if (typeof publicShowTournaments === 'boolean') updateData.publicShowTournaments = publicShowTournaments;
        if (typeof publicShowLive === 'boolean') updateData.publicShowLive = publicShowLive;
        if (safeGalleryUrls !== undefined) updateData.galleryUrls = safeGalleryUrls;
        if (safeFacilities !== undefined) updateData.facilities = safeFacilities;

        const createData: any = {
            memberId,
            name,
            intro,
            address,
            mapUrl,
            phone,
            email,
            logoUrl,
            paymentInfo,
            coverImageUrl,
            policies,
        };
        if (typeof publicEnabled === 'boolean') createData.publicEnabled = publicEnabled;
        if (typeof publicShowHighbreak === 'boolean') createData.publicShowHighbreak = publicShowHighbreak;
        if (typeof publicShowTournaments === 'boolean') createData.publicShowTournaments = publicShowTournaments;
        if (typeof publicShowLive === 'boolean') createData.publicShowLive = publicShowLive;
        if (safeGalleryUrls !== undefined) createData.galleryUrls = safeGalleryUrls;
        if (safeFacilities !== undefined) createData.facilities = safeFacilities;

        const club = await prisma.clubProfile.upsert({
            where: { memberId },
            update: updateData,
            create: createData,
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

router.put('/my-members/:id/rating', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const memberId = member.id;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const payload = req.body || {};
    const rating = Number(payload.rating);
    if (!Number.isFinite(rating)) return res.status(400).json({ error: 'rating invalid' });
    const v = Math.max(-999, Math.min(999, Math.trunc(rating)));
    try {
        const club = await prisma.clubProfile.findUnique({ where: { memberId } });
        if (!club) return res.status(404).json({ error: 'Club profile not found' });
        const cur = await prisma.clubMember.findUnique({ where: { id } });
        if (!cur || cur.clubId !== club.id) return res.status(404).json({ error: 'Not found' });
        const row = await prisma.clubMember.update({ where: { id }, data: { rating: v } });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.put('/my-members/:id/nickname', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const memberId = member.id;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const payload = req.body || {};
    const raw = String(payload.nickname == null ? '' : payload.nickname).trim();
    const nickname = raw ? raw.slice(0, 40) : null;
    try {
        const club = await prisma.clubProfile.findUnique({ where: { memberId } });
        if (!club) return res.status(404).json({ error: 'Club profile not found' });
        const cur = await prisma.clubMember.findUnique({ where: { id } });
        if (!cur || cur.clubId !== club.id) return res.status(404).json({ error: 'Not found' });
        const row = await prisma.clubMember.update({ where: { id }, data: { nickname } });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.delete('/my-members/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const memberId = member.id;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
        const club = await prisma.clubProfile.findUnique({ where: { memberId } });
        if (!club) return res.status(404).json({ error: 'Club profile not found' });
        const cur = await prisma.clubMember.findUnique({ where: { id } });
        if (!cur || cur.clubId !== club.id) return res.status(404).json({ error: 'Not found' });
        await prisma.clubMember.delete({ where: { id } });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: String(e) });
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
                content,
                deletedAt: null,
            }
        });
        res.json(message);
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

function normalizeHttpUrl(raw: any): string | null {
    const s = String(raw == null ? '' : raw).trim();
    if (!s) return null;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('//')) return `https:${s}`;
    return `https://${s}`;
}
function formatHongKongDateTime(d: Date): string {
    try {
        return d.toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
        return d.toISOString();
    }
}

router.post('/live-announcements', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });

    const payload = req.body || {};
    const title = String(payload.title || '').trim();
    const startsAtRaw = payload.startsAt;
    const liveUrl = normalizeHttpUrl(payload.liveUrl);
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!startsAtRaw) return res.status(400).json({ error: 'startsAt required' });
    if (!liveUrl) return res.status(400).json({ error: 'liveUrl required' });
    const startsAt = new Date(String(startsAtRaw));
    if (!Number.isFinite(startsAt.getTime())) return res.status(400).json({ error: 'startsAt invalid' });

    const row = await prisma.liveAnnouncement.create({
        data: {
            id: randomUUID(),
            clubId,
            title,
            startsAt,
            liveUrl,
            createdByMemberId: member.id,
        }
    });
    try {
        const msgTitle = `直播通告：${title}`;
        const content = `日期時間：${formatHongKongDateTime(startsAt)}\n直播連結：${liveUrl}`;
        await prisma.clubMessage.create({ data: { clubId, title: msgTitle, content } });
    } catch {}
    res.json(row);
});

router.put('/live-announcements/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });

    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const payload = req.body || {};

    const patch: any = {};
    if (payload.title != null) patch.title = String(payload.title || '').trim();
    if (payload.startsAt !== undefined) {
        const v = payload.startsAt;
        if (v == null || String(v).trim() === '') patch.startsAt = null;
        else {
            const d = new Date(String(v));
            if (!Number.isFinite(d.getTime())) return res.status(400).json({ error: 'startsAt invalid' });
            patch.startsAt = d;
        }
    }
    if (payload.liveUrl !== undefined) {
        const u = normalizeHttpUrl(payload.liveUrl);
        if (!u) return res.status(400).json({ error: 'liveUrl invalid' });
        patch.liveUrl = u;
    }

    try {
        const row = await prisma.liveAnnouncement.findUnique({ where: { id } });
        if (!row || row.clubId !== clubId || row.deletedAt != null) return res.status(404).json({ error: 'Not found' });
        if (patch.title != null && !patch.title) return res.status(400).json({ error: 'title required' });
        if (patch.startsAt === null) return res.status(400).json({ error: 'startsAt required' });
        const updated = await prisma.liveAnnouncement.update({
            where: { id },
            data: patch,
        });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.get('/tournaments', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
        const rows = await prisma.tournament.findMany({
            where: { clubId },
            orderBy: [{ createdAt: 'desc' }],
            take: 200,
        });
        const ids = rows.map((r) => r.id);
        const counts = ids.length > 0
            ? await prisma.tournamentSignup.groupBy({
                by: ['tournamentId', 'status'],
                where: { tournamentId: { in: ids }, status: { in: ['PENDING', 'CONFIRMED'] } },
                _count: { _all: true },
            })
            : [];
        const map = new Map<string, { pending: number; confirmed: number }>();
        for (const c of counts) {
            const tid = String((c as any).tournamentId);
            const st = String((c as any).status);
            const cur = map.get(tid) || { pending: 0, confirmed: 0 };
            if (st === 'PENDING') cur.pending = (c as any)._count._all;
            if (st === 'CONFIRMED') cur.confirmed = (c as any)._count._all;
            map.set(tid, cur);
        }
        res.json(rows.map((t) => {
            const c = map.get(t.id) || { pending: 0, confirmed: 0 };
            return { ...t, pendingCount: c.pending, confirmedCount: c.confirmed, signupCount: c.pending + c.confirmed };
        }));
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.post('/tournaments', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const payload = req.body || {};
    const title = String(payload.title || '').trim();
    const description = payload.description == null ? null : String(payload.description).trim() || null;
    const signupGuide = payload.signupGuide == null ? null : String(payload.signupGuide).trim() || null;
    const capacity = Number(payload.capacity ?? 32);
    const startsAtRaw = payload.startsAt;
    const signupClosesAtRaw = payload.signupClosesAt ?? payload.deadline;
    if (!title) return res.status(400).json({ error: 'title required' });
    const cap = Number.isFinite(capacity) ? Math.max(1, Math.min(512, Math.floor(capacity))) : 32;
    const startsAt = startsAtRaw ? new Date(String(startsAtRaw)) : null;
    if (startsAtRaw && (!startsAt || Number.isNaN(startsAt.getTime()))) return res.status(400).json({ error: 'startsAt invalid' });
    const signupClosesAt = signupClosesAtRaw ? new Date(String(signupClosesAtRaw)) : null;
    if (signupClosesAtRaw && (!signupClosesAt || Number.isNaN(signupClosesAt.getTime()))) return res.status(400).json({ error: 'signupClosesAt invalid' });
    try {
        const row = await prisma.tournament.create({
            data: {
                id: randomUUID(),
                clubId,
                status: 'DRAFT',
                title,
                description,
                signupGuide,
                capacity: cap,
                startsAt,
                signupClosesAt,
            }
        });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.put('/tournaments/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const payload = req.body || {};
    const patch: any = {};
    if (payload.title != null) patch.title = String(payload.title || '').trim();
    if (payload.description !== undefined) patch.description = payload.description == null ? null : String(payload.description).trim() || null;
    if (payload.signupGuide !== undefined) patch.signupGuide = payload.signupGuide == null ? null : String(payload.signupGuide).trim() || null;
    if (payload.capacity != null) {
        const n = Number(payload.capacity);
        if (!Number.isFinite(n)) return res.status(400).json({ error: 'capacity invalid' });
        patch.capacity = Math.max(1, Math.min(512, Math.floor(n)));
    }
    if (payload.startsAt !== undefined) {
        const v = payload.startsAt;
        const d = v == null || String(v).trim() === '' ? null : new Date(String(v));
        if (d && Number.isNaN(d.getTime())) return res.status(400).json({ error: 'startsAt invalid' });
        patch.startsAt = d;
    }
    if (payload.signupClosesAt !== undefined) {
        const v = payload.signupClosesAt;
        const d = v == null || String(v).trim() === '' ? null : new Date(String(v));
        if (d && Number.isNaN(d.getTime())) return res.status(400).json({ error: 'signupClosesAt invalid' });
        patch.signupClosesAt = d;
    }
    try {
        const cur = await prisma.tournament.findUnique({ where: { id } });
        if (!cur || cur.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
        if (patch.title != null && !patch.title) return res.status(400).json({ error: 'title required' });
        const row = await prisma.tournament.update({ where: { id }, data: patch });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.post('/tournaments/:id/publish', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
        const cur = await prisma.tournament.findUnique({ where: { id } });
        if (!cur || cur.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
        const row = await prisma.tournament.update({ where: { id }, data: { status: 'PUBLISHED' } });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.post('/tournaments/:id/close', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    try {
        const cur = await prisma.tournament.findUnique({ where: { id } });
        if (!cur || cur.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
        const row = await prisma.tournament.update({ where: { id }, data: { status: 'CLOSED' } });
        res.json(row);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.get('/tournaments/:id/signups', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const status = String(req.query.status || 'PENDING').toUpperCase();
    const whereStatus = status === 'ALL' ? undefined : status;
    try {
        const t = await prisma.tournament.findUnique({ where: { id } });
        if (!t || t.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
        const where: any = { tournamentId: id };
        if (whereStatus) where.status = whereStatus;
        const rows = await prisma.tournamentSignup.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
            take: 500,
            include: { member: { select: { id: true, name: true, member_code: true, email: true } } },
        });
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.post('/tournaments/:id/signups/:signupId/confirm', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const signupId = String(req.params.signupId || '').trim();
    try {
        const t = await prisma.tournament.findUnique({ where: { id } });
        if (!t || t.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
        const s = await prisma.tournamentSignup.findUnique({ where: { id: signupId } });
        if (!s || s.tournamentId !== id) return res.status(404).json({ error: 'Not found' });
        const updated = await prisma.tournamentSignup.update({ where: { id: signupId }, data: { status: 'CONFIRMED' } });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.post('/tournaments/:id/signups/:signupId/cancel', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const signupId = String(req.params.signupId || '').trim();
    try {
        const t = await prisma.tournament.findUnique({ where: { id } });
        if (!t || t.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
        const s = await prisma.tournamentSignup.findUnique({ where: { id: signupId } });
        if (!s || s.tournamentId !== id) return res.status(404).json({ error: 'Not found' });
        const updated = await prisma.tournamentSignup.update({ where: { id: signupId }, data: { status: 'CANCELLED' } });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.get('/live-announcements', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const rows = await prisma.liveAnnouncement.findMany({
        where: { clubId, deletedAt: null },
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(rows);
});

router.delete('/live-announcements/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = req.params.id;
    const row = await prisma.liveAnnouncement.findUnique({ where: { id } });
    if (!row || row.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.liveAnnouncement.update({ where: { id }, data: { deletedAt: new Date() } });
    res.json(updated);
});

router.get('/live-announcements/public', async (req, res) => {
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(50, Math.max(1, Number(limitRaw || 20) || 20));
    const now = new Date();
    const rows = await prisma.liveAnnouncement.findMany({
        where: { deletedAt: null, startsAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) } },
        orderBy: [{ startsAt: 'asc' }],
        take: limit,
        include: { club: { select: { id: true, name: true, logoUrl: true } } }
    });
    res.json(rows);
});

router.get('/:clubId/live-announcements/public', async (req, res) => {
    const { clubId } = req.params;
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(20, Math.max(1, Number(limitRaw || 5) || 5));
    const now = new Date();
    const cutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const recent = await prisma.liveAnnouncement.findMany({
        where: { clubId, deletedAt: null, startsAt: { gte: cutoff } },
        orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
        take: limit,
    });
    if (recent.length >= limit) return res.json(recent);
    const more = await prisma.liveAnnouncement.findMany({
        where: { clubId, deletedAt: null },
        orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
    });
    const seen = new Set(recent.map((x) => x.id));
    const merged = recent.concat(more.filter((x) => !seen.has(x.id))).slice(0, limit);
    res.json(merged);
});

router.get('/:clubId/tournaments/public', async (req, res) => {
    const { clubId } = req.params;
    const now = new Date();
    const memberId = String(req.headers['x-member-id'] || '').trim() || null;
    try {
        const rows = await prisma.tournament.findMany({
            where: { clubId, status: 'PUBLISHED' },
            orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }],
            take: 100,
        });
        const ids = rows.map((r) => r.id);
        const counts = ids.length > 0
            ? await prisma.tournamentSignup.groupBy({
                by: ['tournamentId'],
                where: { tournamentId: { in: ids }, status: { in: ['PENDING', 'CONFIRMED'] } },
                _count: { _all: true },
            })
            : [];
        const countMap = new Map(counts.map((c) => [c.tournamentId, c._count._all]));
        const myRows = memberId
            ? await prisma.tournamentSignup.findMany({
                where: { memberId, tournamentId: { in: ids }, status: { in: ['PENDING', 'CONFIRMED', 'CANCELLED'] } },
                select: { tournamentId: true, status: true, createdAt: true },
            })
            : [];
        const myMap = new Map(myRows.map((r) => [r.tournamentId, r]));
        res.json(rows.map((t) => {
            const opensOk = !t.signupOpensAt || t.signupOpensAt <= now;
            const closesOk = !t.signupClosesAt || t.signupClosesAt >= now;
            return {
                ...t,
                signupCount: countMap.get(t.id) || 0,
                signupOpen: opensOk && closesOk,
                mySignup: myMap.get(t.id) || null,
            };
        }));
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.get('/:clubId/tournaments/:id/public', async (req, res) => {
    const { clubId, id } = req.params;
    const memberId = String(req.headers['x-member-id'] || '').trim() || null;
    try {
        const t = await prisma.tournament.findUnique({ where: { id } });
        if (!t || t.clubId !== clubId || t.status !== 'PUBLISHED') return res.status(404).json({ error: 'Not found' });
        const signupCount = await prisma.tournamentSignup.count({ where: { tournamentId: id, status: { in: ['PENDING', 'CONFIRMED'] } } });
        const mySignup = memberId
            ? await prisma.tournamentSignup.findUnique({
                where: { tournamentId_memberId: { tournamentId: id, memberId } },
                select: { id: true, status: true, createdAt: true },
            })
            : null;
        res.json({ ...t, signupCount, mySignup });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.post('/:clubId/tournaments/:id/signup', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const { clubId, id } = req.params;
    const now = new Date();
    try {
        const t = await prisma.tournament.findUnique({ where: { id } });
        if (!t || t.clubId !== clubId || t.status !== 'PUBLISHED') return res.status(404).json({ error: 'Not found' });
        if (t.signupOpensAt && t.signupOpensAt > now) return res.status(400).json({ error: '報名尚未開始' });
        if (t.signupClosesAt && t.signupClosesAt < now) return res.status(400).json({ error: '報名已截止' });
        const existing = await prisma.tournamentSignup.findUnique({
            where: { tournamentId_memberId: { tournamentId: id, memberId } }
        });
        if (existing && existing.status !== 'CANCELLED') return res.json({ ok: true, signup: existing, already: true });
        const count = await prisma.tournamentSignup.count({ where: { tournamentId: id, status: { in: ['PENDING', 'CONFIRMED'] } } });
        if (t.capacity != null && count >= t.capacity) return res.status(409).json({ error: '名額已滿' });
        const signup = existing
            ? await prisma.tournamentSignup.update({ where: { id: existing.id }, data: { status: 'PENDING' } })
            : await prisma.tournamentSignup.create({ data: { id: randomUUID(), tournamentId: id, memberId, status: 'PENDING' } });
        try {
            const m = await prisma.member.findUnique({ where: { id: memberId }, select: { name: true, member_code: true } });
            const memberName = String(m?.name || '').trim();
            const memberCode = String(m?.member_code || '').trim();
            const who = [memberCode || '無', memberName].filter(Boolean).join(' ');
            const msgTitle = `比賽報名待確認：${t.title}`;
            const content = `會員：${who}\n狀態：待確認`;
            await prisma.clubMessage.create({ data: { clubId, title: msgTitle, content } });
        } catch {}
        res.json({ ok: true, signup });
    } catch (e) {
        res.status(500).json({ error: String(e) });
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
            where: { clubId: { in: clubIds }, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            include: { club: { select: { name: true, logoUrl: true } } }
        });
        const msgIds = messages.map(m => m.id);
        let readRows: any[] = [];
        try {
            readRows = await prisma.$queryRawUnsafe(`SELECT "messageId" FROM "ClubMessageRead" WHERE "memberId"=$1`, memberId);
        } catch {}
        const readSet = new Set(readRows.map(r => String(r.messageId)));
        let hiddenRows: any[] = [];
        try {
            hiddenRows = await prisma.$queryRawUnsafe(`SELECT "messageId" FROM "ClubMessageHide" WHERE "memberId"=$1`, memberId);
        } catch {}
        const hiddenSet = new Set(hiddenRows.map(r => String(r.messageId)));
        const visible = messages.filter(m => !hiddenSet.has(m.id));
        const withRead = visible.map(m => ({ ...m, read: readSet.has(m.id) }));
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
        try {
            const hidden: any[] = await prisma.$queryRawUnsafe(
                `SELECT 1 FROM "ClubMessageHide" WHERE "memberId"=$1 AND "messageId"=$2 LIMIT 1`,
                memberId, id
            );
            if (hidden.length > 0) return res.status(404).json({ error: 'Not found' });
        } catch {}
        const message = await prisma.clubMessage.findUnique({
            where: { id },
            include: { club: { select: { name: true, logoUrl: true } } }
        });
        if (!message || (message as any).deletedAt != null) return res.status(404).json({ error: 'Not found' });
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

router.post('/messages/hide', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const ids = (req.body || {}).ids;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
    try {
        await prisma.$executeRawUnsafe(
            `CREATE TABLE IF NOT EXISTS "ClubMessageHide"(
                "id" text PRIMARY KEY,
                "memberId" text NOT NULL,
                "messageId" text NOT NULL,
                "hiddenAt" timestamptz DEFAULT CURRENT_TIMESTAMP,
                UNIQUE("memberId","messageId")
            )`
        );
        const uniqueIds = Array.from(new Set(ids.map((x: any) => String(x).trim()).filter(Boolean)));
        for (const mid of uniqueIds) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO "ClubMessageHide"("id","memberId","messageId","hiddenAt")
                 VALUES ($1,$2,$3,CURRENT_TIMESTAMP)
                 ON CONFLICT ("memberId","messageId") DO NOTHING`,
                randomUUID(), memberId, mid
            );
        }
        res.json({ ok: true, hidden: uniqueIds.length });
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

function isSystemClubMessageTitle(title: any): boolean {
    const t = String(title == null ? '' : title).trim();
    if (!t) return false;
    if (t === '新預約待確認') return true;
    if (t.startsWith('直播通告：')) return true;
    if (t.startsWith('比賽報名待確認：')) return true;
    return false;
}

router.get('/:clubId/messages/public', async (req, res) => {
    const clubId = String(req.params.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 30) || 30));
    try {
        const rows = await prisma.clubMessage.findMany({
            where: {
                clubId,
                deletedAt: null,
                NOT: [
                    { title: '新預約待確認' },
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        const filtered = rows.filter((m) => !isSystemClubMessageTitle((m as any).title));
        res.json(filtered);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.get('/club-messages', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(200, Math.max(1, Number(limitRaw || 50) || 50));
    try {
        const rows = await prisma.clubMessage.findMany({
            where: { clubId, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        const filtered = rows.filter((m) => !isSystemClubMessageTitle((m as any).title));
        res.json(filtered);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.put('/club-messages/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    const payload = req.body || {};
    const patch: any = {};
    if (payload.title !== undefined) patch.title = payload.title == null ? null : String(payload.title || '').trim() || null;
    if (payload.content !== undefined) patch.content = String(payload.content || '').trim();
    try {
        const row = await prisma.clubMessage.findUnique({ where: { id } });
        if (!row || row.clubId !== clubId || row.deletedAt != null) return res.status(404).json({ error: 'Not found' });
        if (isSystemClubMessageTitle((row as any).title)) return res.status(400).json({ error: '不可編輯系統訊息' });
        if (patch.content != null && !patch.content) return res.status(400).json({ error: 'content required' });
        const updated = await prisma.clubMessage.update({ where: { id }, data: patch });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

router.delete('/club-messages/:id', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id required' });
    try {
        const row = await prisma.clubMessage.findUnique({ where: { id } });
        if (!row || row.clubId !== clubId || row.deletedAt != null) return res.status(404).json({ error: 'Not found' });
        if (isSystemClubMessageTitle((row as any).title)) return res.status(400).json({ error: '不可刪除系統訊息' });
        const updated = await prisma.clubMessage.update({ where: { id }, data: { deletedAt: new Date() } });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: String(e) });
    }
});

async function getMyClubId(memberId: string) {
    const club = await prisma.clubProfile.findUnique({ where: { memberId } });
    return club?.id || null;
}

function parseMonthRange(month: string) {
    const m = String(month || '').trim();
    const match = /^(\d{4})-(\d{2})$/.exec(m);
    if (!match) return null;
    const year = Number(match[1]);
    const mon = Number(match[2]);
    if (!Number.isFinite(year) || !Number.isFinite(mon) || mon < 1 || mon > 12) return null;
    const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, mon, 1, 0, 0, 0));
    return { start, end };
}

router.post('/breaks', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });

    const payload = req.body || {};
    const targetMemberId = String(payload.memberId || '').trim();
    const points = Number(payload.points);
    const recordedAtRaw = payload.recordedAt;
    const videoUrl = payload.videoUrl == null ? null : String(payload.videoUrl).trim() || null;
    const note = payload.note == null ? null : String(payload.note).trim() || null;

    if (!targetMemberId) return res.status(400).json({ error: 'memberId required' });
    if (!Number.isFinite(points) || points <= 0) return res.status(400).json({ error: 'points invalid' });

    const membership = await prisma.clubMember.findUnique({
        where: { clubId_memberId: { clubId, memberId: targetMemberId } }
    });
    if (!membership) return res.status(400).json({ error: 'Member not in club' });

    const recorded_at = recordedAtRaw ? new Date(String(recordedAtRaw)) : new Date();
    if (recordedAtRaw && Number.isNaN(recorded_at.getTime())) return res.status(400).json({ error: 'recordedAt invalid' });

    const row = await prisma.breakRecord.create({
        data: {
            id: randomUUID(),
            club_id: clubId,
            member_id: targetMemberId,
            points: Math.floor(points),
            recorded_at,
            video_url: videoUrl,
            note,
            created_by_member_id: member.id,
        },
        include: {
            member: { select: { id: true, name: true, email: true, member_code: true } },
        }
    });
    res.json(row);
});

router.get('/breaks', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const { month, memberId } = req.query as any;
    const where: any = { club_id: clubId, deleted_at: null };
    if (memberId) where.member_id = String(memberId).trim();
    if (month) {
        const range = parseMonthRange(String(month));
        if (!range) return res.status(400).json({ error: 'month invalid' });
        where.recorded_at = { gte: range.start, lt: range.end };
    }
    const rows = await prisma.breakRecord.findMany({
        where,
        orderBy: [{ recorded_at: 'desc' }],
        include: { member: { select: { id: true, name: true, email: true, member_code: true } } }
    });
    res.json(rows);
});

router.get('/:clubId/leaderboard/highest', async (req, res) => {
    const clubId = String(req.params.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(50, Math.max(1, Number(limitRaw || 10) || 10));

    const rows = await prisma.breakRecord.findMany({
        where: { club_id: clubId, deleted_at: null },
        orderBy: [{ points: 'desc' }, { recorded_at: 'desc' }],
        take: limit,
        include: { member: { select: { id: true, name: true, email: true, member_code: true } } }
    });
    res.json(rows);
});

router.get('/:clubId/leaderboard/monthly', async (req, res) => {
    const clubId = String(req.params.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const month = req.query.month ? String(req.query.month) : '';
    const range = month ? parseMonthRange(month) : null;
    if (month && !range) return res.status(400).json({ error: 'month invalid' });

    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(50, Math.max(1, Number(limitRaw || 10) || 10));

    const where: any = { club_id: clubId, deleted_at: null };
    if (range) where.recorded_at = { gte: range.start, lt: range.end };

    const grouped = await prisma.breakRecord.groupBy({
        by: ['member_id'],
        where,
        _sum: { points: true },
        orderBy: { _sum: { points: 'desc' } },
        take: limit,
    });

    const ids = grouped.map(g => g.member_id);
    const members = ids.length === 0 ? [] : await prisma.member.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, email: true, member_code: true }
    });
    const map = new Map(members.map(m => [m.id, m]));

    res.json(grouped.map(g => ({
        member: map.get(g.member_id) || { id: g.member_id, name: '-', email: null, member_code: null },
        totalPoints: g._sum.points || 0,
    })));
});

router.get('/points/config', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const row = await prisma.clubPointsConfig.findUnique({ where: { clubId } });
    res.json(row || { clubId, currencyCode: 'HKD', pointsPerCurrency: '1', roundingMinutes: 15, minBillableMinutes: 0 });
});

router.put('/points/config', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const payload = req.body || {};
    const currencyCode = String(payload.currencyCode || 'HKD').trim().toUpperCase();
    const pointsPerCurrencyRaw = payload.pointsPerCurrency;
    const roundingMinutesRaw = payload.roundingMinutes;
    const minBillableMinutesRaw = payload.minBillableMinutes;
    if (!/^[A-Z]{3}$/.test(currencyCode)) return res.status(400).json({ error: 'currencyCode invalid' });
    const ppc = Number(pointsPerCurrencyRaw);
    if (!Number.isFinite(ppc) || ppc <= 0) return res.status(400).json({ error: 'pointsPerCurrency invalid' });
    const roundingMinutes = Math.floor(Number(roundingMinutesRaw));
    if (!Number.isFinite(roundingMinutes) || roundingMinutes < 1 || roundingMinutes > 180) return res.status(400).json({ error: 'roundingMinutes invalid' });
    const minBillableMinutes = Math.floor(Number(minBillableMinutesRaw));
    if (!Number.isFinite(minBillableMinutes) || minBillableMinutes < 0 || minBillableMinutes > 720) return res.status(400).json({ error: 'minBillableMinutes invalid' });
    const existing = await prisma.clubPointsConfig.findUnique({ where: { clubId }, select: { id: true } });
    const row = await prisma.clubPointsConfig.upsert({
        where: { clubId },
        update: { currencyCode, pointsPerCurrency: String(ppc), roundingMinutes, minBillableMinutes },
        create: { id: existing?.id || randomUUID(), clubId, currencyCode, pointsPerCurrency: String(ppc), roundingMinutes, minBillableMinutes },
    });
    res.json(row);
});

router.get('/points/balances', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const memberships = await prisma.clubMember.findMany({
        where: { clubId },
        include: { member: { select: { id: true, name: true, email: true, member_code: true, phone: true, phone_e164: true } } },
        orderBy: [{ joinedAt: 'desc' }],
    });
    const ids = memberships.map((m: any) => m.memberId);
    const balances = ids.length === 0 ? [] : await prisma.pointsBalance.findMany({
        where: { clubId, memberId: { in: ids } },
        select: { memberId: true, balance: true, updatedAt: true },
    });
    const map = new Map(balances.map(b => [b.memberId, b]));
    res.json(memberships.map((m: any) => {
        const b = map.get(m.memberId);
        return {
            member: m.member,
            memberId: m.memberId,
            balance: b?.balance ?? 0,
            updatedAt: b?.updatedAt ?? null,
        };
    }));
});

router.get('/points/balances/search', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const q = req.query.q == null ? '' : String(req.query.q || '').trim();
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 20) || 20));
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
    const memberships = await prisma.clubMember.findMany({
        where,
        take: limit,
        orderBy: [{ joinedAt: 'desc' }],
        include: { member: { select: { id: true, name: true, email: true, member_code: true, phone: true, phone_e164: true } } },
    });
    const ids = memberships.map((m: any) => m.memberId);
    const balances = ids.length === 0 ? [] : await prisma.pointsBalance.findMany({
        where: { clubId, memberId: { in: ids } },
        select: { memberId: true, balance: true, updatedAt: true },
    });
    const map = new Map(balances.map(b => [b.memberId, b]));
    res.json(memberships.map((m: any) => {
        const b = map.get(m.memberId);
        return {
            member: m.member,
            memberId: m.memberId,
            balance: b?.balance ?? 0,
            updatedAt: b?.updatedAt ?? null,
        };
    }));
});

router.get('/points/my-balance', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const clubId = req.query.clubId == null ? '' : String(req.query.clubId || '').trim();
    if (!clubId) return res.status(400).json({ error: 'clubId required' });
    const membership = await prisma.clubMember.findUnique({ where: { clubId_memberId: { clubId, memberId: member.id } } });
    if (!membership) return res.status(403).json({ error: 'Not in club' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const bal = await prisma.pointsBalance.findUnique({
        where: { clubId_memberId: { clubId, memberId: member.id } },
        select: { balance: true, updatedAt: true },
    });
    res.json({ clubId, memberId: member.id, balance: bal?.balance ?? 0, updatedAt: bal?.updatedAt ?? null });
});

router.get('/points/my-balances', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const globalEnabled = await isFeatureEnabled('points');
    if (!globalEnabled) return res.json([]);
    const memberships = await prisma.clubMember.findMany({
        where: { memberId: member.id },
        select: { clubId: true },
        orderBy: [{ joinedAt: 'desc' }],
        take: 200,
    });
    const clubIds = memberships.map((m) => m.clubId);
    const assignments = clubIds.length === 0 ? {} : await getClubFeatureAssignments(prisma, clubIds, 'points');
    const enabledClubIds = clubIds.filter((clubId) => assignments[clubId]?.assignedEnabled);
    const rows = enabledClubIds.length === 0 ? [] : await prisma.pointsBalance.findMany({
        where: { memberId: member.id, clubId: { in: enabledClubIds } },
        select: { clubId: true, balance: true, updatedAt: true },
    });
    const map = new Map(rows.map((r) => [r.clubId, r]));
    res.json(enabledClubIds.map((clubId) => {
        const r = map.get(clubId);
        return { clubId, balance: r?.balance ?? 0, updatedAt: r?.updatedAt ?? null };
    }));
});

router.get('/points/ledger', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const limitRaw = req.query.limit == null ? '' : String(req.query.limit);
    const limit = Math.min(200, Math.max(1, Number(limitRaw || 50) || 50));
    const memberId = req.query.memberId == null ? '' : String(req.query.memberId).trim();
    const fromRaw = req.query.from == null ? '' : String(req.query.from).trim();
    const toRaw = req.query.to == null ? '' : String(req.query.to).trim();
    const monthRaw = req.query.month == null ? '' : String(req.query.month).trim();
    const groupBy = req.query.groupBy == null ? '' : String(req.query.groupBy).trim();
    const includeTotal = String(req.query.includeTotal || '').trim() === '1';

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

    if (groupBy === 'month') {
        const rows = await prisma.pointsLedger.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
            select: { createdAt: true, deltaPoints: true },
            take: 5000,
        });
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
        const out = Array.from(map.values()).sort((a, b) => (a.month < b.month ? 1 : -1));
        res.json(out);
        return;
    }

    const [rows, agg] = await Promise.all([
        prisma.pointsLedger.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
            take: limit,
            include: {
                member: { select: { id: true, name: true, email: true, member_code: true, phone: true, phone_e164: true } },
                createdBy: { select: { id: true, name: true, email: true } },
            }
        }),
        includeTotal ? prisma.pointsLedger.aggregate({ where, _sum: { deltaPoints: true } }) : Promise.resolve(null as any),
    ]);

    if (includeTotal) {
        res.json({ rows, totalDelta: agg?._sum?.deltaPoints ?? 0 });
        return;
    }
    res.json(rows);
});

router.post('/points/adjust', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    if (!(await requireClubFeatureForClubId(res, clubId, 'points'))) return;
    const payload = req.body || {};
    const targetMemberId = String(payload.memberId || '').trim();
    const delta = Math.floor(Number(payload.deltaPoints));
    const reason = String(payload.reason || '').trim();
    if (!targetMemberId) return res.status(400).json({ error: 'memberId required' });
    if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: 'deltaPoints invalid' });
    if (!reason) return res.status(400).json({ error: 'reason required' });
    const membership = await prisma.clubMember.findUnique({
        where: { clubId_memberId: { clubId, memberId: targetMemberId } }
    });
    if (!membership) return res.status(400).json({ error: 'Member not in club' });
    const ledgerId = randomUUID();
    const now = new Date();
    const result = await prisma.$transaction(async (tx) => {
        await tx.pointsLedger.create({
            data: {
                id: ledgerId,
                clubId,
                memberId: targetMemberId,
                deltaPoints: delta,
                reason,
                createdByMemberId: member.id,
                createdAt: now,
            }
        });
        const bal = await tx.pointsBalance.upsert({
            where: { clubId_memberId: { clubId, memberId: targetMemberId } },
            update: { balance: { increment: delta } },
            create: { id: randomUUID(), clubId, memberId: targetMemberId, balance: delta },
            select: { balance: true, updatedAt: true },
        });
        return bal;
    });
    res.json({ ok: true, memberId: targetMemberId, deltaPoints: delta, balance: result.balance, updatedAt: result.updatedAt });
});

router.get('/tables/my', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    let rows = await prisma.clubTable.findMany({
        where: { clubId },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: { qrToken: { select: { token: true, active: true, rotatedAt: true, updatedAt: true } } }
    });
    const missing = rows.filter((r: any) => !r.qrToken);
    if (missing.length > 0) {
        const creates = missing.map((t: any) => prisma.tableQrToken.create({
            data: { id: randomUUID(), clubId, tableId: t.id, token: randomUUID(), active: true }
        }));
        try {
            await prisma.$transaction(creates);
        } catch {}
        rows = await prisma.clubTable.findMany({
            where: { clubId },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
            include: { qrToken: { select: { token: true, active: true, rotatedAt: true, updatedAt: true } } }
        });
    }
    res.json(rows);
});

router.post('/tables/:id/qr/rotate', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const t = await prisma.clubTable.findUnique({ where: { id } });
    if (!t || t.clubId !== clubId) return res.status(404).json({ error: 'Not found' });
    const token = randomUUID();
    const row = await prisma.tableQrToken.upsert({
        where: { tableId: id },
        update: { token, rotatedAt: new Date(), active: true },
        create: { id: randomUUID(), clubId, tableId: id, token, active: true, rotatedAt: new Date() },
        select: { token: true, active: true, rotatedAt: true, updatedAt: true }
    });
    res.json(row);
});

function ceilDiv(a: number, b: number) {
    if (b <= 0) return a;
    return Math.floor((a + b - 1) / b);
}

function calcBilledMinutes(startAt: Date, endAt: Date, cfg: any) {
    const diffMs = endAt.getTime() - startAt.getTime();
    const rawMinutes = Math.max(0, Math.ceil(diffMs / 60000));
    const roundingMinutes = Math.max(1, Math.floor(Number(cfg?.roundingMinutes ?? 15)));
    const minBillableMinutes = Math.max(0, Math.floor(Number(cfg?.minBillableMinutes ?? 0)));
    const rounded = ceilDiv(rawMinutes, roundingMinutes) * roundingMinutes;
    return Math.max(rounded, minBillableMinutes);
}

function calcChargedAmount(basePrice: any, billedMinutes: number) {
    if (basePrice == null) return null;
    const perHour = Number(String(basePrice));
    if (!Number.isFinite(perHour) || perHour <= 0) return null;
    const amt = perHour * (billedMinutes / 60);
    return Number.isFinite(amt) ? amt : null;
}

function calcChargedPoints(amount: number | null, cfg: any) {
    if (amount == null) return 0;
    const ppc = Number(String(cfg?.pointsPerCurrency ?? 1));
    if (!Number.isFinite(ppc) || ppc <= 0) return 0;
    const pts = Math.round(amount * ppc);
    return Number.isFinite(pts) && pts > 0 ? pts : 0;
}

router.get('/sessions/active', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const rows = await prisma.tableSession.findMany({
        where: { clubId, status: 'ACTIVE' },
        orderBy: [{ startAt: 'desc' }],
        include: {
            table: { select: { id: true, name: true } },
            startedBy: { select: { id: true, name: true, email: true, member_code: true } },
        }
    });
    res.json(rows);
});

router.post('/sessions/:id/end', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const id = String(req.params.id || '').trim();
    const now = new Date();
    const featurePoints = await isClubFeatureEnabled(clubId, 'points');

    const result = await prisma.$transaction(async (tx) => {
        const s = await tx.tableSession.findUnique({
            where: { id },
            include: { table: { select: { id: true, name: true, basePrice: true } } }
        });
        if (!s || s.clubId !== clubId) throw new Error('Not found');
        if (s.status !== 'ACTIVE') throw new Error('Session not active');
        const cfg = await tx.clubPointsConfig.findUnique({ where: { clubId } });
        const billedMinutes = calcBilledMinutes(s.startAt, now, cfg);
        const amount = calcChargedAmount(s.table.basePrice, billedMinutes);
        const currency = String(cfg?.currencyCode || 'HKD');
        const chargedPoints = featurePoints ? calcChargedPoints(amount, cfg) : 0;

        let pointsLedgerId: string | null = null;
        if (featurePoints && chargedPoints > 0) {
            pointsLedgerId = randomUUID();
            await tx.pointsLedger.create({
                data: {
                    id: pointsLedgerId,
                    clubId,
                    memberId: s.startedByMemberId,
                    deltaPoints: -chargedPoints,
                    reason: `台費抵扣（${s.table.name}）`,
                    refType: 'TABLE_SESSION',
                    refId: s.id,
                    createdByMemberId: member.id,
                    createdAt: now,
                }
            });
            await tx.pointsBalance.upsert({
                where: { clubId_memberId: { clubId, memberId: s.startedByMemberId } },
                update: { balance: { increment: -chargedPoints } },
                create: { id: randomUUID(), clubId, memberId: s.startedByMemberId, balance: -chargedPoints },
            });
        }

        return tx.tableSession.update({
            where: { id: s.id },
            data: {
                status: 'ENDED',
                endAt: now,
                endedByOperatorId: member.id,
                endSource: 'OPERATOR',
                billedMinutes,
                chargedAmount: amount == null ? null : String(amount),
                chargedCurrency: currency,
                chargedPoints: chargedPoints || null,
                pointsLedgerId,
            },
            include: {
                table: { select: { id: true, name: true } },
                startedBy: { select: { id: true, name: true, email: true, member_code: true } },
            }
        });
    }).catch((e: any) => {
        res.status(400).json({ error: String(e?.message || e) });
        return null;
    });
    if (!result) return;
    res.json(result);
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

router.get('/reservations', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    const { status } = req.query as any;
    const where: any = { clubId };
    if (status) where.status = String(status).toUpperCase();
    const rows = await prisma.tableReservation.findMany({
        where,
        orderBy: { startAt: 'desc' },
        include: { table: true, member: { select: { id: true, name: true, email: true } }, pricingScheme: true }
    });
    res.json(rows);
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
            status: { in: ['CONFIRMED', 'BLOCKED'] },
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
    const base = rows.map((r) => ({
        ...r,
        minHours: getSchemeMinHours((r as any).rulesJson),
        effectivePricePerHour: r.price != null ? toFiniteNumber(r.price as any) : null
    }));
    if (!startAt) return res.json(base);
    const s = new Date(String(startAt));
    if (!Number.isFinite(s.getTime())) return res.status(400).json({ error: 'Invalid startAt' });
    const e = endAt
        ? new Date(String(endAt))
        : new Date(s.getTime() + (Math.max(1, Number(quantityHours || 1) || 1) * 60 * 60 * 1000));
    if (!Number.isFinite(e.getTime()) || !(e > s)) return res.status(400).json({ error: 'Invalid endAt' });
    const requestedHours = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
    const tid = tableId ? String(tableId) : null;
    const applicable = base
        .map((scheme) => {
            if (scheme.minHours != null && requestedHours + 1e-9 < Number(scheme.minHours)) return null;
            const ok = isSchemeApplicable(scheme as any, s, e, tid);
            if (!ok || !(ok as any).ok) return null;
            const rulePrice = (ok as any).pricePerHour != null ? toFiniteNumber((ok as any).pricePerHour) : null;
            const effective = rulePrice ?? scheme.effectivePricePerHour ?? null;
            return { ...scheme, effectivePricePerHour: effective };
        })
        .filter(Boolean);
    const combos = computeComboPlans(s, e, base as any[], tid);
    res.json([...(applicable as any[]), ...(combos as any[])]);
});

router.get('/:clubId/availability', async (req, res) => {
    const { clubId } = req.params;
    const { from, to, tableId } = req.query as any;
    if (!from || !to) return res.status(400).json({ error: 'Missing from/to' });
    const start = new Date(String(from));
    const end = new Date(String(to));
    const where: any = { clubId, status: { in: ['PENDING', 'CONFIRMED', 'BLOCKED'] }, AND: [{ startAt: { lt: end } }, { endAt: { gt: start } }] };
    if (tableId) where.tableId = String(tableId);
    const rows = await prisma.tableReservation.findMany({ where, include: { table: true }, orderBy: { startAt: 'asc' } });
    res.json(rows);
});

router.post('/reservations/manual', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });

    const { tableId, startAt, endAt, quantityHours, mode, memberId } = req.body || {};
    if (!tableId || !startAt) return res.status(400).json({ error: 'Missing fields' });
    const table = await prisma.clubTable.findUnique({ where: { id: String(tableId) } });
    if (!table || table.clubId !== clubId) return res.status(404).json({ error: 'Table not found' });

    const s = new Date(String(startAt));
    const e = endAt ? new Date(String(endAt)) : new Date(s.getTime() + (Number(quantityHours || 0) || 1) * 60 * 60 * 1000);
    const now = Date.now();
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime()) || !(e > s)) return res.status(400).json({ error: 'Invalid time range' });
    if (e.getTime() < now - 60_000) return res.status(400).json({ error: '不能建立已結束的時段' });

    const normalizedMode = String(mode || 'BLOCK').toUpperCase();
    const isBlock = normalizedMode === 'BLOCK';
    const targetMemberId = isBlock ? member.id : String(memberId || '').trim();
    if (!targetMemberId) return res.status(400).json({ error: 'memberId required' });

    const overlap = await prisma.tableReservation.count({
        where: { tableId: table.id, status: { in: ['PENDING', 'CONFIRMED', 'BLOCKED'] }, AND: [{ startAt: { lt: e } }, { endAt: { gt: s } }] }
    });
    if (overlap > 0) return res.status(409).json({ error: '該時段已被預約/封鎖，請選擇其他時間' });

    const created = await prisma.tableReservation.create({
        data: {
            clubId,
            tableId: table.id,
            memberId: targetMemberId,
            startAt: s,
            endAt: e,
            status: isBlock ? 'BLOCKED' : 'CONFIRMED',
            confirmedAt: new Date(),
        }
    });
    res.json(created);
});

function parseHHMM(hhmm: string) {
    const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
    return { h: h || 0, m: m || 0 };
}
function toFiniteNumber(v: any) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function getSchemeMinHours(rulesJson: any) {
    if (rulesJson == null) return null;
    if (typeof rulesJson === 'string') {
        try {
            const parsed = JSON.parse(rulesJson);
            return getSchemeMinHours(parsed);
        } catch {
            return null;
        }
    }
    if (Array.isArray(rulesJson)) return null;
    if (typeof rulesJson === 'object') {
        const v = (rulesJson as any).minHours ?? (rulesJson as any).minQuantityHours ?? (rulesJson as any).minQtyHours;
        const n = toFiniteNumber(v);
        if (n == null) return null;
        const i = Math.floor(n);
        if (i < 1) return null;
        return i;
    }
    return null;
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
function hkParts(d: Date) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Hong_Kong',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        weekday: 'short',
    });
    const parts = fmt.formatToParts(d);
    const pick = (type: string) => parts.find((p) => p.type === type)?.value || '';
    const year = Number(pick('year'));
    const month = Number(pick('month'));
    const day = Number(pick('day'));
    const hour = Number(pick('hour'));
    const minute = Number(pick('minute'));
    const weekday = pick('weekday');
    return { year, month, day, hour, minute, weekday };
}
function hkDayKey(d: Date) {
    const p = hkParts(d);
    const y = Number.isFinite(p.year) ? p.year : 0;
    const m = Number.isFinite(p.month) ? p.month : 0;
    const dd = Number.isFinite(p.day) ? p.day : 0;
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
}
function hkDow(d: Date) {
    const w = hkParts(d).weekday;
    if (w === 'Mon') return 1;
    if (w === 'Tue') return 2;
    if (w === 'Wed') return 3;
    if (w === 'Thu') return 4;
    if (w === 'Fri') return 5;
    if (w === 'Sat') return 6;
    if (w === 'Sun') return 7;
    return 1;
}
function hkMinuteOfDay(d: Date) {
    const p = hkParts(d);
    const h = Number.isFinite(p.hour) ? p.hour : 0;
    const m = Number.isFinite(p.minute) ? p.minute : 0;
    return h * 60 + m;
}
function hkMidnightUtcFromInstant(d: Date) {
    const p = hkParts(d);
    const y = Number.isFinite(p.year) ? p.year : 1970;
    const m = Number.isFinite(p.month) ? p.month : 1;
    const dd = Number.isFinite(p.day) ? p.day : 1;
    const utc = Date.UTC(y, m - 1, dd, 0, 0, 0, 0);
    return new Date(utc - 8 * 60 * 60 * 1000);
}
function isSchemeApplicable(scheme: any, s: Date, e: Date, tableId?: string | null) {
    if (scheme.active !== true) return false;
    if (scheme.tableId && tableId && scheme.tableId !== tableId) return false;
    try {
        const dayKeyStart = hkDayKey(s);
        const endMinus1 = new Date(e.getTime() - 1);
        const dayKeyEnd = hkDayKey(endMinus1);
        if (dayKeyStart !== dayKeyEnd) return false;
        const rules = normalizeRulesJson(scheme.rulesJson);
        if (rules == null) return false;
        if (rules.length === 0) return { ok: true, pricePerHour: null };
        const dow = hkDow(s);
        const startMin = hkMinuteOfDay(s);
        const endMin = hkMinuteOfDay(e);
        if (!(endMin > startMin)) return false;
        for (const r of rules) {
            const days: number[] = Array.isArray(r.daysOfWeek) ? r.daysOfWeek : [];
            if (days.length > 0 && !days.includes(dow)) continue;
            const { h: sh, m: sm } = parseHHMM(r.start || '00:00');
            const { h: eh, m: em } = parseHHMM(r.end || '23:59');
            let winStart = sh * 60 + sm;
            let winEnd = eh * 60 + em;
            if (winEnd <= winStart) winEnd += 24 * 60;
            if (startMin >= winStart && endMin <= winEnd) {
                const pricePerHour = r.pricePerHour != null ? toFiniteNumber(r.pricePerHour) : null;
                return { ok: true, pricePerHour };
            }
        }
    } catch {}
    return false;
}

function getSchemeUnitPriceForSegment(scheme: any, s: Date, e: Date, tableId?: string | null) {
    const applicable = isSchemeApplicable(scheme, s, e, tableId);
    if (!applicable || !(applicable as any).ok) return null;
    const rulePrice = (applicable as any).pricePerHour != null ? toFiniteNumber((applicable as any).pricePerHour) : null;
    const schemePrice = scheme.price != null ? toFiniteNumber(scheme.price as any) : null;
    return rulePrice ?? schemePrice ?? null;
}

function computeBreakpointsForRange(s: Date, e: Date, schemes: any[]) {
    const pts = new Set<number>();
    pts.add(s.getTime());
    pts.add(e.getTime());
    for (const scheme of schemes) {
        try {
            const rules = normalizeRulesJson((scheme as any).rulesJson);
            if (!rules) continue;
            const dow = hkDow(s);
            const baseMidnightUtc = hkMidnightUtcFromInstant(s).getTime();
            for (const r of rules) {
                const days: number[] = Array.isArray(r.daysOfWeek) ? r.daysOfWeek : [];
                if (days.length > 0 && !days.includes(dow)) continue;
                const { h: sh, m: sm } = parseHHMM(r.start || '00:00');
                const { h: eh, m: em } = parseHHMM(r.end || '23:59');
                let winStart = sh * 60 + sm;
                let winEnd = eh * 60 + em;
                if (winEnd <= winStart) winEnd += 24 * 60;
                pts.add(baseMidnightUtc + winStart * 60 * 1000);
                pts.add(baseMidnightUtc + winEnd * 60 * 1000);
            }
        } catch {}
    }
    const sorted = Array.from(pts).sort((a, b) => a - b);
    const within = sorted.filter((t) => t >= s.getTime() && t <= e.getTime());
    if (within.length === 0) return [s.getTime(), e.getTime()];
    if (within[0] !== s.getTime()) within.unshift(s.getTime());
    if (within[within.length - 1] !== e.getTime()) within.push(e.getTime());
    return within;
}

function computeComboPlans(s: Date, e: Date, schemes: any[], tableId?: string | null) {
    const totalHours = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
    if (!(totalHours > 0)) return [];

    const breakpoints = computeBreakpointsForRange(s, e, schemes);
    const segments: Array<{ start: Date; end: Date; hours: number }> = [];
    for (let i = 0; i < breakpoints.length - 1; i++) {
        const a = breakpoints[i]!;
        const b = breakpoints[i + 1]!;
        if (!(b > a)) continue;
        const segStart = new Date(a);
        const segEnd = new Date(b);
        const h = (b - a) / (60 * 60 * 1000);
        if (h <= 0) continue;
        if (segStart < s || segEnd > e) continue;
        segments.push({ start: segStart, end: segEnd, hours: h });
    }
    if (segments.length <= 1) return [];
    if (segments.length > 8) return [];

    const schemeById = new Map<string, any>();
    for (const sc of schemes) schemeById.set(String(sc.id), sc);

    const optionsPerSegment = segments.map((seg) => {
        const opts: Array<{ schemeId: string; unitPrice: number }> = [];
        for (const sc of schemes) {
            const unit = getSchemeUnitPriceForSegment(sc, seg.start, seg.end, tableId);
            if (unit == null) continue;
            opts.push({ schemeId: String(sc.id), unitPrice: unit });
        }
        opts.sort((a, b) => a.unitPrice - b.unitPrice);
        return opts.slice(0, 12);
    });
    if (optionsPerSegment.some((opts) => opts.length === 0)) return [];

    const bestByKey = new Map<string, { schemeIds: string[]; total: number }>();

    const rec = (
        idx: number,
        assignment: string[],
        durations: Map<string, number>,
        total: number,
    ) => {
        if (idx >= segments.length) {
            const used = Array.from(new Set(assignment));
            if (used.length < 2) return;
            for (const sid of used) {
                const sc = schemeById.get(sid);
                if (!sc) return;
                const minH = getSchemeMinHours((sc as any).rulesJson);
                const dur = durations.get(sid) || 0;
                const h = dur / (60 * 60 * 1000);
                if (minH != null && h + 1e-9 < minH) return;
            }
            const key = used.slice().sort().join('+');
            const prev = bestByKey.get(key);
            if (!prev || total + 1e-9 < prev.total) {
                bestByKey.set(key, { schemeIds: used.slice().sort(), total });
            }
            return;
        }
        const seg = segments[idx]!;
        const opts = optionsPerSegment[idx] || [];
        for (const opt of opts) {
            const nextAssignment = assignment.concat(opt.schemeId);
            const nextDurations = new Map(durations);
            nextDurations.set(opt.schemeId, (nextDurations.get(opt.schemeId) || 0) + (seg.end.getTime() - seg.start.getTime()));
            rec(idx + 1, nextAssignment, nextDurations, total + opt.unitPrice * seg.hours);
        }
    };
    rec(0, [], new Map(), 0);

    const out = Array.from(bestByKey.values())
        .sort((a, b) => a.total - b.total)
        .slice(0, 10)
        .map((x) => {
            const title = x.schemeIds.map((sid) => String((schemeById.get(sid) as any)?.title || sid)).join(' + ');
            const avg = x.total / totalHours;
            return {
                id: `combo:${x.schemeIds.join('+')}`,
                title: `組合：${title}`,
                description: '分段計算',
                active: true,
                tableId: tableId || null,
                rulesJson: { combo: true, schemeIds: x.schemeIds },
                minHours: null,
                effectivePricePerHour: Number.isFinite(avg) ? avg : null,
            };
        });
    return out;
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
    const now = Date.now();
    if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return res.status(400).json({ error: 'Invalid time range' });
    if (s.getTime() < now - 60_000) return res.status(400).json({ error: '不能預約已過去的時間' });
    if (!(e > s)) return res.status(400).json({ error: 'Invalid time range' });
    const overlap = await prisma.tableReservation.count({
        where: { tableId: table.id, status: { in: ['PENDING', 'CONFIRMED', 'BLOCKED'] }, AND: [{ startAt: { lt: e } }, { endAt: { gt: s } }] }
    });
    if (overlap > 0) return res.status(409).json({ error: '該時段已被預約，請選擇其他時間' });
    const data: any = { clubId, tableId: table.id, memberId, startAt: s, endAt: e, status: 'PENDING' };
    let unitPrice: number | null = null;
    let schemeMinHours: number | null = null;
    if (schemeId) {
        const sid = String(schemeId);
        if (/^combo:/i.test(sid)) {
            const raw = sid.split(':', 2)[1] || '';
            const parts = raw.split('+').map((x) => x.trim()).filter(Boolean);
            const unique = Array.from(new Set(parts));
            if (unique.length < 2) return res.status(400).json({ error: 'Invalid combo scheme' });
            const schemes = await prisma.tablePricingScheme.findMany({ where: { id: { in: unique } } });
            if (schemes.length !== unique.length) return res.status(400).json({ error: 'Pricing scheme not found' });
            if (schemes.some((sc) => sc.clubId !== clubId || sc.active !== true)) return res.status(400).json({ error: '方案不適用於此時段' });
            const canonical = unique.slice().sort().join('+');
            const plans = computeComboPlans(s, e, schemes as any[], table.id);
            const chosen = (plans as any[]).find((p) => String(p?.id || '') === `combo:${canonical}`);
            const hours = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
            const avg = chosen?.effectivePricePerHour != null ? toFiniteNumber(chosen.effectivePricePerHour) : null;
            unitPrice = avg;
            if (unitPrice == null || !(hours > 0)) return res.status(400).json({ error: '方案不適用於此時段' });
            schemeMinHours = null;
        } else {
            const scheme = await prisma.tablePricingScheme.findUnique({ where: { id: sid } });
            if (!scheme || scheme.clubId !== clubId) return res.status(400).json({ error: 'Pricing scheme not found' });
            const applicable = isSchemeApplicable(scheme as any, s, e, table.id);
            if (!applicable || !(applicable as any).ok) return res.status(400).json({ error: '方案不適用於此時段' });
            schemeMinHours = getSchemeMinHours((scheme as any).rulesJson);
            const rulePrice = (applicable as any).pricePerHour != null ? toFiniteNumber((applicable as any).pricePerHour) : null;
            const schemePrice = scheme.price != null ? toFiniteNumber(scheme.price as any) : null;
            unitPrice = rulePrice ?? schemePrice;
            if (unitPrice == null) return res.status(400).json({ error: '方案未設定價錢' });
            data.pricingSchemeId = sid;
        }
    }
    if (unitPrice == null) {
        unitPrice = table.basePrice != null ? toFiniteNumber(table.basePrice as any) : null;
    }
    if (unitPrice == null) {
        return res.status(400).json({ error: 'No applicable scheme or base price set' });
    }
    const hours = (e.getTime() - s.getTime()) / (60 * 60 * 1000);
    if (schemeMinHours != null && hours + 1e-9 < schemeMinHours) return res.status(400).json({ error: `此方案需最少購買 ${schemeMinHours} 小時` });
    data.priceQuote = String(unitPrice * hours);
    const created = await prisma.tableReservation.create({ data });
    try {
        const messageTitle = '新預約待確認';
        const m = await prisma.member.findUnique({ where: { id: memberId }, select: { name: true, member_code: true } });
        const memberName = String(m?.name || '').trim();
        const memberCode = String(m?.member_code || '').trim();
        const who = [memberCode || '無', memberName].filter(Boolean).join(' ');
        const tableName = String((table as any)?.name || '').trim() || '球枱';
        const content = `會員：${who}\n球枱：${tableName}\n時段：${formatHongKongDateTime(s)} 至 ${formatHongKongDateTime(e)}`;
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

router.post('/:clubId/reservations/:id/cancel', async (req, res) => {
    const member = await requireMember(req, res);
    if (!member) return;
    const memberId = member.id;
    const { clubId, id } = req.params;
    const r = await prisma.tableReservation.findUnique({ where: { id } });
    if (!r || r.clubId !== clubId || r.memberId !== memberId) return res.status(404).json({ error: 'Not found' });
    const { reason } = req.body || {};
    const updated = await prisma.tableReservation.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason || null } });
    res.json(updated);
});

export default router;
