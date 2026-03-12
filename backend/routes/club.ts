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

export default router;
