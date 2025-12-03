import { EventEmitter } from 'events';

export interface AgentEvent {
    type: string;
    payload: any;
    timestamp: number;
    source?: string;
}

class EventBus extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(100); // Allow many SSE connections
    }

    publish(type: string, payload: any, source: string = 'system') {
        const event: AgentEvent = {
            type,
            payload,
            timestamp: Date.now(),
            source,
        };
        this.emit('event', event);
    }

    subscribe(callback: (event: AgentEvent) => void) {
        this.on('event', callback);
        return () => this.off('event', callback);
    }
}

// Singleton instance
export const eventBus = new EventBus();
