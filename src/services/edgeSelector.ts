import { EdgeLocation, EdgeMetric } from './jettySpeedDb';

// Haversine distance calculation (km)
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface UserLocation {
  lat: number;
  lng: number;
  city?: string;
}

export interface EdgeScore {
  edge: EdgeLocation;
  metric?: EdgeMetric;
  distance: number;
  score: number;
  weight: number;
  latency: number;
  load: number;
}

export interface UploadStrategy {
  chunkSize: number;
  threads: number;
  compression: string;
  estimatedTime: number;
  estimatedCost: number;
}

export class EdgeSelector {
  // Calculate edge score based on multiple factors
  private calculateScore(
    edge: EdgeLocation,
    metric: EdgeMetric | undefined,
    userLocation: UserLocation,
    priority: 'speed' | 'cost' | 'balanced'
  ): number {
    const distance = haversineDistance(
      userLocation.lat, userLocation.lng,
      edge.lat, edge.lng
    );

    // Default metric values if not available (mock)
    const latency = metric?.latency_ms || Math.max(20, distance / 50); // ~1ms per 50km
    const load = metric?.load_percent || 30; // Default 30% load
    const bandwidth = metric?.bandwidth_mbps || 1000; // Default 1 Gbps
    const errorRate = metric?.error_rate || 0;

    // Scoring weights based on priority
    let distanceWeight = 0.3;
    let latencyWeight = 0.3;
    let loadWeight = 0.2;
    let bandwidthWeight = 0.15;
    let errorWeight = 0.05;

    if (priority === 'speed') {
      latencyWeight = 0.4;
      bandwidthWeight = 0.3;
      loadWeight = 0.15;
      distanceWeight = 0.1;
      errorWeight = 0.05;
    } else if (priority === 'cost') {
      loadWeight = 0.4; // Lower load = cheaper
      distanceWeight = 0.3; // Closer = cheaper
      latencyWeight = 0.15;
      bandwidthWeight = 0.1;
      errorWeight = 0.05;
    }

    // Normalize and invert scores (higher is better)
    const distanceScore = Math.max(0, 1 - (distance / 10000)); // 0-10000km range
    const latencyScore = Math.max(0, 1 - (latency / 200)); // 0-200ms range
    const loadScore = Math.max(0, 1 - (load / 100)); // 0-100% range
    const bandwidthScore = Math.min(1, bandwidth / 1000); // 0-1000 Mbps range
    const errorScore = Math.max(0, 1 - (errorRate / 10)); // 0-10% range

    const totalScore =
      (distanceScore * distanceWeight) +
      (latencyScore * latencyWeight) +
      (loadScore * loadWeight) +
      (bandwidthScore * bandwidthWeight) +
      (errorScore * errorWeight);

    return totalScore;
  }

  // Select optimal edges for upload
  public selectOptimalEdges(
    edges: EdgeLocation[],
    metrics: Map<string, EdgeMetric>,
    userLocation: UserLocation,
    priority: 'speed' | 'cost' | 'balanced' = 'balanced',
    topN: number = 5
  ): EdgeScore[] {
    const scored: EdgeScore[] = edges.map(edge => {
      const metric = metrics.get(edge.id);
      const distance = haversineDistance(
        userLocation.lat, userLocation.lng,
        edge.lat, edge.lng
      );
      const score = this.calculateScore(edge, metric, userLocation, priority);

      return {
        edge,
        metric,
        distance,
        score,
        weight: 0, // Will be calculated after selection
        latency: metric?.latency_ms || Math.max(20, distance / 50),
        load: metric?.load_percent || 30,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Take top N edges
    const selected = scored.slice(0, topN);

    // Calculate weights (proportional to score)
    const totalScore = selected.reduce((sum, e) => sum + e.score, 0);
    selected.forEach(edge => {
      edge.weight = edge.score / totalScore;
    });

    return selected;
  }

  // Calculate upload strategy based on file size
  public calculateStrategy(
    fileSize: number,
    selectedEdges: EdgeScore[],
    priority: 'speed' | 'cost' | 'balanced' = 'balanced'
  ): UploadStrategy {
    // Chunk size logic
    let chunkSize = 50 * 1024 * 1024; // 50MB default
    if (fileSize < 100 * 1024 * 1024) {
      chunkSize = 10 * 1024 * 1024; // 10MB for small files
    } else if (fileSize > 10 * 1024 * 1024 * 1024) {
      chunkSize = 100 * 1024 * 1024; // 100MB for huge files
    }

    // Thread count based on priority and edges
    let threads = Math.min(selectedEdges.length * 4, 24); // Max 24 threads
    if (priority === 'cost') {
      threads = Math.min(selectedEdges.length * 2, 12); // Reduce threads for cost
    } else if (priority === 'speed') {
      threads = Math.min(selectedEdges.length * 6, 32); // Max 32 threads for speed
    }

    // Estimate time based on average bandwidth
    const avgBandwidth = selectedEdges.reduce((sum, e) => 
      sum + (e.metric?.bandwidth_mbps || 500), 0
    ) / selectedEdges.length;

    const effectiveBandwidth = avgBandwidth * threads * 0.8; // 80% efficiency
    const estimatedTime = Math.ceil(
      (fileSize / 1024 / 1024) / effectiveBandwidth
    ); // seconds

    // Estimate cost ($0.10 per GB egress)
    const estimatedCost = (fileSize / 1024 / 1024 / 1024) * 0.10;

    // Compression (disable for now, can enable for text files)
    const compression = 'none';

    return {
      chunkSize,
      threads,
      compression,
      estimatedTime,
      estimatedCost: parseFloat(estimatedCost.toFixed(4)),
    };
  }

  // Add direct Lyve Cloud option (no edge, direct upload)
  public addDirectLyveOption(
    selectedEdges: EdgeScore[],
    userLocation: UserLocation
  ): EdgeScore[] {
    // Add direct Lyve as a fallback option with 10% weight
    const lyveEdge: EdgeScore = {
      edge: {
        id: 'lyve-direct',
        url: 'https://s3.lyvecloud.seagate.com',
        city: 'Direct Upload',
        country: 'US',
        lat: 37.7749,
        lng: -122.4194,
        provider: 'lyve',
        is_active: true,
      },
      metric: undefined,
      distance: 0,
      score: 0.5, // Medium score
      weight: 0.10,
      latency: 45,
      load: 0,
    };

    // Adjust weights of other edges to accommodate direct option
    const edgesWithLyve = [...selectedEdges, lyveEdge];
    const totalWeight = selectedEdges.reduce((sum, e) => sum + e.weight, 0) + 0.10;
    
    edgesWithLyve.forEach(edge => {
      edge.weight = edge.weight / totalWeight;
    });

    return edgesWithLyve;
  }

  // Mock edge metrics for testing (until monitoring service is live)
  public generateMockMetrics(edges: EdgeLocation[]): Map<string, EdgeMetric> {
    const metrics = new Map<string, EdgeMetric>();
    const now = new Date();

    edges.forEach(edge => {
      const distance = haversineDistance(37.7749, -122.4194, edge.lat, edge.lng);
      
      metrics.set(edge.id, {
        edge_id: edge.id,
        timestamp: now,
        latency_ms: Math.max(10, Math.floor(distance / 50) + Math.random() * 20),
        load_percent: Math.floor(Math.random() * 50) + 20, // 20-70%
        bandwidth_mbps: Math.floor(Math.random() * 500) + 500, // 500-1000 Mbps
        active_uploads: Math.floor(Math.random() * 10),
        error_rate: Math.random() * 2, // 0-2%
      });
    });

    return metrics;
  }
}

export const edgeSelector = new EdgeSelector();
