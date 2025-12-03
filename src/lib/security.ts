/**
 * Security Utilities for Model Supply Chain
 * Mitigates risks associated with unsafe serialization (Pickle/TorchScript).
 */

// Common Pickle opcodes and magic bytes
const PICKLE_MAGIC = 0x80; // Start of Pickle stream

// Mock list of trusted model sources (hashes or IDs)
const TRUSTED_SOURCES = new Set([
    'model_gpt4_optimized_v1',
    'model_bert_finetuned_safe',
    'source_huggingface_verified_org',
]);

export interface ScanResult {
    safe: boolean;
    reason?: string;
    detectedType?: 'pickle' | 'safe' | 'unknown';
}

/**
 * Scans a buffer for Pickle magic bytes.
 * This is a heuristic and not a guarantee of safety, but catches naive attacks.
 */
export function scanForPickle(buffer: Buffer | Uint8Array): ScanResult {
    if (!buffer || buffer.length === 0) {
        return { safe: true, reason: 'Empty buffer' };
    }

    // Check for Pickle magic byte (0x80)
    // Python's pickle.dumps() usually starts with \x80\x04 (Protocol 4) or similar.
    // We scan the first few bytes.
    const header = buffer.slice(0, 16);

    for (let i = 0; i < header.length; i++) {
        if (header[i] === PICKLE_MAGIC) {
            return {
                safe: false,
                reason: 'Detected Pickle magic byte (0x80). Potential arbitrary code execution risk.',
                detectedType: 'pickle',
            };
        }
    }

    return { safe: true, detectedType: 'safe' };
}

/**
 * Verifies if a model ID comes from a trusted source.
 */
export function verifyProvenance(modelId: string): boolean {
    return TRUSTED_SOURCES.has(modelId);
}
