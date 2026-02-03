
import { Octokit } from 'octokit';

export class GitHubConnector {
    private kit: Octokit;

    constructor(token?: string) {
        // Use env var if no token passed, fallback to process for Vercel
        const auth = token || process.env.GITHUB_TOKEN;
        if (!auth) {
            console.warn('[GitHubConnector] No GITHUB_TOKEN provided. Read-only or failed auth may occur.');
        }
        this.kit = new Octokit({ auth });
    }

    /**
     * Post a comment on a PR
     */
    async postPRComment(owner: string, repo: string, issueNumber: number, body: string) {
        try {
            await this.kit.rest.issues.createComment({
                owner,
                repo,
                issue_number: issueNumber,
                body
            });
            console.log(`[GitHub] Commented on PR #${issueNumber}`);
            return true;
        } catch (e) {
            console.error(`[GitHub] Failed to post comment:`, e);
            return false;
        }
    }

    /**
     * Get file diff for a PR
     * Returns raw diff string (simplification)
     */
    async getPRDiff(owner: string, repo: string, pullNumber: number): Promise<string | null> {
        try {
            const { data } = await this.kit.rest.pulls.get({
                owner,
                repo,
                pull_number: pullNumber,
                mediaType: { format: 'diff' } // Request raw diff
            });
            return data as unknown as string;
        } catch (e) {
            console.error(`[GitHub] Failed to fetch diff:`, e);
            return null;
        }
    }

    /**
     * Add a label to a PR (e.g., 'high-risk')
     */
    async addLabel(owner: string, repo: string, issueNumber: number, label: string) {
        try {
            await this.kit.rest.issues.addLabels({
                owner,
                repo,
                issue_number: issueNumber,
                labels: [label]
            });
            return true;
        } catch (e) {
            console.error(`[GitHub] Failed to add label:`, e);
            return false;
        }
    }
}
