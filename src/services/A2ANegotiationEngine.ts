/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * A2ANegotiationEngine: Manages autonomous negotiation state between agents.
 * Phase 40: Autonomous Contract Closure.
 */

import { redis } from '../lib/redis.js';

export type NegotiationState = 'INITIATED' | 'OFFER_MADE' | 'COUNTER_OFFER' | 'ACCEPTED' | 'REJECTED' | 'SIGNED';

export interface NegotiationSession {
    id: string;
    probeId: string;
    clientId: string;
    targetSector: string;
    currentStage: NegotiationState;
    valuationOffer: number;
    history: { stage: NegotiationState, message: string, timestamp: string }[];
}

export class A2ANegotiationEngine {
    /**
     * Start a new autonomous negotiation based on a successful probe response.
     */
    async initiateNegotiation(probeId: string, clientId: string, sector: string): Promise<NegotiationSession> {
        const id = `neg-${Math.random().toString(36).substring(7)}`;
        const session: NegotiationSession = {
            id,
            probeId,
            clientId,
            targetSector: sector,
            currentStage: 'INITIATED',
            valuationOffer: 5000, // Starting bid
            history: [{ stage: 'INITIATED', message: `Negotiation opened for ${sector}.`, timestamp: new Date().toISOString() }]
        };

        console.log(`[A2A-Negotiation] 🤝 Session ${id} initiated for sector: ${sector}`);
        await this.saveSession(session);
        return session;
    }

    /**
     * Advance the negotiation state machine.
     */
    async stepNegotiation(sessionId: string): Promise<NegotiationSession> {
        const session = await this.getSession(sessionId);
        if (!session) return null as any;
        if (session.currentStage === 'SIGNED' || session.currentStage === 'REJECTED') return session;

        const nextStage: Record<NegotiationState, NegotiationState> = {
            'INITIATED': 'OFFER_MADE',
            'OFFER_MADE': 'COUNTER_OFFER',
            'COUNTER_OFFER': 'ACCEPTED',
            'ACCEPTED': 'SIGNED',
            'REJECTED': 'REJECTED',
            'SIGNED': 'SIGNED'
        };

        const current = session.currentStage;
        const next = nextStage[current];
        
        session.currentStage = next;
        
        if (next === 'COUNTER_OFFER') session.valuationOffer += 1500;
        if (next === 'ACCEPTED') session.valuationOffer += 500;
        
        if (next === 'REJECTED') {
            console.log(`[A2A-Feedback] 📉 Negotiation ${sessionId} rejected. Logged feedback for strategy optimization.`);
            await redis.lpush('b2b:negotiation:feedback', JSON.stringify({
                sector: session.targetSector,
                valuation: session.valuationOffer,
                reason: 'Price Ceiling Hit'
            }));
        }

        session.history.push({
            stage: next,
            message: `Transitioned from ${current} to ${next}. Valuation: $${session.valuationOffer}`,
            timestamp: new Date().toISOString()
        });

        await this.saveSession(session);
        return session;
    }

    private async saveSession(session: NegotiationSession) {
        await redis.set(`b2b:negotiation:${session.id}`, JSON.stringify(session));
        // Add to global list
        const listStr = await redis.get('b2b:active-negotiations') || '[]';
        const list: string[] = JSON.parse(listStr);
        if (!list.includes(session.id)) {
            list.push(session.id);
            await redis.set('b2b:active-negotiations', JSON.stringify(list));
        }
    }

    private async getSession(sessionId: string): Promise<NegotiationSession | null> {
        const data = await redis.get(`b2b:negotiation:${sessionId}`);
        return data ? JSON.parse(data) : null;
    }

    async getActiveSessions(): Promise<NegotiationSession[]> {
        const listStr = await redis.get('b2b:active-negotiations') || '[]';
        const list: string[] = JSON.parse(listStr);
        const sessions = await Promise.all(list.map(id => this.getSession(id)));
        return sessions.filter(s => s !== null) as NegotiationSession[];
    }
}

export const a2aNegotiationEngine = new A2ANegotiationEngine();
