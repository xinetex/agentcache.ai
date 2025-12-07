/**
 * SanitizationStream
 * 
 * A TransformStream that buffers text chunks to securely redact PII 
 * even when it spans across chunk boundaries.
 */

import { PolicyEngine } from '../policy.js';

export class SanitizationStream extends TransformStream {
    constructor(apiKey) {
        const policy = new PolicyEngine(apiKey);
        let buffer = '';

        super({
            async transform(chunk, controller) {
                // Decode chunk if it's Uint8Array
                const text = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk);
                buffer += text;

                // Process buffer if it gets too large or has safe boundaries
                // We want to keep some context (overlap) or process complete sentences/words
                // Simple strategy: Split by last whitespace to avoid breaking tokens, 
                // process the safe part, keep the rest in buffer.

                const lastSpace = buffer.lastIndexOf(' ');
                const lastNewline = buffer.lastIndexOf('\n');
                const safeIndex = Math.max(lastSpace, lastNewline);

                if (safeIndex > -1) {
                    const toProcess = buffer.slice(0, safeIndex + 1);
                    buffer = buffer.slice(safeIndex + 1);

                    // Run Policy Engine (Sync check for regex is fast)
                    // Note: validate is async in PolicyEngine due to TopicCheck, 
                    // but for Streaming output we mainly care about PII (Regex).
                    // We might skip Topic Check on output streams for latency, or check first chunk only.

                    // We need a synchronous PII check or await the full check. 
                    // PolicyEngine.validate returns { sanitizedContent }

                    const result = await policy.validate({ content: toProcess });
                    controller.enqueue(new TextEncoder().encode(result.sanitizedContent));
                }

                // Failsafe: if buffer grows too large without spaces (e.g. huge token), force process
                if (buffer.length > 1000) {
                    const result = await policy.validate({ content: buffer });
                    controller.enqueue(new TextEncoder().encode(result.sanitizedContent));
                    buffer = '';
                }
            },

            async flush(controller) {
                if (buffer) {
                    const result = await policy.validate({ content: buffer });
                    controller.enqueue(new TextEncoder().encode(result.sanitizedContent));
                }
            }
        });
    }
}
