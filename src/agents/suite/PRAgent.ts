
import { GitHubConnector } from '../../connectors/github.js';

interface PRContext {
    owner: string;
    repo: string;
    prNumber: number;
    title: string;
    author: string;
}

export class PRAgent {
    private github: GitHubConnector;

    constructor() {
        this.github = new GitHubConnector(); // Picks up Env Var
    }

    /**
     * Main Entry: Analyze a PR Event
     */
    async runReview(context: PRContext) {
        console.log(`[PRAgent] Starting review for PR #${context.prNumber}: "${context.title}"`);

        // 1. Fetch Code Changes
        const diff = await this.github.getPRDiff(context.owner, context.repo, context.prNumber);

        if (!diff) {
            await this.github.postPRComment(context.owner, context.repo, context.prNumber,
                "🤖 **Scan Failed**: Could not retrieve diff data.");
            return;
        }

        // 2. Analyze (Simple Heuristic for V1)
        // In real version, we'd feed `diff` to an LLM here.
        const analysis = this.analyzeDiff(diff);

        // 3. Take Action
        let body = `## 🤖 AgentCache Code Review\n`;
        body += `**Risk Level**: ${analysis.riskLevel.toUpperCase()}\n\n`;

        if (analysis.findings.length === 0) {
            body += `✅ **No critical issues detected.**\nCode looks clean based on static heuristics.`;
        } else {
            body += `**Findings:**\n`;
            analysis.findings.forEach(f => body += `- ${f}\n`);

            if (analysis.riskLevel === 'high') {
                body += `\n⚠️ **Warning**: High risk changes detected. Manual review required.`;
                await this.github.addLabel(context.owner, context.repo, context.prNumber, 'high-risk');
            }
        }

        // 4. Post Result
        await this.github.postPRComment(context.owner, context.repo, context.prNumber, body);
    }

    /**
     * Heuristic Analysis (Placeholder for LLM)
     */
    private analyzeDiff(diff: string): { riskLevel: 'low' | 'medium' | 'high', findings: string[] } {
        const findings: string[] = [];
        let riskLevel: 'low' | 'medium' | 'high' = 'low';

        // Keywords
        if (diff.includes('Stripe') || diff.includes('billing')) {
            findings.push("Modified billing logic (Stripe/Payment). Verify idempotency.");
            riskLevel = 'high';
        }
        if (diff.includes('token') || diff.includes('secret') || diff.includes('process.env')) {
            findings.push("Possible env/secret exposure or config change.");
            if (riskLevel !== 'high') riskLevel = 'medium';
        }
        if (diff.includes('eval(')) {
            findings.push("Dangerous `eval()` usage detected.");
            riskLevel = 'high';
        }

        return { riskLevel, findings };
    }
}
