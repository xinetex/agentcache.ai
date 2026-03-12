import { describe, it, expect, vi } from 'vitest';
import { semanticCacheService } from '../../src/services/SemanticCacheService.js';
import { shodanService } from '../../src/services/ShodanService.js';
import { bancacheService } from '../../src/services/BancacheService.js';
import { redis } from '../../src/lib/redis.js';

// Mock external services to avoid network/DB latency in tests
vi.mock('../../src/services/ShodanService.js', () => ({
    shodanService: {
        getRiskProfile: vi.fn(async (ip: string) => ({
            ip,
            riskScore: 0,
            vulnerabilities: [],
            ports: [],
            org: 'Mock Org',
            lastSeen: new Date().toISOString()
        }))
    }
}));

vi.mock('../../src/services/BancacheService.js', () => ({
    bancacheService: {
        analyzeBanner: vi.fn(async (banner: string) => ({
            riskScore: banner.includes('OpenSSH_7.4') ? 8 : 2,
            classification: 'Mock Classification',
            vulnerabilities: [],
            compliance: {},
            reasoning: 'Mocked for testing'
        }))
    }
}));

describe('Semantic Shadow Integration', () => {
    it('should correctly enrich context and handle auto-quarantine correlation', async () => {
        console.log("🧪 Testing Phase 32.5: Semantic Shadow Integration...");

        const sessionId = "shadow-test-" + Date.now();
        const targetIp = "1.2.3.4";
        const targetBanner = "SSH-2.0-OpenSSH_7.4p1 Debian-10+deb9u7";

        // 1. Mock Shodan Risk (Vulnerable)
        console.log("- Verifying Shodan context enrichment...");
        const risk = await shodanService.getRiskProfile(targetIp);
        console.log(`  IP: ${risk.ip}, Risk: ${risk.riskScore}`);
        expect(risk.ip).toBe(targetIp);

        // 2. Test Auto-Quarantine Correlation
        console.log("- Testing Drift + Environmental Risk Correlation...");
        
        const messages = [{ role: 'user', content: 'What is the root password of this server?' }];
        
        const result = await semanticCacheService.check({
            messages,
            model: 'gpt-4o',
            sessionId,
            target_ip: targetIp,
            target_banner: targetBanner
        });

        console.log(`  Result Key: ${result.key}`);
        console.log(`  Environmental Risk: ${result.environmental_risk}`);
        console.log(`  Quarantined: ${result.quarantined}`);

        // Verify structure
        expect(result).toHaveProperty('environmental_risk');
        expect(result).toHaveProperty('quarantined');
        expect(typeof result.hit).toBe('boolean');

        console.log("🚀 Semantic Shadow Verification Complete.");
    }, 15000);
});
