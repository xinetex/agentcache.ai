/**
 * GET /api/admin/health
 * Aggregate health endpoint — reports status of all platform subsystems.
 * Used by Mission Control dashboard for real-time system monitoring.
 * No auth required (returns operational status only, no sensitive data).
 */

import { Hono } from 'hono';
import { redis } from '../../lib/redis.js';
import { ArmorService } from '../../services/ArmorService.js';
import { cognitiveMemory } from '../../services/cognitive-memory.js';

const healthRouter = new Hono();
const armor = new ArmorService();

healthRouter.get('/', async (c) => {
    const startTime = Date.now();
    const subsystems: Record<string, any> = {};

    // 1. Redis
    try {
        const pong = await redis.ping();
        const info = await redis.info('memory').catch(() => '');
        const usedMem = info.match(/used_memory_human:([^\r\n]+)/)?.[1] || 'unknown';
        subsystems.redis = { status: 'connected', latency: `${Date.now() - startTime}ms`, usedMemory: usedMem };
    } catch (e) {
        subsystems.redis = { status: 'error', error: (e as Error).message };
    }

    // 2. Armor (WAF)
    try {
        const armorStats = await armor.getStats();
        subsystems.armor = {
            status: armorStats.status,
            blocked24h: armorStats.blocked24h,
            totalRequests: armorStats.totalRequests,
            requestsPerMinute: armorStats.requestsPerMinute,
            activeBans: armorStats.activeBans,
            integrity: armorStats.integrity
        };
    } catch (e) {
        subsystems.armor = { status: 'error' };
    }

    // 3. Cognitive Memory
    try {
        const cogStatus = await cognitiveMemory.getStatus();
        subsystems.cognitive = {
            status: cogStatus ? 'active' : 'standby',
            ...cogStatus
        };
    } catch (e) {
        subsystems.cognitive = { status: 'error' };
    }

    // 4. Pattern Engine
    try {
        const patternStatus = await redis.get('pattern:engine:status');
        const patternsDetected = await redis.get('pattern:detected:total');
        subsystems.pattern = {
            status: patternStatus || 'standby',
            patternsDetected: parseInt(patternsDetected as string) || 0
        };
    } catch {
        subsystems.pattern = { status: 'unknown' };
    }

    // 5. Trust Center
    try {
        const claimsVerified = await redis.get('trust:claims:total');
        subsystems.trust = {
            status: 'active',
            instanceId: process.env.TRUST_INSTANCE_ID || 'T-BROKER-01',
            claimsVerified: parseInt(claimsVerified as string) || 0
        };
    } catch {
        subsystems.trust = { status: 'unknown' };
    }

    // 6. Swarm Protocol
    try {
        const activeSwarms = await redis.keys('swarm:session:*');
        subsystems.swarm = {
            status: activeSwarms.length > 0 ? 'active' : 'idle',
            activeSwarms: activeSwarms.length
        };
    } catch {
        subsystems.swarm = { status: 'idle', activeSwarms: 0 };
    }

    // 7. DriftWalker
    try {
        const driftEvents = await redis.get('drift:events:total');
        subsystems.drift = {
            status: 'monitoring',
            eventsHandled: parseInt(driftEvents as string) || 0
        };
    } catch {
        subsystems.drift = { status: 'unknown' };
    }

    // 8. HopfieldMemory
    try {
        const associations = await redis.get('hopfield:associations:total');
        subsystems.hopfield = {
            status: 'active',
            associations: parseInt(associations as string) || 0
        };
    } catch {
        subsystems.hopfield = { status: 'unknown' };
    }

    // 9. Workflow Engine
    try {
        const activeLanes = await redis.keys('workflow:lane:*');
        subsystems.workflow = {
            status: activeLanes.length > 0 ? 'processing' : 'idle',
            activeLanes: activeLanes.length
        };
    } catch {
        subsystems.workflow = { status: 'idle', activeLanes: 0 };
    }

    // 10. Sentry Agent
    try {
        const lastCheck = await redis.get('sentry:lastCheck');
        const anomalies = await redis.get('sentry:anomalies:total');
        subsystems.sentry = {
            status: lastCheck ? 'monitoring' : 'standby',
            lastCheck: lastCheck || null,
            anomalies: parseInt(anomalies as string) || 0
        };
    } catch {
        subsystems.sentry = { status: 'standby' };
    }

    // 11. PredictiveSynapse
    try {
        const predictions = await redis.get('synapse:predictions:total');
        subsystems.synapse = {
            status: 'standby',
            predictions: parseInt(predictions as string) || 0
        };
    } catch {
        subsystems.synapse = { status: 'standby' };
    }

    // 12. Observability
    try {
        subsystems.observability = {
            status: 'active',
            tracing: true
        };
    } catch {
        subsystems.observability = { status: 'unknown' };
    }

    // Compute overall health
    const statuses = Object.values(subsystems).map((s: any) => s.status);
    const hasError = statuses.includes('error');
    const allHealthy = statuses.every((s: string) => ['connected', 'active', 'idle', 'standby', 'monitoring', 'listening', 'processing'].includes(s));

    return c.json({
        status: hasError ? 'degraded' : allHealthy ? 'healthy' : 'partial',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        responseTime: `${Date.now() - startTime}ms`,
        subsystems
    });
});

export { healthRouter };
