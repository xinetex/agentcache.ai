import { LogService } from '../../src/services/LogService.js';

export default async function handler(req, res) {
    // 1. Parse Cursor (for live tailing)
    // If client sends ?since=TIMESTAMP, only return logs after that.
    const sinceParam = req.query.since;
    const since = sinceParam ? parseInt(sinceParam as string) : 0;

    // 2. Fetch Real Logs
    const liveLogs = LogService.getLogs(50, since);

    // 3. Format for Frontend
    // Convert backend Level to Frontend Color class
    const logs = liveLogs.map(l => ({
        id: l.timestamp + Math.random(), // simplistic unique key
        timestampStr: new Date(l.timestamp).toLocaleTimeString(),
        timestampRaw: l.timestamp,
        level: l.level.toUpperCase(),
        levelColor: getLevelColor(l.level),
        source: l.source.toUpperCase(),
        message: l.message
    }));

    // 4. Return new cursor (max timestamp seen)
    const newCursor = logs.length > 0 ? Math.max(...logs.map(l => l.timestampRaw)) : since;


    return res.status(200).json({
        logs,
        cursor: newCursor
    });
}

function getLevelColor(level: string) {
    switch (level) {
        case 'info': return 'text-blue-400';
        case 'warn': return 'text-yellow-400';
        case 'error': return 'text-red-400';
        case 'success': return 'text-emerald-400';
        default: return 'text-gray-400';
    }
}
