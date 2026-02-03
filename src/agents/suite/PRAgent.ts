
import { GitHubConnector } from '../../connectors/github.js';
import { LLMFactory } from '../../lib/llm/factory.js';

interface PRContext {
    owner: string;
    repo: string;
    prNumber: number;
    title: string;
    author: string;
}

interface ReviewResult {
    riskLevel: 'low' | 'medium' | 'high';
    summary: string;
    findings: { file?: string; line?: number; severity: string; body: string }[];
}

export class PRAgent {
    private github: GitHubConnector;

    constructor() {
        this.github = new GitHubConnector();
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

        // 2. Run Fast Path (Heuristics)
        const fastResult = this.fastAnalysis(diff);

        // 3. Run Deep Path (LLM) if diff is reasonable size
        let deepResult: ReviewResult | null = null;
        const diffLines = diff.split('\n').length;

        if (diffLines < 1000) {
            try {
                deepResult = await this.llmAnalysis(diff, context.title);
            } catch (e) {
                console.warn('[PRAgent] LLM analysis failed, falling back to heuristics:', e);
            }
        } else {
            console.log(`[PRAgent] Skipping LLM analysis: diff too large (${diffLines} lines)`);
        }

        // 4. Merge Results (prefer LLM if available)
        const analysis = deepResult || fastResult;

        // 5. Format and Post Comment
        let body = `## 🤖 AgentCache Code Review\n`;
        body += `**Risk Level**: ${analysis.riskLevel.toUpperCase()}\n\n`;

        if (deepResult) {
            body += `### Summary\n${analysis.summary}\n\n`;
        }

        if (analysis.findings.length === 0) {
            body += `✅ **No critical issues detected.**\nCode looks clean.`;
        } else {
            body += `### Findings\n`;
            analysis.findings.forEach(f => {
                const loc = f.file ? `\`${f.file}${f.line ? ':' + f.line : ''}\`` : '';
                body += `- **[${f.severity.toUpperCase()}]** ${loc ? loc + ': ' : ''}${f.body}\n`;
            });

            if (analysis.riskLevel === 'high') {
                body += `\n⚠️ **Warning**: High risk changes detected. Manual review required.`;
                await this.github.addLabel(context.owner, context.repo, context.prNumber, 'high-risk');
            }
        }

        // 6. Post Result
        await this.github.postPRComment(context.owner, context.repo, context.prNumber, body);
        console.log(`[PRAgent] Review posted for PR #${context.prNumber}`);
    }

    /**
     * Fast Path: Regex/Keyword Heuristics
     */
    private fastAnalysis(diff: string): ReviewResult {
        const findings: ReviewResult['findings'] = [];
        let riskLevel: 'low' | 'medium' | 'high' = 'low';

        // Keywords
        if (/stripe|billing|payment/i.test(diff)) {
            findings.push({ severity: 'high', body: "Modified billing logic (Stripe/Payment). Verify idempotency." });
            riskLevel = 'high';
        }
        if (/api_key|secret|process\.env\./i.test(diff)) {
            findings.push({ severity: 'medium', body: "Possible env/secret exposure or config change." });
            if (riskLevel !== 'high') riskLevel = 'medium';
        }
        if (/eval\(|exec\(|Function\(/i.test(diff)) {
            findings.push({ severity: 'high', body: "Dangerous `eval()` or dynamic code execution detected." });
            riskLevel = 'high';
        }
        if (/\.query\(|\.execute\(|sql`/i.test(diff) && !/prepared|parameterized/i.test(diff)) {
            findings.push({ severity: 'medium', body: "Direct SQL usage detected. Ensure parameterized queries." });
            if (riskLevel === 'low') riskLevel = 'medium';
        }

        return {
            riskLevel,
            summary: findings.length > 0 ? 'Static analysis detected potential issues.' : 'No issues detected by static analysis.',
            findings
        };
    }

    /**
     * Deep Path: LLM-based Analysis
     */
    private async llmAnalysis(diff: string, prTitle: string): Promise<ReviewResult> {
        // Use Grok (fast) or fallback to Anthropic
        const llm = LLMFactory.createProvider('grok');

        const systemPrompt = `You are a senior software engineer reviewing a pull request. 
Your task is to identify:
1. Security vulnerabilities (API keys, SQL injection, XSS)
2. Performance issues (N+1 queries, missing indexes, heavy loops)
3. Logic bugs or edge cases
4. Breaking changes

Respond in JSON format:
{
  "riskLevel": "low" | "medium" | "high",
  "summary": "One paragraph summary of the changes",
  "findings": [
    { "severity": "low" | "medium" | "high", "body": "Description of issue" }
  ]
}

If the code is clean, return riskLevel "low" with empty findings array.`;

        const userPrompt = `PR Title: ${prTitle}

\`\`\`diff
${diff.slice(0, 12000)}
\`\`\`

${diff.length > 12000 ? '(Diff truncated for analysis)' : ''}

Analyze this diff and return your review as JSON.`;

        const response = await llm.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], { temperature: 0.2 });

        // Parse JSON from response content
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('LLM did not return valid JSON');
        }

        const result = JSON.parse(jsonMatch[0]);
        return {
            riskLevel: result.riskLevel || 'low',
            summary: result.summary || 'LLM analysis complete.',
            findings: result.findings || []
        };
    }
}

