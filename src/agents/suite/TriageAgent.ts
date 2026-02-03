
import { LLMFactory } from '../../lib/llm/factory.js';
import { SlackConnector } from '../../connectors/slack.js';
import { GitHubConnector } from '../../connectors/github.js';

interface IncidentContext {
    source: 'sentry' | 'datadog' | 'manual';
    alertId: string;
    title: string;
    message: string;
    level: 'error' | 'warning' | 'info';
    timestamp: string;
    metadata: {
        projectSlug?: string;
        environment?: string;
        release?: string;
        stackTrace?: string;
        tags?: Record<string, string>;
    };
}

interface TriageResult {
    severity: 'P1' | 'P2' | 'P3';
    rootCause: string;
    remediation: string[];
    relatedErrors: string[];
}

export class TriageAgent {
    private slack: SlackConnector;
    private github: GitHubConnector;

    constructor() {
        this.slack = new SlackConnector();
        this.github = new GitHubConnector();
    }

    /**
     * Main Entry: Analyze an incident alert
     */
    async runTriage(context: IncidentContext): Promise<TriageResult> {
        console.log(`[TriageAgent] Analyzing incident: "${context.title}"`);

        // 1. Enrich with recent deploys (last 24h)
        const deploys = await this.getRecentDeploys();

        // 2. Run LLM correlation
        const result = await this.correlateWithLLM(context, deploys);

        // 3. Post to Slack
        await this.notifySlack(context, result);

        console.log(`[TriageAgent] Triage complete. Severity: ${result.severity}`);
        return result;
    }

    /**
     * Fetch recent deploys from GitHub
     */
    private async getRecentDeploys(): Promise<string[]> {
        try {
            // Use GitHub connector to get recent releases/tags
            // For now, return mock data - would integrate with GitHub Releases API
            return ['v2.3.1 (2h ago)', 'v2.3.0 (1d ago)'];
        } catch (e) {
            console.warn('[TriageAgent] Failed to fetch deploys:', e);
            return [];
        }
    }

    /**
     * LLM-based incident correlation
     */
    private async correlateWithLLM(context: IncidentContext, deploys: string[]): Promise<TriageResult> {
        const llm = LLMFactory.createProvider('grok');

        const systemPrompt = `You are an SRE analyzing a production incident.
Your task is to:
1. Identify the likely root cause based on the error and recent context.
2. Suggest immediate remediation steps.
3. Rate severity: P1 (customer-facing outage), P2 (degraded service), P3 (minor issue).

Respond ONLY in JSON format:
{
  "severity": "P1" | "P2" | "P3",
  "rootCause": "Brief explanation of likely cause",
  "remediation": ["Step 1", "Step 2"],
  "relatedErrors": ["Any correlated issues"]
}`;

        const userPrompt = `Alert: ${context.title}
Error: ${context.message}
Level: ${context.level}
Environment: ${context.metadata.environment || 'unknown'}
Project: ${context.metadata.projectSlug || 'unknown'}

${context.metadata.stackTrace ? `Stack Trace:\n${context.metadata.stackTrace.slice(0, 2000)}` : ''}

Recent Deploys: ${deploys.join(', ') || 'None found'}

Analyze this incident and return your triage as JSON.`;

        try {
            const response = await llm.chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ], { temperature: 0.2 });

            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('LLM did not return valid JSON');
            }

            const result = JSON.parse(jsonMatch[0]);
            return {
                severity: result.severity || 'P3',
                rootCause: result.rootCause || 'Unable to determine',
                remediation: result.remediation || [],
                relatedErrors: result.relatedErrors || []
            };
        } catch (e) {
            console.error('[TriageAgent] LLM correlation failed:', e);
            // Fallback to heuristic
            return this.heuristicTriage(context);
        }
    }

    /**
     * Fallback heuristic when LLM fails
     */
    private heuristicTriage(context: IncidentContext): TriageResult {
        let severity: 'P1' | 'P2' | 'P3' = 'P3';

        // Simple keyword-based severity
        const text = `${context.title} ${context.message}`.toLowerCase();

        if (text.includes('database') || text.includes('connection refused') || text.includes('timeout')) {
            severity = 'P1';
        } else if (text.includes('payment') || text.includes('stripe') || text.includes('auth')) {
            severity = 'P1';
        } else if (context.level === 'error') {
            severity = 'P2';
        }

        return {
            severity,
            rootCause: 'Requires manual investigation',
            remediation: ['Check logs', 'Review recent deploys', 'Check database connectivity'],
            relatedErrors: []
        };
    }

    /**
     * Post structured alert to Slack
     */
    private async notifySlack(context: IncidentContext, result: TriageResult) {
        const emoji = result.severity === 'P1' ? '🚨' : result.severity === 'P2' ? '⚠️' : 'ℹ️';

        const summary = `${emoji} **[${result.severity}] ${context.title}**

**Root Cause**: ${result.rootCause}

**Remediation**:
${result.remediation.map(s => `• ${s}`).join('\n')}

**Source**: ${context.source} | **Environment**: ${context.metadata.environment || 'unknown'}`;

        await this.slack.alertIncident(context.title, result.severity.toLowerCase(), summary);
    }
}
