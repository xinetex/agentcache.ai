
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

export const schemas = new EventSchemas().fromRecord({
    "agent/loop.triggered": {} as AgentLoopTriggered,
    "payment/succeeded": {} as PaymentSucceeded,
    "report/requested": {} as ReportRequested
});
