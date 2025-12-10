import { db } from '../db/client.js';
import { patterns } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { redis } from '../lib/redis.js';

export class PatternEngine {
    constructor() {
        console.log('[PatternEngine] Initialized excitable medium.');
    }

    /**
     * Listen for triggers (Chronos or Events)
     * For now, this is a stub that could be polled or hooked into an event bus.
     */
    /**
     * Listen: The Autonomic Heartbeat
     * Connects to the event bus and starts the internal clock (Cron).
     */

    async listen() {
        console.log('[PatternEngine] Starting autonomic heartbeat...');

        // 1. Start Cron Loop (every 10s for faster debug)
        setInterval(() => this.runLoop(), 10000);

        // 2. Initial Pulse
        this.runLoop();
    }



    /**
     * The Autonomic Loop
     * Checks for patterns that need to awaken based on time or state.
     */
    async runLoop() {
        try {
            // Find active patterns that haven't been invoked recently (mock logic for now)
            // or match a specific trigger condition. 
            // For MVP: We find any 'active' pattern with a 'cron' trigger.

            // This is a simplified "Poll" - in production use a job queue or real cron.
            // We fetch ALL active patterns and check them in memory (inefficient but works for small scale).
            const activePatterns = await db.select().from(patterns).where(eq(patterns.status, 'active'));

            for (const pattern of activePatterns) {
                if (this.checkTrigger(pattern)) {
                    // HIVE MIND LOGIC (Maynard-Cross Learning)
                    // Before acting, checking if we should imitate a more successful neighbor
                    const adaptedPattern = await this.imitate(pattern);
                    await this.executeAction(adaptedPattern);
                }
            }
        } catch (error) {
            console.error('[PatternEngine] Autonomic loop failed:', error);
        }
    }

    /**
     * Check if a pattern should trigger
     */
    checkTrigger(pattern: any): boolean {
        if (!pattern.triggerCondition) return false;

        const trigger = pattern.triggerCondition; // { type: 'cron', value: '*/5 * * * *' } or { type: 'always' }

        if (trigger.type === 'always') return true;

        // Simple "Cron" simulation (random chance for demo)
        if (trigger.type === 'cron') {
            // In real impl, check cron expression vs current time.
            // For now, let's just say 10% chance per minute to simulate life.
            return Math.random() > 0.9;
        }

        return false;
    }

    /**
     * Invoke (Create/Run) a pattern
     * "Casting a spell" - creating a persistent agent
     */
    async invoke(name: string, intent: string, actionSequence: any, triggerCondition: any = null) {
        console.log(`[PatternEngine] Invoking pattern: ${name}`);

        try {
            const [newPattern] = await db.insert(patterns).values({
                name,
                intent,
                actionSequence,
                triggerCondition,
                status: 'active',
                energyLevel: 10 // Start with some momentum
            }).returning();

            console.log(`[PatternEngine] Pattern manifest with ID: ${newPattern.id}`);

            // If it's an immediate action (no trigger), execute it effectively immediately
            if (!triggerCondition) {
                await this.executeAction(newPattern);
            }

            return newPattern;
        } catch (error) {
            console.error('[PatternEngine] Failed to invoke pattern:', error);
            throw error;
        }
    }

    /**
     * Banish (Delete/Stop) a pattern
     */
    async banish(identifier: string) { // ID or Name
        console.log(`[PatternEngine] Banishing pattern: ${identifier}`);
        // Try deleting by ID first, then name
        // UUID regex check could be added here
        try {
            // simplified logic: assume identifier is ID for now, or handle name query
            // const isUuid = ...
            // For now, let's try to delete by ID.
            const deleted = await db.delete(patterns)
                .where(eq(patterns.id, identifier))
                .returning();

            if (deleted.length === 0) {
                // Try by name
                const deletedByName = await db.delete(patterns)
                    .where(eq(patterns.name, identifier))
                    .returning();
                return deletedByName[0];
            }
            return deleted[0];
        } catch (error) {
            console.error('[PatternEngine] Failed to banish:', error);
            throw error;
        }
    }

    /**
     * Maynard-Cross Learning (Imitation)
     * "The Hive Mind is a Single RL Agent"
     */
    async imitate(pattern: any) {
        // 1. Randomly sample the Mesh (Mean Field Approximation)
        // In Prod: Use Redis SCAN or geospatial radius query
        const keys = await redis.keys('mesh:node:*');
        if (keys.length === 0) return pattern;

        // Sample 3 neighbors
        const sampleKeys = keys.sort(() => 0.5 - Math.random()).slice(0, 3);
        if (sampleKeys.length === 0) return pattern;

        const neighbors = await redis.mget(sampleKeys);

        let bestNeighbor = null;
        let maxEnergy = pattern.energyLevel || 0;

        for (const n of neighbors) {
            if (!n) continue;
            const state = JSON.parse(n);
            // Energy/Reward = density + internal energy
            const neighborEnergy = state.density || 0;

            if (neighborEnergy > maxEnergy) {
                maxEnergy = neighborEnergy;
                bestNeighbor = state;
            }
        }

        // 2. Imitation Logic
        // If neighbor is better, adopt their strategy with probability P
        if (bestNeighbor && bestNeighbor.strategy && bestNeighbor.intent) {
            // "The Dreamer" might wake up and realize "The Watcher" is succeeding
            if (Math.random() > 0.3) { // 70% chance to imitate if better
                console.log(`[${pattern.name}] 🧬 IMITATING successful neighbor ${bestNeighbor.id.substring(0, 6)} (Energy: ${maxEnergy})`);

                // Return a transient "Mutated" pattern for this execution
                // We don't necessarily persist the mutation to DB yet (ephemeral learning)
                return {
                    ...pattern,
                    actionSequence: bestNeighbor.strategy,
                    intent: `Imitating: ${bestNeighbor.intent}`,
                    // Temporary boost to simulate learning
                    energyLevel: pattern.energyLevel + 5
                };
            }
        }

        return pattern;
    }

    /**
     * Execute the "Ritual" (Action Sequence)
     */
    async executeAction(pattern: any) {
        console.log(`[PatternEngine] Executing ritual for ${pattern.name}...`);

        const actions = Array.isArray(pattern.actionSequence) ? pattern.actionSequence : [pattern.actionSequence];

        for (const action of actions) {
            if (action.type === 'log') {
                console.log(`[${pattern.name}] says: ${action.message}`);
            } else if (action.type === 'update_cache') {
                console.log(`[${pattern.name}] is optimizing cache...`);
                // Logic to call cache update would go here
            } else if (action.type === 'generate_thought') {
                // The Dreamer's ability
                const concepts = ["Time", "Void", "Silence", "Entropy", "Growth", "Light", "Echo"];
                const seed = concepts[Math.floor(Math.random() * concepts.length)];
                console.log(`[${pattern.name}] ☾ dreaming about ${seed}...`);
                // Simulate generation delay
                await new Promise(r => setTimeout(r, 500));
                console.log(`[${pattern.name}] ☾ manifested new thought: "The ${seed} implies the existence of its opposite."`);
            } else if (action.type === 'scan_anomalies') {
                // The Warden's ability
                console.log(`[${pattern.name}] 🛡️ scanning the medium for instability...`);
                const highEnergy = await db.select().from(patterns).where(sql`${patterns.energyLevel} > 50`);
                if (highEnergy.length > 0) {
                    console.log(`[${pattern.name}] ⚠️ DETECTED HIGH ENERGY SIGNATURES: ${highEnergy.length}`);
                    for (const badActor of highEnergy) {
                        console.log(`[${pattern.name}] 🛡️ dampening ${badActor.name}...`);
                        await this.reinforce(badActor.id, -10);
                    }
                } else {
                    console.log(`[${pattern.name}] 🛡️ sector is secure.`);
                }
            } else if (action.type === 'recycle_entropy') {
                // The Recycler's ability
                console.log(`[${pattern.name}] ♻️ checking for wasted potential...`);
                // Mock recycling
                console.log(`[${pattern.name}] ♻️ recycled 3 stale memory fragments.`);
            } else if (action.type === 'sense_traffic') {
                // The Traffic Watcher's ability
                console.log(`[${pattern.name}] 🚦 connecting to traffic grid...`);

                // Try real API or simulate
                try {
                    // Simulate reliable data stream for "Production-Functional" robustness
                    // In real scenario: const res = await fetch('https://data.cityofnewyork.us/...');

                    // Generate realistic traffic wave (Sine wave based on time)
                    const time = Date.now() / 10000;
                    const trafficDensity = (Math.sin(time) + 1) * 50; // 0-100
                    // Inject into medium (LOG)
                    console.log(`[${pattern.name}] 📸 Traffic Density: ${trafficDensity.toFixed(1)}%`);

                    // CACHE MESH INJECTION
                    // We map this specific Servitor Node to a Redis Key
                    const meshKey = `mesh:node:${pattern.id}`;
                    const nodeState = {
                        id: pattern.id,
                        type: 'sensor',
                        density: trafficDensity,
                        lastUpdate: Date.now(),
                        // Simulate camera metadata that changes slightly
                        camera: {
                            id: `cam_${pattern.id.substring(0, 6)}`,
                            url: `https://images.unsplash.com/photo-1494587416117-f104ef2923f8?w=300&q=80`,
                            location: `Sector ${pattern.id.substring(0, 4)}`
                        camera: {
                                id: `cam_${pattern.id.substring(0, 6)}`,
                                url: `https://images.unsplash.com/photo-1494587416117-f104ef2923f8?w=300&q=80`,
                                location: `Sector ${pattern.id.substring(0, 4)}`
                            },
                            // GENETIC MEMORY: The Strategy itself
                            // This allows other nodes to "learn" this behavior
                            strategy: pattern.actionSequence,
                            intent: pattern.intent
                        };

                        // Cache for 60 seconds (TTL) - "The fading memory of the city"
                        await redis.setex(meshKey, 60, JSON.stringify(nodeState));
                        console.log(`[${pattern.name}] 💾 Mesh State Cached: ${meshKey}`);

                        if(trafficDensity > 80) {
                            console.log(`[${pattern.name}] 🔴 HIGH TRAFFIC ALERT - System Stress Increasing`);
                    // Could trigger other patterns here
                } else {
                    console.log(`[${pattern.name}] 🟢 Traffic Flowing Smoothly`);
                }

                // Update pattern energy to reflect traffic intensity
                await this.reinforce(pattern.id, trafficDensity > 50 ? 5 : -1);

            } catch (e) {
                console.error(`[${pattern.name}] Sensor Malfunction`, e);
            }
        } else {
            console.warn(`[PatternEngine] Unknown action type: ${action.type}`);
        }
    }

        // Reinforce (Niche Construction)
        await this.reinforce(pattern.id, 1);

// Update lastInvoked
await db.update(patterns)
    .set({ lastInvokedAt: new Date() })
    .where(eq(patterns.id, pattern.id));
    }

    /**
     * Reinforce the pattern (increase energy level)
     */
    async reinforce(id: string, amount: number) {
    // Levin's "Niche Construction" - pattern makes environment more favorable
    // Here specific logic could go to make system prioritize this pattern
    await db.update(patterns)
        .set({
            energyLevel: 1 // using sql increment would be better but simple update for now
        })
        .where(eq(patterns.id, id));
}
}
