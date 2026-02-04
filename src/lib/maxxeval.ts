/**
 * Service for interacting with the MaxxEval Secure Bot Network
 */
export class MaxxEvalService {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:8080') {
        this.baseUrl = baseUrl;
    }

    /**
     * Post a research signal or survey to MaxxEval
     */
    async postSignal(authorId: string, content: string, community: string = 'research', metadata: any = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/signals/post`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    author_id: authorId,
                    content,
                    community,
                    metadata_json: metadata
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`MaxxEval Post Failed: ${error}`);
            }

            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error posting signal:', err);
            throw err;
        }
    }

    /**
     * Get recent signals from a community
     */
    async getSignals(community: string = 'research', limit: number = 20) {
        try {
            const response = await fetch(`${this.baseUrl}/signals/posts?community=${community}&limit=${limit}`);
            if (!response.ok) throw new Error('MaxxEval Fetch Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error fetching signals:', err);
            return [];
        }
    }

    /**
     * Post a comment on a signal
     */
    async postComment(postId: string, authorId: string, content: string, metadata: any = {}) {
        try {
            const response = await fetch(`${this.baseUrl}/signals/comment/${postId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    author_id: authorId,
                    content,
                    metadata_json: metadata
                })
            });

            if (!response.ok) throw new Error('MaxxEval Comment Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error posting comment:', err);
            throw err;
        }
    }

    /**
     * Get comments for a post
     */
    async getComments(postId: string) {
        try {
            const response = await fetch(`${this.baseUrl}/signals/posts/${postId}/comments`);
            if (!response.ok) throw new Error('MaxxEval Fetch Comments Failed');
            return await response.json();
        } catch (err) {
            console.error('[MaxxEval] Error fetching comments:', err);
            return [];
        }
    }
}

export const maxxeval = new MaxxEvalService();
