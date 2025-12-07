
/**
 * Observability Tracer for AgentCache
 * Handles span collection and flushing to storage (Redis)
 * Designed for Edge Runtime
 */

export class Tracer {
    constructor(config) {
        this.redisUrl = config.redisUrl;
        this.redisToken = config.redisToken;
        this.webhookUrl = config.webhookUrl;
        this.context = {
            traceId: config.traceId || crypto.randomUUID(),
            spans: [],
            models: new Set(),
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            totalLatency: 0,
            startTime: Date.now(),
            strategy: 'standard'
        };
    }

    startSpan(name, attributes = {}) {
        return {
            id: crypto.randomUUID(),
            name,
            startTime: Date.now(),
            status: 'success',
            attributes,
            cached: false
        };
    }

    endSpan(span, error) {
        span.endTime = Date.now();
        span.latency = span.endTime - span.startTime;

        if (error) {
            span.status = 'error';
            span.attributes.error = error.message || String(error);
            this.context.errors++;
        }

        // Extract common metrics
        if (span.attributes.provider) span.provider = span.attributes.provider;
        if (span.attributes.model) {
            span.model = span.attributes.model;
            this.context.models.add(span.model);
        }
        if (span.attributes.hit) {
            this.context.cacheHits++;
            span.cached = true;
        } else if (span.attributes.hit === false) {
            this.context.cacheMisses++;
            span.cached = false;
        }

        this.context.spans.push(span);
        return span;
    }

    getTraceId() {
        return this.context.traceId;
    }

    async flush() {
        this.context.totalLatency = Date.now() - this.context.startTime;

        // Prepare for storage
        const payload = {
            ...this.context,
            models: Array.from(this.context.models), // Serialize Set
            timestamp: this.context.startTime
        };

        try {
            // Use raw fetch to avoid heavy dependencies in Edge
            const res = await fetch(`${this.redisUrl}/set/trace:${this.context.traceId}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.redisToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(JSON.stringify(payload)) // Double stringify to store as string value
            });

            // Allow async flush to not block, but we return promise if caller awaits
            if (!res.ok) {
                console.error('Failed to flush trace', await res.text());
            }

        } catch (err) {
            console.error('Tracer flush error:', err);
        }

        if (this.webhookUrl) {
            try {
                // Fire and forget webhook
                fetch(this.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(err => console.error('Webhook flush failed', err));
            } catch (ignore) { }
        }
    }
}
