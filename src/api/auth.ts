import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { db } from '../db/client.js';
import { users, members, organizations } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const app = new Hono();
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_do_not_use_in_prod';

// --- Middleware: Protect Routes ---
export const authMiddleware = async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized: Missing Token' }, 401);
    }

    const token = authHeader.split(' ')[1];
    try {
        const payload = await verify(token, JWT_SECRET);
        c.set('user', payload);

        // Optional: Fetch fresh role from DB if needed, but payload is faster
        // const member = await db.query.members.findFirst(...)

        await next();
    } catch (err) {
        return c.json({ error: 'Unauthorized: Invalid Token' }, 401);
    }
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

        const payload = {
            id: user.id,
            email: user.email,
            role: user.role, // Default to user role if member role missing
            orgId: member[0]?.orgId,
            plan: user.plan,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24h
        };

        const token = await sign(payload, JWT_SECRET);
        return c.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                plan: user.plan
            }
        });

    } catch (error: any) {
        console.error('[Auth] Login error:', error);
        return c.json({ error: 'Internal Server Error', details: error.message }, 500);
    }
});

// --- Endpoint: Dev Login (Testing Only) ---
app.post('/dev-login', async (c) => {
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

    const payload = {
        id: user[0].id,
        email: user[0].email,
        role: member[0]?.role || 'viewer',
        orgId: member[0]?.orgId,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 // 24h
    };

    const token = await sign(payload, JWT_SECRET);
    return c.json({ token, user: payload });
});

export default app;
