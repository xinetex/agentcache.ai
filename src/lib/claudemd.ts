/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * CLAUDE.md Discovery and Parsing Service.
 * Inspired by the Anthropic Claude Code architecture.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { redis } from './redis.js';
import { TurboQuantService } from '../services/TurboQuantService.js';

export class ClaudeMdService {
    private static CACHE_KEY_PREFIX = 'agentcache:claudemd:';

    /**
     * Find CLAUDE.md in the project root or parent directories.
     */
    static async findClaudeMd(startDir: string = process.cwd()): Promise<string | null> {
        let current = path.resolve(startDir);
        const root = path.parse(current).root;

        while (current !== root) {
            const filePath = path.join(current, 'CLAUDE.md');
            try {
                await fs.access(filePath);
                return filePath;
            } catch {
                current = path.dirname(current);
            }
        }
        return null;
    }

    /**
     * Read and compress CLAUDE.md content.
     */
    static async getProjectConventions(sessionId: string): Promise<{ content: string; shadow?: string } | null> {
        // Check cache first
        const cacheKey = `${this.CACHE_KEY_PREFIX}${sessionId}`;
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const filePath = await this.findClaudeMd();
        if (!filePath) return null;

        try {
            const content = await fs.readFile(filePath, 'utf-8');
            
            // Generate ACTQ shadow for Lidar consistency
            // We only shadow the first 2k chars to keep it light
            const shadowText = content.slice(0, 2000);
            const floatArray = new Float32Array(shadowText.length);
            for (let i = 0; i < shadowText.length; i++) floatArray[i] = shadowText.charCodeAt(i);
            
            const compressed = TurboQuantService.compress(floatArray);
            const shadow = TurboQuantService.toBase64(compressed);

            const result = { content, shadow };
            await redis.setex(cacheKey, 3600, JSON.stringify(result)); // 1hr cache
            return result;
        } catch (err) {
            console.error('[ClaudeMd] Failed to read CLAUDE.md:', err);
            return null;
        }
    }

    /**
     * Build the system prompt segment for CLAUDE.md.
     */
    static async getSystemPromptSegment(sessionId: string): Promise<string> {
        const conventions = await this.getProjectConventions(sessionId);
        if (!conventions) return '';

        return `\n\n### PROJECT CONVENTIONS (from CLAUDE.md)\n${conventions.content}\n`;
    }
}
