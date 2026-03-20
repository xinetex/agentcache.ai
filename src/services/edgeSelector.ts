/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import { EdgeLocation, EdgeMetric } from './jettySpeedDb.js';

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

    // Default metric values if not available (penalty applied)
    const isStale = !metric || (Date.now() - new Date(metric.timestamp).getTime() > 5 * 60 * 1000);
    
    // Penalize stale or missing data
    const latency = metric?.latency_ms || (isStale ? 500 : Math.max(20, distance / 50));
    const load = metric?.load_percent || (isStale ? 90 : 30);
    const bandwidth = metric?.bandwidth_mbps || (isStale ? 10 : 1000);
    const errorRate = metric?.error_rate || (isStale ? 5 : 0);

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

    // Normalize scores (0-1, higher is better)
    const distanceScore = Math.max(0, 1 - (distance / 10000));
    const latencyScore = Math.max(0, 1 - (latency / 500)); // Cap at 500ms
    const loadScore = Math.max(0, 1 - (load / 100));
    const bandwidthScore = Math.min(1, bandwidth / 1000);
    const errorScore = Math.max(0, 1 - (errorRate / 10));

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
        weight: 0,
        latency: metric?.latency_ms || (metric ? 50 : 200),
        load: metric?.load_percent || (metric ? 30 : 80),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const selected = scored.slice(0, topN);

    // Calculate weights
    const totalScore = selected.reduce((sum, e) => sum + e.score, 0);
    selected.forEach(edge => {
      edge.weight = totalScore > 0 ? edge.score / totalScore : (1 / selected.length);
    });

    return selected;
  }

  // Calculate upload strategy
  public calculateStrategy(
    fileSize: number,
    selectedEdges: EdgeScore[],
    priority: 'speed' | 'cost' | 'balanced' = 'balanced'
  ): UploadStrategy {
    let chunkSize = 50 * 1024 * 1024;
    if (fileSize < 100 * 1024 * 1024) {
      chunkSize = 10 * 1024 * 1024;
    } else if (fileSize > 10 * 1024 * 1024 * 1024) {
      chunkSize = 100 * 1024 * 1024;
    }

    let threads = Math.min(selectedEdges.length * 4, 24);
    if (priority === 'cost') {
      threads = Math.min(selectedEdges.length * 2, 12);
    } else if (priority === 'speed') {
      threads = Math.min(selectedEdges.length * 6, 32);
    }

    const avgBandwidth = selectedEdges.length > 0
      ? selectedEdges.reduce((sum, e) => sum + (e.metric?.bandwidth_mbps || 500), 0) / selectedEdges.length
      : 500;

    const effectiveBandwidth = avgBandwidth * threads * 0.8;
    const estimatedTime = Math.ceil((fileSize / 1024 / 1024) / effectiveBandwidth);
    const estimatedCost = (fileSize / 1024 / 1024 / 1024) * 0.10;

    return {
      chunkSize,
      threads,
      compression: 'none',
      estimatedTime,
      estimatedCost: parseFloat(estimatedCost.toFixed(4)),
    };
  }

  // Add direct Lyve Cloud option
  public addDirectLyveOption(
    selectedEdges: EdgeScore[],
    userLocation: UserLocation
  ): EdgeScore[] {
    // Determine mesh health to scale Lyve fallback weight
    const activeEdgesCount = selectedEdges.filter(e => e.metric && (Date.now() - new Date(e.metric.timestamp).getTime() < 5 * 60 * 1000)).length;
    const avgLatency = selectedEdges.length > 0 
      ? selectedEdges.reduce((sum, e) => sum + e.latency, 0) / selectedEdges.length
      : 1000;
    
    // meshHealthScore: 1.0 = perfect, 0.0 = degraded
    const meshHealthScore = (activeEdgesCount / Math.max(1, selectedEdges.length)) * (Math.max(0, 1 - (avgLatency / 1000)));
    
    // base fallback is 0.10 (10%), grows to 0.70 (70%) as mesh fails
    const fallbackWeight = 0.10 + (0.60 * (1 - meshHealthScore));

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
      score: 0.5,
      weight: fallbackWeight,
      latency: 45,
      load: 0,
    };

    const edgesWithLyve = [...selectedEdges, lyveEdge];
    const remainingWeight = 1 - fallbackWeight;
    const currentMeshWeight = selectedEdges.reduce((sum, e) => sum + e.weight, 0);
    
    if (currentMeshWeight > 0) {
      selectedEdges.forEach(edge => {
        edge.weight = (edge.weight / currentMeshWeight) * remainingWeight;
      });
    }

    return edgesWithLyve;
  }
}

export const edgeSelector = new EdgeSelector();
