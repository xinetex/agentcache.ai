import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface CacheChunkRequest {
  sessionId: string;
  chunkIndex: number;
  chunkHash: string;
  edgeId: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  bytesUploaded?: number;
  errorMessage?: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET: Retrieve chunk metadata
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const sessionId = url.searchParams.get('sessionId');

      if (!sessionId) {
        return new Response(JSON.stringify({ 
          error: 'Missing sessionId parameter' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Get all chunks for session
      const cacheKey = `jetty:chunks:${sessionId}`;
      const chunks = await redis.hgetall(cacheKey);

      if (!chunks || Object.keys(chunks).length === 0) {
        return new Response(JSON.stringify({ 
          chunks: [],
          message: 'No cached chunks found' 
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Parse chunk data
      const parsedChunks = Object.entries(chunks).map(([index, data]) => ({
        chunkIndex: parseInt(index),
        ...(typeof data === 'string' ? JSON.parse(data) : data),
      }));

      return new Response(JSON.stringify({
        chunks: parsedChunks,
        total: parsedChunks.length,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // POST: Cache chunk metadata
    const body = await req.json() as CacheChunkRequest;

    if (!body.sessionId || body.chunkIndex === undefined || !body.status) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: sessionId, chunkIndex, status' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const cacheKey = `jetty:chunks:${body.sessionId}`;
    const chunkData = {
      chunkHash: body.chunkHash,
      edgeId: body.edgeId,
      status: body.status,
      bytesUploaded: body.bytesUploaded || 0,
      errorMessage: body.errorMessage,
      timestamp: new Date().toISOString(),
    };

    // Store chunk metadata (using hash for efficient chunk-level access)
    await redis.hset(cacheKey, {
      [body.chunkIndex.toString()]: JSON.stringify(chunkData),
    });

    // Set expiration (7 days for resume capability)
    await redis.expire(cacheKey, 60 * 60 * 24 * 7);

    // Also cache upload session state
    const sessionKey = `jetty:session:${body.sessionId}`;
    const sessionData = await redis.get(sessionKey);
    
    if (sessionData) {
      const session = typeof sessionData === 'string' 
        ? JSON.parse(sessionData) 
        : sessionData;
      
      // Update progress
      if (body.status === 'completed') {
        session.chunksCompleted = (session.chunksCompleted || 0) + 1;
        session.bytesUploaded = (session.bytesUploaded || 0) + (body.bytesUploaded || 0);
      }
      
      session.lastUpdated = new Date().toISOString();
      
      await redis.set(sessionKey, JSON.stringify(session), {
        ex: 60 * 60 * 24 * 7, // 7 days
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Chunk metadata cached',
      chunk: {
        sessionId: body.sessionId,
        chunkIndex: body.chunkIndex,
        status: body.status,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Cache chunk error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
