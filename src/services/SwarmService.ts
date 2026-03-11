import { redis } from '../lib/redis.js';
import { v4 as uuidv4 } from 'uuid';
import { SwarmNode, AgentTask } from '../lib/swarm/protocol.js';
import { agentOrchestrator } from './AgentOrchestrator.js';
import { coherenceService } from './CoherenceService.js';

export interface SwarmConfig {
    id?: string;
    goal: string;
    participants: { role: string; count: number }[];
    priority?: number;
}

/**
 * SwarmService: Orchestrates multi-agent swarms to achieve complex goals.
 */
export class SwarmService {
    private activeSwarms: Map<string, any> = new Map();

    /**
     * Spawn a new swarm based on a goal.
     */
    async spawnSwarm(config: SwarmConfig): Promise<any> {
        const swarmId = config.id || `swarm_${uuidv4().slice(0, 8)}`;
        console.log(`[SwarmService] Spawning swarm ${swarmId} for goal: ${config.goal}`);

        // 1. Identify/Spawn participant actors
        const actors = [];
        for (const part of config.participants) {
            // Find or spawn actors with this role
            // Logic: 
            // a. Check for idle actors with the role
            // b. If not enough, spawn new ones from hub profiles
            
            // Simplified for now: Spawn one fresh actor per requirement
            const actorsForRole = await agentOrchestrator.getActiveActors();
            let relevant = actorsForRole.filter(a => a.role === part.role && a.status === 'idle');
            
            for (let i = 0; i < part.count; i++) {
                let actor;
                if (relevant[i]) {
                    actor = relevant[i];
                } else {
                    // Need to find profileId for role
                    // For now, assume seed data exists with role-based IDs
                    const profileId = `prof_${part.role}`; 
                    actor = await agentOrchestrator.spawn(profileId, { name: `${part.role.toUpperCase()}-${i+1}` });
                }
                actors.push(actor);
                
                // Transition to working
                await agentOrchestrator.transition(actor.id, 'working');
                await agentOrchestrator.heartbeat(actor.id, { 
                    currentTask: { type: 'swarm', swarmId, goal: config.goal } 
                });
            }
        }

        // 2. Initialize Swarm Protocol Node for the "Master" or "Controller"
        const controllerNode = new SwarmNode('swarm-controller-' + swarmId);
        await controllerNode.join();

        // 3. Broadcast initial task to the swarm
        const taskId = await controllerNode.broadcastTask('swarm_init', {
            swarmId,
            goal: config.goal,
            participants: actors.map(a => a.id)
        }, config.priority || 2);

        // Audit Bus: Log spawning event for coherence monitoring
        await coherenceService.logMessage(swarmId, 'system', `Spawned swarm for goal: ${config.goal}`, {
            actors: actors.length,
            priority: config.priority || 2
        });

        const swarmData = {
            id: swarmId,
            goal: config.goal,
            actors: actors.map(a => ({ id: a.id, role: a.role })),
            status: 'active',
            startTime: Date.now(),
            rootTaskId: taskId
        };

        this.activeSwarms.set(swarmId, swarmData);
        await redis.set(`swarm:active:${swarmId}`, JSON.stringify(swarmData), 'EX', 86400); // 1 day

        return swarmData;
    }

    async getSwarmStatus(swarmId: string): Promise<any> {
        const data = await redis.get(`swarm:active:${swarmId}`);
        return data ? JSON.parse(data) : null;
    }

    async listActiveSwarms(): Promise<any[]> {
        const keys = await redis.keys('swarm:active:*');
        const swarms = await Promise.all(keys.map(async k => {
            const val = await redis.get(k);
            return JSON.parse(val!);
        }));
        return swarms;
    }
}

export const swarmService = new SwarmService();
