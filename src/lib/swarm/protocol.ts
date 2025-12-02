import { redis } from '../redis.js';
import { v4 as uuidv4 } from 'uuid';

export interface AgentTask {
    id: string;
    type: string;
    payload: any;
    priority: number;
    requester: string;
    timestamp: number;
}

export interface AgentBid {
    taskId: string;
    agentId: string;
    bidScore: number; // 0-1, how well suited the agent is
    timestamp: number;
}

export interface AgentResult {
    taskId: string;
    agentId: string;
    result: any;
    status: 'success' | 'failure';
    timestamp: number;
}

export class SwarmNode {
    public agentId: string;
    private capabilities: string[];

    constructor(agentId: string = uuidv4(), capabilities: string[] = []) {
        this.agentId = agentId;
        this.capabilities = capabilities;
    }

    /**
     * Join the swarm: Subscribe to task broadcasts
     */
    async join() {
        // In a real implementation, we would use a separate Redis connection for subscriptions
        // For now, we assume the shared redis client can handle it or we'd create a duplicate
        // But ioredis requires a dedicated connection for subscribers.
        // So we will rely on the caller to provide a subscriber client or handle it externally for this MVP.
        // Actually, let's just publish for now.
        console.log(`[Swarm] Agent ${this.agentId} joined with capabilities: ${this.capabilities.join(', ')}`);
    }

    /**
     * Broadcast a task to the swarm
     */
    async broadcastTask(type: string, payload: any, priority: number = 1): Promise<string> {
        const task: AgentTask = {
            id: uuidv4(),
            type,
            payload,
            priority,
            requester: this.agentId,
            timestamp: Date.now()
        };

        await redis.publish('swarm:tasks', JSON.stringify(task));
        // Also store in a persistent list/stream for reliability
        await redis.lpush('swarm:queue:pending', JSON.stringify(task));

        return task.id;
    }

    /**
     * Submit a bid for a task
     */
    async bidForTask(taskId: string, score: number) {
        const bid: AgentBid = {
            taskId,
            agentId: this.agentId,
            bidScore: score,
            timestamp: Date.now()
        };
        await redis.publish(`swarm:task:${taskId}:bids`, JSON.stringify(bid));
    }

    /**
     * Submit a result for a completed task
     */
    async submitResult(taskId: string, result: any, status: 'success' | 'failure' = 'success') {
        const res: AgentResult = {
            taskId,
            agentId: this.agentId,
            result,
            status,
            timestamp: Date.now()
        };

        // Publish to results channel
        await redis.publish('swarm:results', JSON.stringify(res));

        // Store result
        await redis.setex(`swarm:task:${taskId}:result`, 3600, JSON.stringify(res));
    }
}
