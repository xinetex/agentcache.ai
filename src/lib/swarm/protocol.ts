import { redis } from '../redis.js';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export interface AgentTask {
    id: string;
    type: string;
    payload: any;
    priority: number;
    requester: string;
    timestamp: number;
    signature?: string;
}

export interface AgentBid {
    taskId: string;
    agentId: string;
    bidScore: number;
    timestamp: number;
}

export interface AgentResult {
    taskId: string;
    agentId: string;
    result: any;
    status: 'success' | 'failure';
    timestamp: number;
}

export class SwarmNode extends EventEmitter {
    private agentId: string;
    private capabilities: string[];
    private subscriber: any; // Redis client for subscription
    private secretKey: string;

    constructor(agentId: string, capabilities: string[] = []) {
        super();
        this.agentId = agentId;
        this.capabilities = capabilities;
        this.secretKey = process.env.SWARM_SECRET_KEY || 'default-insecure-dev-key';

        if (this.secretKey === 'default-insecure-dev-key') {
            console.warn('⚠️  [SwarmNode] Using default SWARM_SECRET_KEY!');
        }
    }

    private signTask(task: Partial<AgentTask>): string {
        const payloadStr = JSON.stringify(task.payload || {});
        const data = `${task.id}:${task.type}:${payloadStr}:${task.timestamp}:${task.requester}`;
        return crypto.createHmac('sha256', this.secretKey).update(data).digest('hex');
    }

    private verifyTask(task: AgentTask): boolean {
        if (!task.signature) {
            console.warn(`[Swarm] 🛑 Dropped unsigned task: ${task.id}`);
            return false;
        }
        const expected = this.signTask(task);
        if (expected !== task.signature) {
            console.warn(`[Swarm] 🛑 Dropped invalid signature: ${task.id}`);
            return false;
        }
        const now = Date.now();
        if (now - task.timestamp > 300000) { // 5 mins
            console.warn(`[Swarm] 🛑 Dropped expired task: ${task.id}`);
            return false;
        }
        return true;
    }

    async join() {
        // Create duplicate connection for subscription (required by Redis)
        this.subscriber = redis.duplicate();

        // Subscribe to global task channel
        await this.subscriber.subscribe('swarm:tasks');

        // Subscribe to results channel (to see when things finish)
        await this.subscriber.subscribe('swarm:results');

        // Handle incoming messages
        this.subscriber.on('message', (channel: string, message: string) => {
            try {
                const data = JSON.parse(message);

                if (channel === 'swarm:tasks') {
                    if (this.verifyTask(data)) {
                        this.emit('task', data);
                    }
                } else if (channel === 'swarm:results') {
                    this.emit('result', data);
                } else if (channel.includes(':bids')) {
                    this.emit('bid', data);
                }
            } catch (err) {
                console.error('[Swarm] Failed to parse message:', err);
            }
        });

        console.log(`[Swarm] Agent ${this.agentId} joined and listening.`);
    }

    async listenForBids(taskId: string) {
        if (this.subscriber) {
            await this.subscriber.subscribe(`swarm:task:${taskId}:bids`);
        }
    }

    async broadcastTask(type: string, payload: any, priority: number = 1): Promise<string> {
        const task: AgentTask = {
            id: uuidv4(),
            type,
            payload,
            priority,
            requester: this.agentId,
            timestamp: Date.now()
        };

        task.signature = this.signTask(task);

        // Subscribe to bids BEFORE publishing the task to avoid race conditions
        if (this.subscriber) {
            await this.subscriber.subscribe(`swarm:task:${task.id}:bids`);
        }

        await redis.publish('swarm:tasks', JSON.stringify(task));
        // Also store in a persistent list/stream for reliability
        await redis.lpush('swarm:queue:pending', JSON.stringify(task));

        return task.id;
    }

    async bidForTask(taskId: string, score: number) {
        const bid: AgentBid = {
            taskId,
            agentId: this.agentId,
            bidScore: score,
            timestamp: Date.now()
        };

        await redis.publish(`swarm:task:${taskId}:bids`, JSON.stringify(bid));
    }

    async submitResult(taskId: string, result: any, status: 'success' | 'failure' = 'success') {
        const res: AgentResult = {
            taskId,
            agentId: this.agentId,
            result,
            status,
            timestamp: Date.now()
        };

        await redis.publish('swarm:results', JSON.stringify(res));
        // Store result persistently (TTL 1 hour)
        await redis.set(`swarm:task:${taskId}:result`, JSON.stringify(res), 'EX', 3600);
    }
}


