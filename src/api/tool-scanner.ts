/**
 * Tool Safety Scanner API
 *
 * POST /api/tools/scan       — Scan source code for threats
 * GET  /api/tools/scan/stats  — Aggregate scan statistics
 * GET  /api/tools/scan/:hash  — Lookup previous scan by content hash
 */

import { Hono } from 'hono';
import { eq, desc, sql, count as drizzleCount } from 'drizzle-orm';
import { db } from '../db/client.js';
import { toolScanResults } from '../db/schema.js';
import { authenticateApiKey } from '../middleware/auth.js';
import {
    scanSource,
    scanManifest,
    hashSource,
    type Language,
    type ScanResult,
} from '../lib/tool-scanner.js';

const toolScannerRouter = new Hono();

/**
 * POST /api/tools/scan
 * Main scan endpoint — accepts source code and optional manifest.
 */
toolScannerRouter.post('/', async (c) => {
    const authError = await authenticateApiKey(c);
    if (authError) return authError;

    const body = await c.req.json().catch(() => ({} as any));
    const source: string = body.source || '';
    const name: string = body.name || 'unnamed-tool';
    const language: Language | 'auto' = body.language || 'auto';
    const manifest: any = body.manifest || null;

    if (!source || source.trim().length < 10) {
        return c.json({
            error: 'source is required (min 10 characters of tool source code)',
        }, 400);
    }

    // Check trust registry first — skip re-scanning known tools
    const contentHash = hashSource(source);
    const existing = await db.select().from(toolScanResults)
        .where(eq(toolScanResults.contentHash, contentHash))
        .limit(1);

    if (existing.length > 0) {
        const cached = existing[0];
        return c.json({
            cached: true,
            contentHash: cached.contentHash,
            toolName: cached.toolName,
            language: cached.language,
            trustScore: cached.trustScore,
            verdict: cached.verdict,
            findings: cached.findings,
            manifest: cached.manifest,
            scannedAt: cached.createdAt?.toISOString(),
            message: 'Result retrieved from trust registry (previously scanned).',
        });
    }

    // Run static analysis
    const langOption = language === 'auto' ? undefined : language;
    const result: ScanResult = scanSource(source, { name, language: langOption });

    // Run MCP manifest analysis if provided
    let manifestResult = null;
    if (manifest && typeof manifest === 'object') {
        manifestResult = scanManifest(manifest);
        // Merge MCP findings into main results
        result.findings.push(...manifestResult.risks);
        // Recalculate trust score with MCP findings included
        const penalty = result.findings.reduce((sum, f) => {
            const weights = { critical: 0.3, high: 0.2, medium: 0.1, low: 0.05 };
            return sum + (weights[f.severity] || 0);
        }, 0);
        result.trustScore = Math.max(0, Math.min(1, +(1 - penalty).toFixed(3)));
        result.verdict = result.trustScore >= 0.8 ? 'trusted'
            : result.trustScore >= 0.5 ? 'caution' : 'dangerous';
    }

    // Persist to trust registry
    const apiKey = c.req.header('X-API-Key') || '';
    const keyPrefix = apiKey.substring(0, 8) || 'unknown';

    try {
        await db.insert(toolScanResults).values({
            contentHash: result.contentHash,
            toolName: result.toolName,
            language: result.language,
            trustScore: result.trustScore,
            verdict: result.verdict,
            findings: result.findings,
            manifest: manifest || null,
            scannedBy: keyPrefix,
        });
    } catch (err: any) {
        console.error('[ToolScanner] Failed to persist scan result:', err.message);
    }

    return c.json({
        cached: false,
        contentHash: result.contentHash,
        toolName: result.toolName,
        language: result.language,
        trustScore: result.trustScore,
        verdict: result.verdict,
        findings: result.findings,
        stats: result.stats,
        mcpAnalysis: manifestResult ? {
            permissionScope: manifestResult.permissionScope,
            riskCount: manifestResult.risks.length,
        } : undefined,
        scannedAt: result.scannedAt,
    });
});

/**
 * GET /api/tools/scan/stats
 * Aggregate scan statistics — total scans, threat distribution, etc.
 */
toolScannerRouter.get('/stats', async (c) => {
    const allScans = await db.select().from(toolScanResults)
        .orderBy(desc(toolScanResults.createdAt));

    const totalScans = allScans.length;

    const verdictCounts = { trusted: 0, caution: 0, dangerous: 0 };
    const categoryCounts: Record<string, number> = {};
    let totalFindings = 0;

    for (const scan of allScans) {
        const v = scan.verdict as keyof typeof verdictCounts;
        if (verdictCounts[v] !== undefined) verdictCounts[v]++;

        const findings = Array.isArray(scan.findings) ? scan.findings : [];
        totalFindings += findings.length;
        for (const f of findings as any[]) {
            const cat = f.category || 'unknown';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        }
    }

    // Most common threats (sorted)
    const topThreats = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([category, count]) => ({ category, count }));

    // Recent dangerous tools
    const recentDangerous = allScans
        .filter(s => s.verdict === 'dangerous')
        .slice(0, 5)
        .map(s => ({
            name: s.toolName,
            trustScore: s.trustScore,
            scannedAt: s.createdAt?.toISOString(),
        }));

    return c.json({
        totalScans,
        totalFindings,
        verdictDistribution: verdictCounts,
        topThreats,
        recentDangerous,
        avgTrustScore: totalScans > 0
            ? +(allScans.reduce((sum, s) => sum + (s.trustScore || 0), 0) / totalScans).toFixed(3)
            : null,
        timestamp: new Date().toISOString(),
    });
});

/**
 * GET /api/tools/scan/:hash
 * Lookup a previous scan result by content hash.
 */
toolScannerRouter.get('/:hash', async (c) => {
    const hash = c.req.param('hash');

    if (!hash || hash.length < 16) {
        return c.json({ error: 'Invalid content hash' }, 400);
    }

    const rows = await db.select().from(toolScanResults)
        .where(eq(toolScanResults.contentHash, hash))
        .limit(1);

    if (rows.length === 0) {
        return c.json({
            found: false,
            message: 'No scan result found for this hash. Submit source to POST /api/tools/scan to scan.',
        }, 404);
    }

    const scan = rows[0];
    return c.json({
        found: true,
        contentHash: scan.contentHash,
        toolName: scan.toolName,
        language: scan.language,
        trustScore: scan.trustScore,
        verdict: scan.verdict,
        findings: scan.findings,
        manifest: scan.manifest,
        scannedBy: scan.scannedBy,
        scannedAt: scan.createdAt?.toISOString(),
    });
});

export default toolScannerRouter;
