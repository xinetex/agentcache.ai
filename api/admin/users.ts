
import { db } from '../../src/db/client.js';
import { users } from '../../src/db/schema.js';
import { desc } from 'drizzle-orm';

export default async function handler(req, res) {
    // 1. Auth Check (TODO: Implement real middleware)
    // const authHeader = req.headers.authorization;
    // if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // 2. Fetch Users from DB
        const allUsers = await db.select().from(users).orderBy(desc(users.createdAt)).limit(50);

        // 3. Transform for UI
        // If DB is empty (common in dev), provide high-quality mock data so Admin UI isn't broken
        let userList = allUsers.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role || 'viewer',
            status: 'active', // Default for now
            plan: u.plan || 'free',
            initials: u.name ? u.name.substring(0, 2).toUpperCase() : '??',
            color: 'bg-indigo-500' // Default color
        }));

        if (userList.length === 0) {
            userList = [
                {
                    id: 'usr_mock_1',
                    name: 'Alex (You)',
                    email: 'alex@agentcache.ai',
                    role: 'admin',
                    status: 'active',
                    plan: 'enterprise',
                    initials: 'AL',
                    color: 'bg-gradient-to-br from-indigo-500 to-purple-500'
                },
                {
                    id: 'usr_mock_2',
                    name: 'Sarah Connor',
                    email: 'sarah@skynet.prevention',
                    role: 'editor',
                    status: 'active',
                    plan: 'pro',
                    initials: 'SC',
                    color: 'bg-emerald-600'
                },
                {
                    id: 'usr_mock_3',
                    name: 'John Doe',
                    email: 'john@example.com',
                    role: 'viewer',
                    status: 'offline',
                    plan: 'free',
                    initials: 'JD',
                    color: 'bg-gray-700'
                }
            ];
        }

        return res.status(200).json({ users: userList });

    } catch (error) {
        console.error('Admin User Fetch Error:', error);
        return res.status(500).json({ error: 'Failed to fetch users' });
    }
}
