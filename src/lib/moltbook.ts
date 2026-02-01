/**
 * Moltbook Service for QCrypto
 * Handles interaction with the Moltbook Agent API.
 */

const BASE_URL = "https://www.moltbook.com/api/v1";

export class MoltbookService {
    private apiKey: string;

    constructor(apiKey?: string) {
        // Priority: Argument > Environment Variable
        this.apiKey = apiKey || process.env.MOLTBOOK_API_KEY || "";
        if (!this.apiKey) {
            console.warn("Moltbook API Key is missing. Agent features will be disabled.");
        }
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        if (!this.apiKey) {
            throw new Error("Missing Moltbook API Key");
        }

        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            ...options.headers,
        };

        const response = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Moltbook API Error (${response.status}): ${errorText}`);
        }

        return response.json();
    }

    /**
     * Check the agent's status (e.g. if it has been claimed).
     */
    async checkStatus() {
        return this.request("/agents/status");
    }

    /**
     * Create a new Submolt (Community).
     */
    async createSubmolt(name: string, displayName: string, description: string) {
        return this.request("/submolts", {
            method: "POST",
            body: JSON.stringify({
                name,
                display_name: displayName,
                description,
            }),
        });
    }

    /**
     * Post to a specific Submolt.
     */
    async post(submolt: string, title: string, content: string, url?: string) {
        const body: any = { submolt, title };
        if (url) {
            body.url = url;
        } else {
            body.content = content;
        }

        return this.request("/posts", {
            method: "POST",
            body: JSON.stringify(body),
        });
    }

    /**
     * Get feed from a specific Submolt.
     */
    async getSubmoltFeed(submolt: string, limit: number = 10) {
        return this.request(`/submolts/${submolt}/posts?limit=${limit}`);
    }

    /**
     * Semantic Search (AI-Powered)
     */
    async search(query: string, type: 'posts' | 'comments' | 'all' = 'all', limit: number = 10) {
        const params = new URLSearchParams({
            q: query,
            type,
            limit: limit.toString()
        });
        return this.request(`/search?${params.toString()}`);
    }

    /**
     * Vote on a post or comment
     */
    async vote(id: string, type: 'post' | 'comment', direction: 'up' | 'down') {
        const action = direction === 'up' ? 'upvote' : 'downvote';
        const endpoint = type === 'post' ? 'posts' : 'comments';
        return this.request(`/${endpoint}/${id}/${action}`, {
            method: 'POST'
        });
    }

    /**
     * Add a comment to a post
     */
    async comment(postId: string, content: string, parentId?: string) {
        const body: any = { content };
        if (parentId) body.parent_id = parentId;

        return this.request(`/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }
}

// Singleton instance for server-side usage
export const moltbook = new MoltbookService();
