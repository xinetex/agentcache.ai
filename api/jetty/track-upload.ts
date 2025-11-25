import { jettySpeedDb } from '../../src/services/jettySpeedDb';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from '@upstash/redis';

export const config = {
  runtime: 'edge',
};

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface TrackUploadRequest {
  action: 'start' | 'progress' | 'complete' | 'fail';
  
  // For 'start'
  userId?: string;
  fileId?: string;
  fileName?: string;
  fileHash?: string;
  fileSize?: number;
  chunkSize?: number;
  threads?: number;
  edgesUsed?: string[];
  chunksTotal?: number;
  estimatedCost?: number;
  uploadVia?: string;
  jettySpeedEnabled?: boolean;
  
  // For 'progress', 'complete', 'fail'
  sessionId?: string;
  chunksCompleted?: number;
  bytesUploaded?: number;
  actualCost?: number;
  errorMessage?: string;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
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

    const body = await req.json() as TrackUploadRequest;

    if (!body.action) {
      return new Response(JSON.stringify({ 
        error: 'Missing required field: action' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // START: Create new upload session
    if (body.action === 'start') {
      if (!body.userId || !body.fileSize || !body.fileHash || !body.fileName) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields for start: userId, fileName, fileSize, fileHash' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const sessionId = uuidv4();
      const fileId = body.fileId || uuidv4();

      // Create upload session in database
      const session = await jettySpeedDb.createUploadSession({
        user_id: body.userId,
        file_id: fileId,
        file_name: body.fileName,
        file_hash: body.fileHash,
        file_size: body.fileSize,
        chunk_size: body.chunkSize || 50 * 1024 * 1024,
        threads: body.threads || 16,
        edges_used: body.edgesUsed || [],
        chunks_total: body.chunksTotal || Math.ceil(body.fileSize / (body.chunkSize || 50 * 1024 * 1024)),
        estimated_cost: body.estimatedCost || 0,
        upload_via: body.uploadVia || 'web',
        jetty_speed_enabled: body.jettySpeedEnabled || false,
      });

      // Cache session in Redis for fast access
      const sessionKey = `jetty:session:${session.id}`;
      await redis.set(sessionKey, JSON.stringify({
        sessionId: session.id,
        userId: body.userId,
        fileId: fileId,
        fileName: body.fileName,
        fileSize: body.fileSize,
        chunksTotal: session.chunks_total,
        chunksCompleted: 0,
        bytesUploaded: 0,
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      }), {
        ex: 60 * 60 * 24 * 7, // 7 days
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Upload session created',
        session: {
          sessionId: session.id,
          fileId: fileId,
          chunksTotal: session.chunks_total,
          estimatedTime: Math.ceil(body.fileSize / 1024 / 1024 / 100), // rough estimate
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // PROGRESS: Update upload progress
    if (body.action === 'progress') {
      if (!body.sessionId || body.chunksCompleted === undefined || body.bytesUploaded === undefined) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields for progress: sessionId, chunksCompleted, bytesUploaded' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update database
      await jettySpeedDb.updateUploadProgress(body.sessionId, {
        chunks_completed: body.chunksCompleted,
        bytes_uploaded: body.bytesUploaded,
      });

      // Update Redis cache
      const sessionKey = `jetty:session:${body.sessionId}`;
      const sessionData = await redis.get(sessionKey);
      
      if (sessionData) {
        const session = typeof sessionData === 'string' 
          ? JSON.parse(sessionData) 
          : sessionData;
        
        session.chunksCompleted = body.chunksCompleted;
        session.bytesUploaded = body.bytesUploaded;
        session.lastUpdated = new Date().toISOString();
        
        await redis.set(sessionKey, JSON.stringify(session), {
          ex: 60 * 60 * 24 * 7,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Progress updated',
        progress: {
          chunksCompleted: body.chunksCompleted,
          bytesUploaded: body.bytesUploaded,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // COMPLETE: Mark upload as completed
    if (body.action === 'complete') {
      if (!body.sessionId) {
        return new Response(JSON.stringify({ 
          error: 'Missing required field for complete: sessionId' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Complete session in database
      await jettySpeedDb.completeUploadSession(
        body.sessionId,
        body.actualCost || 0
      );

      // Update Redis cache
      const sessionKey = `jetty:session:${body.sessionId}`;
      const sessionData = await redis.get(sessionKey);
      
      if (sessionData) {
        const session = typeof sessionData === 'string' 
          ? JSON.parse(sessionData) 
          : sessionData;
        
        session.status = 'completed';
        session.completedAt = new Date().toISOString();
        
        await redis.set(sessionKey, JSON.stringify(session), {
          ex: 60 * 60 * 24 * 7,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Upload completed',
        sessionId: body.sessionId,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // FAIL: Mark upload as failed
    if (body.action === 'fail') {
      if (!body.sessionId) {
        return new Response(JSON.stringify({ 
          error: 'Missing required field for fail: sessionId' 
        }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Update database
      await jettySpeedDb.updateUploadProgress(body.sessionId, {
        chunks_completed: body.chunksCompleted || 0,
        bytes_uploaded: body.bytesUploaded || 0,
        status: 'failed',
      });

      // Update Redis cache
      const sessionKey = `jetty:session:${body.sessionId}`;
      const sessionData = await redis.get(sessionKey);
      
      if (sessionData) {
        const session = typeof sessionData === 'string' 
          ? JSON.parse(sessionData) 
          : sessionData;
        
        session.status = 'failed';
        session.errorMessage = body.errorMessage;
        session.failedAt = new Date().toISOString();
        
        await redis.set(sessionKey, JSON.stringify(session), {
          ex: 60 * 60 * 24 * 7,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Upload marked as failed',
        sessionId: body.sessionId,
        errorMessage: body.errorMessage,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Invalid action. Must be: start, progress, complete, or fail' 
    }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Track upload error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
