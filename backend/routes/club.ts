import express from 'express';
import { CLUB_SCOPED_FEATURE_KEYS, getClubFeatureAssignment, getClubFeatureAssignments } from '../clubFeatureAccess.js';
import { getMyClubId, requireClubAdmin, requireMember } from '../src/core/club/access.js';
import { prisma } from '../src/core/db/prisma.js';
import { isFeatureEnabled } from '../src/core/features/featureAccess.js';
import { listResolvedModuleStates, syncModuleRegistry } from '../src/core/modules/config.js';
import { getClubHighbreakSettings, getEffectiveClubHighbreakSettings, updateClubHighbreakSettings } from '../src/core/modules/highbreakSettings.js';
import { createBookingRouter } from '../src/plugins/booking/router.js';
import { createClubMessageRouter } from '../src/plugins/club-messages/router.js';
import { createClubHighbreakRouter } from '../src/plugins/highbreak/router.js';
import { createLiveRouter } from '../src/plugins/live/router.js';
import { createPointsRouter } from '../src/plugins/points/router.js';
import { createClubQrSessionRouter } from '../src/plugins/qr-session/clubRouter.js';
import { createTournamentRouter } from '../src/plugins/tournaments/router.js';

const router = express.Router();

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

router.get('/modules/manage', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
        try {
            await syncModuleRegistry();
        } catch {}
        const modules = (await listResolvedModuleStates()).filter((row) => row.supportsVenueAdmin);
        const featureKeys = modules
            .map((row) => String(row.featureFlagKey || '').trim())
            .filter((key): key is typeof CLUB_SCOPED_FEATURE_KEYS[number] => CLUB_SCOPED_FEATURE_KEYS.includes(key as any));
        const assignmentMapByKey: Record<string, ReturnType<typeof getClubFeatureAssignment> extends Promise<infer T> ? T : never> = {} as any;
        if (featureKeys.length > 0) {
            const assignmentRows = await Promise.all(
                featureKeys.map(async (featureKey) => [featureKey, await getClubFeatureAssignments(prisma, [clubId], featureKey)] as const)
            );
            for (const [featureKey, map] of assignmentRows) {
                assignmentMapByKey[featureKey] = map[clubId] as any;
            }
        }
        res.json({
            clubId,
            modules: modules.map((row) => {
                const featureKey = String(row.featureFlagKey || '').trim();
                const assignment = featureKey ? assignmentMapByKey[featureKey] : null;
                const assignedEnabled = row.supportsClubAssignment
                    ? (assignment?.assignedEnabled ?? false)
                    : true;
                const effectiveEnabled = row.enabledGlobally && assignedEnabled;
                return {
                    code: row.code,
                    label: row.label,
                    description: row.description,
                    category: row.category,
                    pluginId: row.pluginId,
                    featureFlagKey: row.featureFlagKey || null,
                    supportsClubAssignment: !!row.supportsClubAssignment,
                    supportsPublicRoutes: row.supportsPublicRoutes,
                    supportsHomeSection: row.supportsHomeSection,
                    supportsVenueAdmin: row.supportsVenueAdmin,
                    enabledGlobally: row.enabledGlobally,
                    allowClubEnable: row.allowClubEnable,
                    publicVisible: row.publicVisible,
                    homeVisible: row.homeVisible,
                    effectivePublicVisible: row.effectivePublicVisible,
                    effectiveHomeVisible: row.effectiveHomeVisible,
                    explicitEnabled: assignment?.explicitEnabled ?? null,
                    assignedEnabled,
                    assignmentSource: assignment?.source ?? (row.supportsClubAssignment ? 'default_off' : 'global_only'),
                    assignmentUpdatedAt: assignment?.updatedAt ?? null,
                    effectiveEnabled,
                };
            }),
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.get('/public', async (req, res) => {
    try {
        const qRaw = req.query.q ?? req.query.keyword ?? '';
        const q = String(qRaw || '').trim();
        const regionCode = String(req.query.regionCode || '').trim().toUpperCase();
        const districtCode = String(req.query.districtCode || '').trim().toUpperCase();
        const limitRaw = req.query.limit ?? '';
        const limitNum = Number(limitRaw);
        const take = Number.isFinite(limitNum) ? Math.max(1, Math.min(200, Math.floor(limitNum))) : 50;
        const now = new Date();

        const memberWhere: any = {
            role: 'ADMIN',
            is_enabled: true,
            OR: [
                { access_expires_at: null },
                { access_expires_at: { gt: now } },
            ],
        };
        if (regionCode) memberWhere.region_code = regionCode;
        if (districtCode) memberWhere.district_code = districtCode;

        const where: any = {
            publicEnabled: true,
            member: memberWhere,
        };

        if (q) {
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { intro: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { member: { email: { contains: q, mode: 'insensitive' } } },
                { member: { phone: { contains: q, mode: 'insensitive' } } },
                { member: { phone_e164: { contains: q, mode: 'insensitive' } } },
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
                email: true,
                logoUrl: true,
                member: {
                    select: {
                        name: true,
                        email: true,
                        phone: true,
                        phone_e164: true,
                        region_code: true,
                        district_code: true,
                    }
                },
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

router.get('/highbreak/settings', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
        const result = await getEffectiveClubHighbreakSettings(clubId);
        res.json({
            clubId,
            ...result,
        });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
});

router.put('/highbreak/settings', async (req, res) => {
    const member = await requireClubAdmin(req, res);
    if (!member) return;
    const clubId = await getMyClubId(member.id);
    if (!clubId) return res.status(404).json({ error: 'Club not found' });
    try {
        const body = req.body || {};
        const patch: Record<string, any> = {};
        if (body.displayThresholdMode !== undefined) {
            patch.displayThresholdMode = String(body.displayThresholdMode || '').trim().toUpperCase();
        }
        if (body.displayThresholdDefault !== undefined) {
            patch.displayThresholdDefault = Number(body.displayThresholdDefault);
        }
        if (body.leaderboardScopeMode !== undefined) {
            patch.leaderboardScopeMode = String(body.leaderboardScopeMode || '').trim().toUpperCase();
        }
        if (body.leaderboardScopeDefault !== undefined) {
            patch.leaderboardScopeDefault = String(body.leaderboardScopeDefault || '').trim().toUpperCase();
        }
        if (Object.keys(patch).length === 0) {
            return res.status(400).json({ error: 'no_valid_fields' });
        }
        const clubSettings = await updateClubHighbreakSettings(clubId, patch);
        const effective = await getEffectiveClubHighbreakSettings(clubId);
        res.json({
            ok: true,
            clubId,
            clubSettings,
            moduleSettings: effective.moduleSettings,
            effectiveMinPoints: effective.effectiveMinPoints,
            effectiveScope: effective.effectiveScope,
        });
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

router.use(createTournamentRouter());
router.use(createClubHighbreakRouter());
router.use(createPointsRouter());
router.use(createClubQrSessionRouter());
router.use(createBookingRouter());
router.use(createLiveRouter());
router.use(createClubMessageRouter());

export default router;
