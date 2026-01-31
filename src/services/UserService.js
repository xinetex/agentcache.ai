
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import { desc } from 'drizzle-orm';

/**
 * Service to handle User management and retrieval.
 */
export class UserService {
    /**
     * @param {Object} dbClient - Drizzle ORM DB client
     */
    constructor(dbClient) {
        this.db = dbClient;
    }

    /**
     * Fetches all users for the admin list with timeout protection.
     * @returns {Promise<Array>} List of mapped user objects
     */
    async getAllUsers() {
        console.log('[UserService] Fetching all users...');

        // Add timeout race
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DB_TIMEOUT')), 5000)
        );

        const dbQuery = this.db.select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            plan: users.plan,
            status: users.status,
            last_active: users.updatedAt,
            created_at: users.createdAt
        })
            .from(users)
            .orderBy(desc(users.createdAt))
            .limit(100);

        const allUsers = await Promise.race([dbQuery, timeoutPromise]);

        console.log(`[UserService] Fetched ${allUsers.length} users successfully.`);

        // Map to format expected by Admin.jsx
        return allUsers.map(u => ({
            id: u.id,
            name: u.name || 'Unknown',
            email: u.email,
            role: u.role || 'user',
            status: u.status || 'active',
            lastActive: u.last_active ? new Date(u.last_active).toLocaleString() : 'N/A'
        }));
    }
}

// Export singleton instance
export const userService = new UserService(db);
