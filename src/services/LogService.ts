
export interface LogEntry {
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'success';
    source: string;
    message: string;
    metadata?: any;
}

export class LogService {
    // In-memory buffer for the MVP. 
    // In production, this would write to ClickHouse, Datadog, or Postgres.
    private static logs: LogEntry[] = [];
    private static MAX_LOGS = 1000;

    static log(source: string, level: 'info' | 'warn' | 'error' | 'success', message: string, metadata?: any) {
        const entry: LogEntry = {
            timestamp: Date.now(),
            level,
            source,
            message,
            metadata
        };

        this.logs.push(entry);

        // Rotate if full
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift();
        }

        // Also console log for Vercel/Server logs
        const color = level === 'error' ? '\x1b[31m' : level === 'success' ? '\x1b[32m' : '\x1b[34m';
        console.log(`${color}[${source.toUpperCase()}] ${message}\x1b[0m`);
    }

    static getLogs(limit: number = 50, since?: number): LogEntry[] {
        let result = this.logs;
        if (since) {
            result = result.filter(l => l.timestamp > since);
        }
        return result.slice(-limit);
    }
}
