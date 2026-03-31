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
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { generateToken, verifyToken as verifyPortalToken } from '../../lib/jwt.js';

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
        const { email, password, name, fullName, full_name, organizationName } = await c.req.json();

        if (!email || !password) {
            return c.json({ error: 'Email and password required' }, 400);
        }

        if (password.length < 8) {
            return c.json({ error: 'Password must be at least 8 characters' }, 400);
        }

        const normalizedEmail = email.toLowerCase();

        // Check existing
        const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
        if (existing.length > 0) {
            return c.json({ error: 'User already exists' }, 409);
        }

        const displayName = (name || fullName || full_name || normalizedEmail.split('@')[0]).trim();
        const orgName = (organizationName || `${displayName}'s Org`).trim();

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // 1. Create User
        const [newUser] = await db.insert(users).values({
            email: normalizedEmail,
            passwordHash,
            name: displayName,
            role: 'owner',
            plan: 'free'
        }).returning();

        // 2. Create Default Organization
        const [newOrg] = await db.insert(organizations).values({
            name: orgName,
            plan: 'free'
        }).returning();

        // 3. Add Member
        await db.insert(members).values({
            userId: newUser.id,
            orgId: newOrg.id,
            role: 'owner'
        });

        // 4. Generate Token
        const token = generateToken({
            id: newUser.id,
            email: newUser.email,
            organization_id: newOrg.id,
            role: 'owner',
            plan: newUser.plan
        });

        return c.json({
            token,
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                role: 'owner',
                plan: newUser.plan
            },
            onboarding: {
                required: true,
                url: '/onboarding.html'
            }
        }, 201);

    } catch (error: any) {
        console.error('[Auth] Signup error:', error);
        return c.json({ error: 'Internal Server Error', details: error.message }, 500);
    }
};

// --- Endpoint: Standard Login ---
app.post('/login', async (c) => {
    try {
        const { email, password } = await c.req.json();

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

        // Get Member Role from Org
        const member = await db.select()
            .from(members)
            .where(eq(members.userId, user.id))
            .limit(1);

        const resolvedRole = member[0]?.role || user.role || 'viewer';
        const token = generateToken({
            id: user.id,
            email: user.email,
            organization_id: member[0]?.orgId || null,
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
                plan: user.plan
            },
            onboarding: {
                required: !member[0]?.orgId,
                url: !member[0]?.orgId ? '/onboarding.html' : null
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
