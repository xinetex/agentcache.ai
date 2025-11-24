/**
 * AgentCache Binary Protocol (ACBP)
 * 
 * A lightweight, zero-dependency binary serialization format optimized for 
 * High-Frequency Trading (HFT) agent communication.
 * 
 * Structure:
 * [Header: 4 bytes] [Metadata Length: 2 bytes] [Metadata: JSON] [Payload: Binary/Text]
 */

export interface SerializedMessage {
    buffer: Uint8Array;
    size: number;
}

export interface MessageEnvelope {
    id: string;
    type: 'market_event' | 'signal' | 'order';
    timestamp: number;
    payload: any;
}

const HEADER_MAGIC = 0xAC; // AgentCache Magic Byte
const VERSION = 1;

export class BinarySerializer {
    private encoder = new TextEncoder();
    private decoder = new TextDecoder();

    /**
     * Serializes a message into a compact binary format.
     */
    serialize(message: MessageEnvelope): SerializedMessage {
        // 1. Serialize Payload & Metadata to JSON (fastest in JS engines)
        const jsonString = JSON.stringify(message);
        const payloadBytes = this.encoder.encode(jsonString);

        // 2. Allocate Buffer
        // Header (4) + Length (4) + Payload
        const totalSize = 4 + 4 + payloadBytes.length;
        const buffer = new Uint8Array(totalSize);
        const view = new DataView(buffer.buffer);

        // 3. Write Header
        view.setUint8(0, HEADER_MAGIC);
        view.setUint8(1, VERSION);
        view.setUint16(2, 0); // Reserved

        // 4. Write Payload Length
        view.setUint32(4, payloadBytes.length);

        // 5. Write Payload
        buffer.set(payloadBytes, 8);

        return { buffer, size: totalSize };
    }

    /**
     * Deserializes a binary message back into an object.
     */
    deserialize(buffer: Uint8Array): MessageEnvelope {
        const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

        // 1. Validate Header
        if (view.getUint8(0) !== HEADER_MAGIC) {
            throw new Error('Invalid Magic Byte: Not an AgentCache message');
        }

        // 2. Read Length
        const payloadLength = view.getUint32(4);

        // 3. Read Payload
        const payloadBytes = buffer.subarray(8, 8 + payloadLength);
        const jsonString = this.decoder.decode(payloadBytes);

        return JSON.parse(jsonString);
    }
}

export const serializer = new BinarySerializer();
