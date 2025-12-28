/**
 * Encore API Client
 * Submit transcoding jobs to SVT Encore on Railway
 */

interface EncoreInput {
    uri: string;
    type: 'AudioVideo' | 'Video' | 'Audio';
    useFirstAudioStreams?: number;
}

interface EncoreJobRequest {
    profile: string;
    outputFolder: string;
    baseName: string;
    inputs: EncoreInput[];
    priority?: number;
}

interface EncoreJob {
    id: string;
    status: 'NEW' | 'QUEUED' | 'IN_PROGRESS' | 'SUCCESSFUL' | 'FAILED';
    progress: number;
    createdDate: string;
    startedDate?: string;
    completedDate?: string;
    message?: string;
    output?: {
        files: string[];
    };
}

export class EncoreClient {
    private baseUrl: string;
    private lyveEndpoint: string;
    private lyveBucket: string;

    constructor() {
        this.baseUrl = process.env.ENCORE_URL || 'https://encore.railway.app';
        this.lyveEndpoint = process.env.LYVE_ENDPOINT || 'https://s3.us-west-1.lyvecloud.seagate.com';
        this.lyveBucket = process.env.LYVE_BUCKET || 'jettydata-prod';
    }

    /**
     * Submit a video for transcoding
     */
    async submitJob(
        inputKey: string,
        profile: string = 'roku-hls',
        outputPrefix?: string
    ): Promise<EncoreJob> {
        const baseName = outputPrefix || inputKey.split('/').pop()?.replace(/\.[^.]+$/, '') || 'video';
        const outputFolder = `s3://${this.lyveBucket}/transcoded/${baseName}/`;

        const request: EncoreJobRequest = {
            profile,
            outputFolder,
            baseName,
            inputs: [{
                uri: `s3://${this.lyveBucket}/${inputKey}`,
                type: 'AudioVideo',
                useFirstAudioStreams: 2
            }],
            priority: 5
        };

        const response = await fetch(`${this.baseUrl}/encoreJobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            throw new Error(`Encore job submission failed: ${response.status}`);
        }

        return response.json();
    }

    /**
     * Get job status
     */
    async getJob(jobId: string): Promise<EncoreJob> {
        const response = await fetch(`${this.baseUrl}/encoreJobs/${jobId}`);
        if (!response.ok) {
            throw new Error(`Failed to get job: ${response.status}`);
        }
        return response.json();
    }

    /**
     * Wait for job completion with polling
     */
    async waitForCompletion(
        jobId: string,
        pollIntervalMs: number = 5000,
        timeoutMs: number = 600000
    ): Promise<EncoreJob> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            const job = await this.getJob(jobId);

            if (job.status === 'SUCCESSFUL' || job.status === 'FAILED') {
                return job;
            }

            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }

        throw new Error(`Job ${jobId} timed out after ${timeoutMs}ms`);
    }

    /**
     * List all jobs
     */
    async listJobs(page: number = 0, size: number = 20): Promise<EncoreJob[]> {
        const response = await fetch(`${this.baseUrl}/encoreJobs?page=${page}&size=${size}`);
        if (!response.ok) {
            throw new Error(`Failed to list jobs: ${response.status}`);
        }
        const data = await response.json();
        return data._embedded?.encoreJobs || [];
    }

    /**
     * Cancel a queued job
     */
    async cancelJob(jobId: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/encoreJobs/${jobId}/cancel`, {
            method: 'POST'
        });
        if (!response.ok) {
            throw new Error(`Failed to cancel job: ${response.status}`);
        }
    }
}

// Singleton instance
let encoreClient: EncoreClient | null = null;

export function getEncoreClient(): EncoreClient {
    if (!encoreClient) {
        encoreClient = new EncoreClient();
    }
    return encoreClient;
}
