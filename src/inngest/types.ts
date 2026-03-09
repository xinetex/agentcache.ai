
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
