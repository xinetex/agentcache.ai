
import { db } from '../../src/db/client.js';
import { users } from '../../src/db/schema.js';
import { desc } from 'drizzle-orm';

export default async function handler(req, res) {
    // 1. Auth Check (TODO: Implement real middleware)
    // const authHeader = req.headers.authorization;
    // if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // 2. Fetch Users from DB
        let allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(50);

        // 3. SEMANTIC SEEDING (Auto-Activation)
        // If the database is empty, we seed it with initial users so the system is usable immediately.
        // This converts "Mock Data" into "Real Data" upon first activation.
        if (allUsers.length === 0) {
            console.log('[System] Seeding Initial Users...');
            const seedUsers = [
                {
                    id: 'usr_seed_1',
                    name: 'Alex (You)',
                    email: 'alex@agentcache.ai',
                    role: 'admin',
                    plan: 'enterprise',
                    createdAt: new Date(),
                },
                {
                    id: 'usr_seed_2',
                    name: 'Sarah Connor',
                    email: 'sarah@skynet.prevention',
                    role: 'editor',
                    plan: 'pro',
                    createdAt: new Date(),
                },
                {
                    id: 'usr_seed_3',
                    name: 'John Doe',
                    email: 'john@example.com',
                    role: 'viewer',
                    plan: 'free',
                    createdAt: new Date(),
                }
            ];

            // Insert into DB (works for both Real Postgres and Local Mock Store)
            await db.insert(users).values(seedUsers);

            // Re-fetch or use seed
            allUsers = seedUsers;
        }

        // 4. Transform for UI
        const userList = allUsers.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role || 'viewer',
            status: 'active', // Can derive from lastLogin later
            plan: u.plan || 'free',
            initials: u.name ? u.name.substring(0, 2).toUpperCase() : '??',
            color: getRoleColor(u.role)
        }));

        return res.status(200).json({ users: userList });

    } catch (error) {
        console.error('Admin User Fetch Error:', error);
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
}

function getRoleColor(role) {
    if (role === 'admin') return 'bg-gradient-to-br from-indigo-500 to-purple-500';
    if (role === 'editor') return 'bg-emerald-600';
    return 'bg-gray-700';
}
