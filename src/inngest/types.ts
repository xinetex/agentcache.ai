/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */

import { EventSchemas } from "inngest";

type AgentLoopTriggered = {
    data: {
        agentId?: string; // Optional: Run specific agent
        force?: boolean;
    }
};

type PaymentSucceeded = {
    data: {
        userId: string;
        amount: number;
        sessionId: string;
    }
};

type ReportRequested = {
    data: {
        topic: string;
        requesterId: string;
    }
};

export const schemas = (new EventSchemas() as any).fromRecord({
    "agent/loop.triggered": {
        data: {} as { agentId?: string; force?: boolean }
    },
    "payment/succeeded": {
        data: {} as { userId: string; amount: number; sessionId: string }
    },
    "report/requested": {
        data: {} as { topic: string; requesterId: string }
    },
    "compute/job.submitted": {
        data: {} as { jobId: string; payload: any }
    },
    "agent/swarm.start": {
        data: {} as { swarmId: string; agents: string[] }
    }
}) as any;
