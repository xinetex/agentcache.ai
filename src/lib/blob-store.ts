import fs from 'fs';
import path from 'path';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';

export interface BlobStore {
    put(key: string, stream: Readable): Promise<void>;
    get(key: string): Promise<Readable | null>;
    exists(key: string): Promise<boolean>;
    delete(key: string): Promise<void>;
}

export class LocalFileStore implements BlobStore {
    private storageDir: string;

    constructor(storageDir: string) {
        this.storageDir = storageDir;
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
        }
    }

    async put(key: string, stream: Readable): Promise<void> {
        const filePath = path.join(this.storageDir, key);
        const writeStream = fs.createWriteStream(filePath);
        await pipeline(stream, writeStream);
    }

    async get(key: string): Promise<Readable | null> {
        const filePath = path.join(this.storageDir, key);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        return fs.createReadStream(filePath);
    }

    async exists(key: string): Promise<boolean> {
        const filePath = path.join(this.storageDir, key);
        return fs.existsSync(filePath);
    }

    async delete(key: string): Promise<void> {
        const filePath = path.join(this.storageDir, key);
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
    }
}

// Singleton instance for the app
// In a real HPC setup, this path would be a mount point like /mnt/lustre/agentcache
export const blobStore = new LocalFileStore(path.join(process.cwd(), 'storage_blobs'));
