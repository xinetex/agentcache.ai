import { jettySpeedDb } from '../../src/services/jettySpeedDb';
import { edgeSelector } from '../../src/services/edgeSelector';
import { v4 as uuidv4 } from 'uuid';

export const config = {
  runtime: 'edge',
};

interface OptimalEdgesRequest {
  userId: string;
  fileSize: number;
  fileHash: string;
  fileName?: string;
  userLocation?: {
    lat: number;
    lng: number;
    city?: string;
  };
  priority?: 'speed' | 'cost' | 'balanced';
  budget?: number;
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json() as OptimalEdgesRequest;

    // Validate required fields
    if (!body.userId || !body.fileSize || !body.fileHash) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: userId, fileSize, fileHash' 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Check for duplicate file (deduplication)
    const existingFile = await jettySpeedDb.checkFileHash(body.fileHash);
    
    if (existingFile) {
      // File already exists - return duplicate info
      const savedCost = (body.fileSize / 1024 / 1024 / 1024) * 0.10; // $0.10/GB

      // Create user file reference for tracking
      await jettySpeedDb.createUserFileReference({
        user_id: body.userId,
        file_hash: body.fileHash,
        file_name: body.fileName || 'unknown',
      });

      return new Response(JSON.stringify({
        duplicate: {
          fileId: existingFile.file_id,
          url: `https://s3.lyvecloud.seagate.com/${existingFile.storage_key}`,
          savedBytes: body.fileSize,
          savedCost: parseFloat(savedCost.toFixed(4)),
          message: 'File already exists. Zero-cost clone available.',
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Get active edges
    const edges = await jettySpeedDb.getActiveEdges();

    if (edges.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No active edges available' 
      }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Get edge metrics (or use mock for MVP)
    let metrics = await jettySpeedDb.getAllEdgeMetrics();
    
    // If no real metrics, use mock data
    if (metrics.size === 0) {
      metrics = edgeSelector.generateMockMetrics(edges);
    }

    // 4. Select optimal edges
    const userLocation = body.userLocation || {
      lat: 37.7749,  // Default: San Francisco
      lng: -122.4194,
      city: 'San Francisco'
    };

    const priority = body.priority || 'balanced';
    const selectedEdges = edgeSelector.selectOptimalEdges(
      edges,
      metrics,
      userLocation,
      priority,
      5 // Top 5 edges
    );

    // 5. Add direct Lyve option
    const edgesWithLyve = edgeSelector.addDirectLyveOption(
      selectedEdges,
      userLocation
    );

    // 6. Calculate upload strategy
    const strategy = edgeSelector.calculateStrategy(
      body.fileSize,
      selectedEdges,
      priority
    );

    // 7. Format response
    const response = {
      strategy: {
        chunkSize: strategy.chunkSize,
        threads: strategy.threads,
        compression: strategy.compression,
        estimatedTime: strategy.estimatedTime,
        estimatedCost: strategy.estimatedCost,
      },
      edges: edgesWithLyve.map(e => ({
        id: e.edge.id,
        url: e.edge.url,
        latency: e.latency,
        load: e.load,
        distance: Math.round(e.distance),
        weight: parseFloat(e.weight.toFixed(3)),
      })),
      duplicate: null,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Optimal edges error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
