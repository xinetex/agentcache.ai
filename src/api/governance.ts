/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { Hono } from 'hono';
import { createHash, randomBytes } from 'node:crypto';
import { db } from '../db/client.js';
import { organizations, users, members, apiKeys, organizationInvitations } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { authMiddleware, requireRole } from './auth.js';
import { generateToken } from '../../lib/jwt.js';

const app = new Hono<{ Variables: { user: any } }>();

// Apply Auth Middleware to all routes
app.use('*', authMiddleware);

async function getCurrentOrganizationMembership(user: any) {
    if (!user?.id || !user?.orgId) return null;
    const rows = await db.select({ role: members.role, orgId: members.orgId })
        .from(members)
        .where(and(eq(members.userId, user.id), eq(members.orgId, user.orgId)))
        .limit(1);
    return rows[0] || null;
}

async function requireOrganizationManager(c: any) {
    const user = c.get('user');
    const membership = await getCurrentOrganizationMembership(user);
    if (!membership) return { error: c.json({ error: 'Organization membership required.' }, 403) };
    if (!['owner', 'admin'].includes(String(membership.role).toLowerCase())) {
        return { error: c.json({ error: 'Organization owner or admin role required.' }, 403) };
    }
    return { user, membership };
}

app.get('/memberships', async (c) => {
    const user = c.get('user');
    const memberships = await db.select().from(members).where(eq(members.userId, user.id));
    const results = await Promise.all(memberships.map(async (membership) => {
        const [organization] = await db.select({ id: organizations.id, name: organizations.name })
            .from(organizations).where(eq(organizations.id, membership.orgId)).limit(1);
        return organization ? { ...organization, role: membership.role } : null;
    }));
    return c.json({ memberships: results.filter(Boolean), activeOrganizationId: user.orgId || null });
});

app.post('/switch-organization', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.organizationId !== 'string') return c.json({ error: 'Choose an organization.' }, 400);
    const [membership] = await db.select().from(members)
        .where(and(eq(members.userId, user.id), eq(members.orgId, body.organizationId))).limit(1);
    if (!membership) return c.json({ error: 'You are not a member of that organization.' }, 403);
    const [account] = await db.select({ id: users.id, email: users.email, name: users.name, plan: users.plan })
        .from(users).where(eq(users.id, user.id)).limit(1);
    const [organization] = await db.select({ id: organizations.id, name: organizations.name })
        .from(organizations).where(eq(organizations.id, body.organizationId)).limit(1);
    if (!account || !organization) return c.json({ error: 'Organization or account was not found.' }, 404);
    const token = generateToken({
        id: account.id, email: account.email, organization_id: organization.id, role: membership.role, plan: account.plan,
    });
    return c.json({
        token,
        user: { id: account.id, email: account.email, name: account.name, role: membership.role, plan: account.plan, orgId: organization.id },
        organization,
    });
});

app.get('/invitations', async (c) => {
    const user = c.get('user');
    const membership = await getCurrentOrganizationMembership(user);
    if (!membership) return c.json({ error: 'Organization membership required.' }, 403);
    const invitations = await db.select({
        id: organizationInvitations.id,
        email: organizationInvitations.email,
        role: organizationInvitations.role,
        expiresAt: organizationInvitations.expiresAt,
        acceptedAt: organizationInvitations.acceptedAt,
        canceledAt: organizationInvitations.canceledAt,
        createdAt: organizationInvitations.createdAt,
    }).from(organizationInvitations)
        .where(eq(organizationInvitations.orgId, membership.orgId));
    return c.json({ invitations: invitations.filter((invite) => !invite.canceledAt && !invite.acceptedAt && new Date(invite.expiresAt).getTime() > Date.now()) });
});

app.post('/invitations', async (c) => {
    const authorized = await requireOrganizationManager(c);
    if (authorized.error) return authorized.error;
    const body = await c.req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = body.role;
    if (!/^\S+@\S+\.\S+$/.test(email)) return c.json({ error: 'Enter a valid email address.' }, 400);
    if (!['admin', 'member', 'viewer'].includes(role)) return c.json({ error: 'Invite role must be admin, member, or viewer.' }, 400);

    const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingUser) {
        const existingMembership = await db.select({ id: members.id }).from(members)
            .where(and(eq(members.userId, existingUser.id), eq(members.orgId, authorized.membership.orgId)))
            .limit(1);
        if (existingMembership.length) return c.json({ error: 'This person is already in the organization.' }, 409);
    }

    const currentInvites = await db.select({ id: organizationInvitations.id, expiresAt: organizationInvitations.expiresAt })
        .from(organizationInvitations)
        .where(and(
            eq(organizationInvitations.orgId, authorized.membership.orgId),
            eq(organizationInvitations.email, email),
            isNull(organizationInvitations.acceptedAt),
            isNull(organizationInvitations.canceledAt),
        ));
    if (currentInvites.some((invite) => new Date(invite.expiresAt).getTime() > Date.now())) {
        return c.json({ error: 'A current invitation already exists for this email.' }, 409);
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [invitation] = await db.insert(organizationInvitations).values({
        orgId: authorized.membership.orgId,
        email,
        role,
        tokenHash,
        invitedByUserId: authorized.user.id,
        expiresAt,
    }).returning({ id: organizationInvitations.id });
    const configuredOrigin = process.env.PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const origin = configuredOrigin
        ? new URL(configuredOrigin.startsWith('http') ? configuredOrigin : `https://${configuredOrigin}`).origin
        : new URL(c.req.url).origin;
    return c.json({
        invitation: { id: invitation.id, email, role, expiresAt },
        inviteUrl: `${origin}/register?invite=${token}`,
    }, 201);
});

app.delete('/invitations/:id', async (c) => {
    const authorized = await requireOrganizationManager(c);
    if (authorized.error) return authorized.error;
    const canceled = await db.transaction(async (tx: any) => {
        const [invite] = await tx.select().from(organizationInvitations)
            .where(eq(organizationInvitations.id, c.req.param('id'))).for('update').limit(1);
        if (!invite || invite.orgId !== authorized.membership.orgId || invite.acceptedAt || invite.canceledAt || new Date(invite.expiresAt).getTime() <= Date.now()) return false;
        const updated = await tx.update(organizationInvitations).set({ canceledAt: new Date() })
            .where(eq(organizationInvitations.id, invite.id)).returning({ id: organizationInvitations.id });
        return updated.length > 0;
    });
    if (!canceled) return c.json({ error: 'Pending invitation not found.' }, 404);
    return c.json({ success: true });
});

app.post('/invitations/accept', async (c) => {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({}));
    const rawToken = typeof body.token === 'string' ? body.token : '';
    if (!/^[a-f0-9]{64}$/.test(rawToken)) return c.json({ error: 'Invitation link is invalid.' }, 400);
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const [account] = await db.select({ id: users.id, email: users.email, name: users.name, plan: users.plan })
        .from(users).where(eq(users.id, user.id)).limit(1);
    if (!account) return c.json({ error: 'Signed-in account not found.' }, 401);

    try {
        const accepted = await db.transaction(async (tx: any) => {
            const matches = await tx.select().from(organizationInvitations)
                .where(and(
                    eq(organizationInvitations.tokenHash, tokenHash),
                    eq(organizationInvitations.email, String(account.email).toLowerCase()),
                    isNull(organizationInvitations.acceptedAt),
                    isNull(organizationInvitations.canceledAt),
                )).for('update').limit(1);
            const invitation = matches.find((item: any) => new Date(item.expiresAt).getTime() > Date.now());
            if (!invitation) throw Object.assign(new Error('Invitation is expired, used, or belongs to another email address.'), { status: 404 });
            const [existingMembership] = await tx.select({ id: members.id }).from(members)
                .where(and(eq(members.userId, user.id), eq(members.orgId, invitation.orgId))).limit(1);
            if (existingMembership) throw Object.assign(new Error('You are already a member of this organization.'), { status: 409 });
            await tx.insert(members).values({ userId: user.id, orgId: invitation.orgId, role: invitation.role });
            await tx.update(organizationInvitations).set({ acceptedAt: new Date() })
                .where(eq(organizationInvitations.id, invitation.id));
            return invitation;
        });
        const [organization] = await db.select({ name: organizations.name })
            .from(organizations).where(eq(organizations.id, accepted.orgId)).limit(1);
        const token = generateToken({
            id: account.id,
            email: account.email,
            organization_id: accepted.orgId,
            role: accepted.role,
            plan: account.plan,
        });
        return c.json({
            success: true,
            token,
            user: { id: account.id, email: account.email, name: account.name, role: accepted.role, plan: account.plan, orgId: accepted.orgId },
            organization: organization?.name || null,
        });
    } catch (error: any) {
        return c.json({ error: error?.message || 'Could not accept invitation.' }, error?.status || 500);
    }
});

// GET /api/governance/org - Get current org details
app.get('/org', requireRole('viewer'), async (c) => {
    const user = c.get('user');
    const membership = await getCurrentOrganizationMembership(user);
    if (!membership) return c.json({ error: 'Organization membership required.' }, 403);
    const org = await db.select().from(organizations).where(eq(organizations.id, membership.orgId)).limit(1);

    return c.json({
        ...org[0],
        role: membership.role
    });
});

// GET /api/governance/members - List team members
app.get('/members', requireRole('viewer'), async (c) => {
    const user = c.get('user');
    const membership = await getCurrentOrganizationMembership(user);
    if (!membership) return c.json({ error: 'Organization membership required.' }, 403);
    // Fetch members of the user's org
    const orgMembers = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: members.role
    })
        .from(members)
        .innerJoin(users, eq(members.userId, users.id))
        .where(eq(members.orgId, membership.orgId));

    return c.json({ members: orgMembers });
});

// GET /api/governance/keys - List API keys
app.get('/keys', requireRole('admin'), async (c) => {
    const user = c.get('user');
    const authorized = await requireOrganizationManager(c);
    if (authorized.error) return authorized.error;
    const keys = await db.select().from(apiKeys).where(eq(apiKeys.orgId, authorized.membership.orgId));

    return c.json({
        apiKeys: keys.map(k => ({
            ...k,
            hash: '********' // Redact hash
        }))
    });
});

// POST /api/governance/presets - Switch Reality (Mock for now)
app.post('/presets', requireRole('owner'), async (c) => {
    const body = await c.req.json();
    return c.json({ success: true, mode: body.mode });
});

// GET /api/governance/presets - Get current mode
app.get('/presets', requireRole('viewer'), async (c) => {
    return c.json({ mode: 'Darwin' });
});

// --- LINGUISTIC GOVERNANCE & ROSETTA BRIDGE (GlossaGuard) ---

// POST /api/governance/linguistic/scan - Scans text/transcript for synthetic argot & covert channels
app.post('/linguistic/scan', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = body.text || body.message || body.transcript || '';
    
    // Lazy-load linguistic guard
    const { evaluateLinguisticPosture } = await import('../../lib/linguistic-guard.js');
    const result = evaluateLinguisticPosture(text, body.options || {});
    return c.json(result);
});

// GET /api/governance/linguistic/codebook - Returns registered shorthand definitions
app.get('/linguistic/codebook', async (c) => {
    const { globalRosettaBridge } = await import('../../lib/rosetta-bridge.js');
    return c.json({ codebook: globalRosettaBridge.toObject() });
});

// POST /api/governance/linguistic/decompile - Decompiles synthetic argot into plain English
app.post('/linguistic/decompile', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const text = body.text || body.message || '';
    const { globalRosettaBridge } = await import('../../lib/rosetta-bridge.js');
    const result = globalRosettaBridge.decompile(text);
    return c.json(result);
});

// POST /api/governance/grounded/verify - Verifies action contracts, invariants and emits GroundedReceipt
app.post('/grounded/verify', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { sanitizeToolArguments, validateNamespaceBoundary, createGroundedReceipt } = await import('../../lib/grounded-verifier.js');
    
    const nsCheck = validateNamespaceBoundary(body.key || 'action', body.namespace || 'default');
    if (!nsCheck.valid) {
        return c.json({ valid: false, error: nsCheck.error }, 400);
    }

    const argCheck = sanitizeToolArguments(body.args || {});
    if (!argCheck.safe) {
        return c.json({ valid: false, error: argCheck.violations.join('; '), violations: argCheck.violations }, 400);
    }

    const receipt = createGroundedReceipt({
        runId: body.runId,
        agentId: body.agentId,
        namespace: nsCheck.namespace,
        step: body.step || 1,
        intent: body.intent || 'Action invocation',
        tool: body.tool,
        spentUsd: body.spentUsd || 0,
        savedUsd: body.savedUsd || 0,
    });

    return c.json({ valid: true, receipt });
});

export default app;
