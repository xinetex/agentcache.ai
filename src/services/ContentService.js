import { db } from '../db/client.js';
import { lanes, cards } from '../db/schema.js';
import { asc, eq } from 'drizzle-orm';
import { DEFAULT_LANES, DEFAULT_CARDS } from '../config/bentoDefaults.js';

export class ContentService {
    async getContent(userId) {
        // userId argument available for future multi-tenant logic
        // Current implementation is global/admin focused

        const dbPromise = Promise.all([
            db.select().from(lanes).orderBy(asc(lanes.id)),
            db.select().from(cards)
        ]);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DB_TIMEOUT')), 5000)
        );

        const [lanesData, cardsData] = await Promise.race([dbPromise, timeoutPromise]);

        // Auto-seed if empty
        if (!lanesData || lanesData.length === 0) {
            console.log('[ContentService] Database empty. Auto-seeding defaults...');
            await Promise.all([
                ...DEFAULT_LANES.map(l => db.insert(lanes).values(l).onConflictDoNothing()),
                ...DEFAULT_CARDS.map(c => db.insert(cards).values(c).onConflictDoNothing())
            ]);

            // Re-fetch
            const [newLanes, newCards] = await Promise.all([
                db.select().from(lanes).orderBy(asc(lanes.id)),
                db.select().from(cards)
            ]);

            return { lanes: newLanes, cards: newCards };
        }

        return { lanes: lanesData, cards: cardsData };
    }

    async upsertCard(card) {
        const { id, laneId, template, data } = card;
        if (!id || !laneId || !data) throw new Error('Missing required fields');

        await db.insert(cards).values({
            id,
            laneId,
            template: template || 'standard',
            data: data
        })
            .onConflictDoUpdate({
                target: cards.id,
                set: { laneId, template, data }
            });

        return { success: true, id };
    }

    async deleteCard(cardId) {
        if (!cardId) throw new Error('Missing cardId');
        await db.delete(cards).where(eq(cards.id, cardId));
        return { success: true, id: cardId };
    }
}

export const contentService = new ContentService();
