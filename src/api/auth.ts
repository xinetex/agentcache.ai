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
import { db } from '../db/client.js';
import { users, members, organizations } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken as verifyPortalToken } from '../../lib/jwt.js';
import { organizationInvitations } from '../db/schema.js';

type Variables = {
    user: any;
};

const app = new Hono<{ Variables: Variables }>();
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    throw new Error('[Auth] FATAL: JWT_SECRET environment variable is required in production');
}
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod';

// --- Middleware: Protect Routes ---
export const authMiddleware = async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized: Missing Token' }, 401);
    }

    const token = authHeader.split(' ')[1];

    // 1. Check Admin Token (Environment Variable)
    // Allows "Simple Admin" access without full JWT login
    if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
        c.set('user', {
            id: 'admin_superuser',
            email: 'admin@localhost',
            role: 'owner',
            plan: 'enterprise'
        });
        await next();
        return;
    }

    // 2. Check JWT (Standard Auth)
    const payload = verifyPortalToken(token);
    if (payload) {
        c.set('user', {
            id: payload.userId,
            email: payload.email,
            role: payload.role,
            orgId: payload.organizationId,
            plan: payload.plan
        });
        await next();
        return;
    }

    return c.json({ error: 'Unauthorized: Invalid Token' }, 401);
};

// --- Middleware: Role Check ---
export const requireRole = (requiredRole) => async (c, next) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const roles = ['viewer', 'member', 'admin', 'owner'];
    const userRoleIndex = roles.indexOf(user.role);
    const requiredRoleIndex = roles.indexOf(requiredRole);

    if (userRoleIndex < requiredRoleIndex) {
        return c.json({ error: `Forbidden: Requires ${requiredRole} role` }, 403);
    }

    await next();
};

const handleSignup = async (c) => {
    try {
        const { email, password, name, fullName, full_name, organizationName, invitationToken } = await c.req.json();

        if (!email || !password) {
            return c.json({ error: 'Email and password required' }, 400);
        }

        if (password.length < 8) {
            return c.json({ error: 'Password must be at least 8 characters' }, 400);
        }

        const normalizedEmail = email.toLowerCase();

        const displayName = (name || fullName || full_name || normalizedEmail.split('@')[0]).trim();
        const passwordHash = await bcrypt.hash(password, 10);
        const orgName = (organizationName || `${displayName}'s Org`).trim();
        const invitationHash = typeof invitationToken === 'string' && /^[a-f0-9]{64}$/.test(invitationToken)
            ? createHash('sha256').update(invitationToken).digest('hex')
            : null;

        const created = await db.transaction(async (tx: any) => {
            let invitation: any = null;
            if (invitationToken) {
                if (!invitationHash) throw Object.assign(new Error('This invitation link is invalid.'), { status: 400 });
                const invitations = await tx.select().from(organizationInvitations)
                    .where(and(
                        eq(organizationInvitations.tokenHash, invitationHash),
                        eq(organizationInvitations.email, normalizedEmail),
                        isNull(organizationInvitations.canceledAt),
                        isNull(organizationInvitations.acceptedAt),
                    )).for('update').limit(1);
                invitation = invitations.find((item: any) => new Date(item.expiresAt).getTime() > Date.now());
                if (!invitation) throw Object.assign(new Error('This invitation is expired, used, or belongs to another email address.'), { status: 400 });
            }

            const existing = await tx.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
            if (existing.length > 0) throw Object.assign(new Error('An account already exists for this email. Sign in to accept this invitation.'), { status: 409 });

            const role = invitation?.role || 'owner';
            const [newUser] = await tx.insert(users).values({
                email: normalizedEmail, passwordHash, name: displayName, role, plan: 'free',
            }).returning();

            let orgId: string;
            if (invitation) {
                orgId = invitation.orgId;
                await tx.insert(members).values({ userId: newUser.id, orgId, role });
                await tx.update(organizationInvitations).set({ acceptedAt: new Date() })
                    .where(eq(organizationInvitations.id, invitation.id));
            } else {
                const [newOrg] = await tx.insert(organizations).values({ name: orgName, plan: 'free' }).returning();
                orgId = newOrg.id;
                await tx.insert(members).values({ userId: newUser.id, orgId, role: 'owner' });
            }
            return { user: newUser, orgId, role, invitationAccepted: Boolean(invitation) };
        });

        const token = generateToken({
            id: created.user.id,
            email: created.user.email,
            organization_id: created.orgId,
            role: created.role,
            plan: created.user.plan
        });

        return c.json({
            token,
            user: {
                id: created.user.id,
                email: created.user.email,
                name: created.user.name,
                role: created.role,
                plan: created.user.plan,
                orgId: created.orgId,
            },
            onboarding: {
                required: !created.invitationAccepted,
                url: created.invitationAccepted ? null : '/onboarding.html'
            }
        }, 201);

    } catch (error: any) {
        console.error('[Auth] Signup error:', error?.message || 'unknown error');
        return c.json({ error: error?.message || 'Registration failed.' }, error?.status || 500);
    }
};

// --- Endpoint: Standard Login ---
app.post('/login', async (c) => {
    try {
        const { email, password, organizationId } = await c.req.json();

        if (!email || !password) {
            return c.json({ error: 'Email and password required' }, 400);
        }

        // Find user
        const usersFound = await db.select({
            id: users.id,
            email: users.email,
            passwordHash: users.passwordHash,
            name: users.name,
            role: users.role,
            plan: users.plan
        }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
        const user = usersFound[0];

        if (!user || !user.passwordHash) {
            return c.json({ error: 'Invalid credentials' }, 401);
        }


        // Verify password (if using bcrypt)
        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
            return c.json({ error: 'Invalid credentials' }, 401);
        }

        // Resolve the requested tenant only from a live membership. The browser may
        // remember the last organization, but it can never grant membership.
        const memberships = await db.select()
            .from(members)
            .where(eq(members.userId, user.id));
        const member = (typeof organizationId === 'string'
            ? memberships.find((item: any) => item.orgId === organizationId)
            : null) || memberships[0];

        const resolvedRole = member?.role || user.role || 'viewer';
        const token = generateToken({
            id: user.id,
            email: user.email,
            organization_id: member?.orgId || null,
            role: resolvedRole,
            plan: user.plan
        });
        return c.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: resolvedRole,
                plan: user.plan,
                orgId: member?.orgId || null,
            },
            onboarding: {
                required: !member?.orgId,
                url: !member?.orgId ? '/onboarding.html' : null
            }
        });

    } catch (error: any) {
        console.error('[Auth] Login error:', error);
        return c.json({ error: 'Internal Server Error', details: error.message }, 500);
    }
});

// --- Endpoint: Dev Login (Testing Only - disabled in production) ---
app.post('/dev-login', async (c) => {
    if (process.env.NODE_ENV === 'production') {
        return c.json({ error: 'Dev login is disabled in production' }, 403);
    }
    const { email } = await c.req.json();

    // Find user
    let user = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (user.length === 0) {
        // Auto-create for dev convenience if not exists
        const [newUser] = await db.insert(users).values({
            email,
            name: email.split('@')[0]
        }).returning();
        user = [newUser];

        // Assign to default org (create if missing)
        let org = await db.select().from(organizations).limit(1);
        if (org.length === 0) {
            const [newOrg] = await db.insert(organizations).values({ name: 'Dev Corp' }).returning();
            org = [newOrg];
        }

        await db.insert(members).values({
            userId: newUser.id,
            orgId: org[0].id,
            role: 'owner' // First user is owner
        });
    }

    // Get Member Role
    const member = await db.select()
        .from(members)
        .where(eq(members.userId, user[0].id))
        .limit(1);

    const resolvedRole = member[0]?.role || 'viewer';
    const token = generateToken({
        id: user[0].id,
        email: user[0].email,
        organization_id: member[0]?.orgId || null,
        role: resolvedRole,
        plan: user[0].plan
    });
    return c.json({
        token,
        user: {
            id: user[0].id,
            email: user[0].email,
            role: resolvedRole,
            orgId: member[0]?.orgId || null
        },
        onboarding: {
            required: !member[0]?.orgId,
            url: !member[0]?.orgId ? '/onboarding.html' : null
        }
    });
});

// --- Endpoint: Signup ---
app.post('/signup', handleSignup);
app.post('/register', handleSignup);

// --- Endpoint: Get Current User ---
app.get('/me', authMiddleware, async (c) => {
    const user = c.get('user'); // From JWT

    // Refresh data from DB
    const usersFound = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    const dbUser = usersFound[0];

    if (!dbUser) return c.json({ error: 'User not found' }, 404);

    // Get Org Info
    const member = await db.select({
        role: members.role,
        orgId: members.orgId,
        orgName: organizations.name
    })
        .from(members)
        .innerJoin(organizations, eq(members.orgId, organizations.id))
        .where(eq(members.userId, user.id))
        .limit(1);

    return c.json({
        user: {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            role: member[0]?.role || dbUser.role,
            plan: dbUser.plan,
            avatarUrl: dbUser.avatarUrl
        },
        organization: member[0] || null
    });
});

export default app;
