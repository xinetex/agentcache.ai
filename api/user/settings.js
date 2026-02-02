
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

export const config = {
    runtime: 'nodejs'
};

const sql = neon(process.env.DATABASE_URL);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Helper: Verify Token
function getUser(req) {
    if (!req.headers.authorization) return null;
    const token = req.headers.authorization.split(' ')[1];
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (e) {
        return null;
    }
}

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // GET: Retrieve Settings
        if (req.method === 'GET') {
            const settings = await sql`
                SELECT * FROM user_settings WHERE user_id = ${user.id}
            `;

            if (settings.length === 0) {
                // Return defaults if no row exists yet
                return res.status(200).json({
                    themePref: 'system',
                    notificationsEnabled: true,
                    sectorConfig: {
                        robotics: { unit: 'metric', safetyMargin: 0.1 },
                        finance: { riskTolerance: 'moderate' },
                        legal: { autoRedact: true }
                    }
                });
            }

            // Transform snake_case keys to camelCase for frontend
            const s = settings[0];
            return res.status(200).json({
                themePref: s.theme_pref,
                notificationsEnabled: s.notifications_enabled,
                sectorConfig: s.sector_config
            });
        }

        // PUT: Update Settings
        if (req.method === 'PUT') {
            const { themePref, notificationsEnabled, sectorConfig } = req.body;

            // Upsert (Insert if new, Update if exists)
            // Postgres ON CONFLICT requires a constraint name or column list. use user_id unique.
            await sql`
                INSERT INTO user_settings (user_id, theme_pref, notifications_enabled, sector_config, updated_at)
                VALUES (
                    ${user.id}, 
                    ${themePref || 'system'}, 
                    ${notificationsEnabled === undefined ? true : notificationsEnabled}, 
                    ${sectorConfig || {}},
                    NOW()
                )
                ON CONFLICT (user_id) 
                DO UPDATE SET
                    notifications_enabled = EXCLUDED.notifications_enabled,
                    sector_config = EXCLUDED.sector_config,
                    updated_at = NOW()
            `;

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Settings API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
