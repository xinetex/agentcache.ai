
import { createHash } from 'crypto';
import { db } from '../db/client.js'; // Assuming Drizzle client export
import { bancache, bannerAnalysis } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { ShodanHost } from '../lib/shodan.js';

export interface AnalyzedBanner {
    hash: string;
    bannerText: string;
    analysis?: {
        riskScore: number;
        classification: string;
        reasoning: string;
        vulnerabilities: any[];
    }
}

export class BancacheService {

    /**
     * Compute SHA256 hash of a banner string
     */
    static hashBanner(text: string): string {
        return createHash('sha256').update(text).digest('hex');
    }

    /**
     * Ingest a raw banner. 
     * - Checks if it exists.
     * - If Miss: Inserts it.
     * - If Hit: Updates 'last_seen_at' and increments count.
     * Returns the hash.
     */
    async ingest(bannerText: string): Promise<string> {
        if (!bannerText) return '';

        const hash = BancacheService.hashBanner(bannerText);

        // Upsert (Insert or Update)
        await db.insert(bancache)
            .values({
                hash,
                bannerText,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
                seenCount: 1
            })
            .onConflictDoUpdate({
                target: bancache.hash,
                set: {
                    lastSeenAt: new Date(),
                    seenCount: sql`${bancache.seenCount} + 1`
                }
            });

        return hash;
    }

    /**
     * Retrieve analysis for a banner hash
     */
    async getAnalysis(hash: string): Promise<AnalyzedBanner | null> {
        const result = await db.select()
            .from(bancache)
            .leftJoin(bannerAnalysis, eq(bancache.hash, bannerAnalysis.bannerHash))
            .where(eq(bancache.hash, hash))
            .limit(1);

        if (result.length === 0) return null;

        const row = result[0];
        const analysis = row.banner_analysis;

        return {
            hash: row.bancache.hash,
            bannerText: row.bancache.bannerText,
            analysis: analysis ? {
                riskScore: analysis.riskScore || 0,
                classification: analysis.classification || 'Unknown',
                reasoning: analysis.reasoning || '',
                vulnerabilities: analysis.vulnerabilities as any[] || []
            } : undefined
        };
    }

    /**
     * Bulk Ingest from Shodan Host Data
     */
    async ingestHost(host: ShodanHost) {
        const ingestedHashes = [];

        for (const service of host.data) {
            // Construct a meaningful banner string usually from 'data' or 'product' + 'version'
            // Shodan 'data' field is the raw banner
            const rawBanner = (service as any).data || '';
            if (rawBanner) {
                const hash = await this.ingest(rawBanner);
                ingestedHashes.push({ port: service.port, hash });
            }
        }
        return ingestedHashes;
    }
}
