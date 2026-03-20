/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 */
import 'dotenv/config';
import { EdgeSelector, UserLocation } from '../src/services/EdgeSelector.js';
import { EdgeLocation, EdgeMetric } from '../src/services/jettySpeedDb.js';

const edgeSelector = new EdgeSelector();

async function verifyEdgeIntelligence() {
  console.log('--- 🧠 Edge Intelligence Verification ---\n');

  const userLocation: UserLocation = {
    lat: 40.7128, // New York
    lng: -74.0060,
    city: 'New York'
  };

  const mockEdges: EdgeLocation[] = [
    {
      id: 'edge-local',
      url: 'https://ny-edge.agentcache.ai',
      city: 'New York',
      country: 'US',
      lat: 40.7306,
      lng: -73.9352,
      provider: 'digitalocean',
      is_active: true
    },
    {
      id: 'edge-remote',
      url: 'https://sf-edge.agentcache.ai',
      city: 'San Francisco',
      country: 'US',
      lat: 37.7749,
      lng: -122.4194,
      provider: 'digitalocean',
      is_active: true
    }
  ];

  // Scenario 1: Healthy Mesh
  console.log('Scenario 1: Healthy Mesh (Low Latency, Low Load)');
  const healthyMetrics = new Map<string, EdgeMetric>([
    [
      'edge-local',
      {
        edge_id: 'edge-local',
        timestamp: new Date(),
        latency_ms: 10,
        load_percent: 20,
        bandwidth_mbps: 1000,
        active_uploads: 2,
        error_rate: 0
      }
    ],
    [
      'edge-remote',
      {
        edge_id: 'edge-remote',
        timestamp: new Date(),
        latency_ms: 80,
        load_percent: 15,
        bandwidth_mbps: 1000,
        active_uploads: 1,
        error_rate: 0
      }
    ]
  ]);

  const healthyResults = edgeSelector.selectOptimalEdges(mockEdges, healthyMetrics, userLocation);
  const healthyWithLyve = edgeSelector.addDirectLyveOption(healthyResults, userLocation);
  
  printResults(healthyWithLyve);

  // Scenario 2: Degraded Mesh (High Latency, High Load)
  console.log('\nScenario 2: Degraded Mesh (High Latency, High Load)');
  const degradedMetrics = new Map<string, EdgeMetric>([
    [
      'edge-local',
      {
        edge_id: 'edge-local',
        timestamp: new Date(),
        latency_ms: 400,
        load_percent: 95,
        bandwidth_mbps: 50,
        active_uploads: 20,
        error_rate: 5
      }
    ],
    [
      'edge-remote',
      {
        edge_id: 'edge-remote',
        timestamp: new Date(),
        latency_ms: 600,
        load_percent: 90,
        bandwidth_mbps: 40,
        active_uploads: 15,
        error_rate: 8
      }
    ]
  ]);

  const degradedResults = edgeSelector.selectOptimalEdges(mockEdges, degradedMetrics, userLocation);
  const degradedWithLyve = edgeSelector.addDirectLyveOption(degradedResults, userLocation);
  
  printResults(degradedWithLyve);

  // Scenario 3: Stale/Missing Metrics (Penalty applied)
  console.log('\nScenario 3: Stale Metrics (Penalty applied)');
  const staleMetrics = new Map<string, EdgeMetric>([
    [
      'edge-local',
      {
        edge_id: 'edge-local',
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
        latency_ms: 10,
        load_percent: 20,
        bandwidth_mbps: 1000,
        active_uploads: 2,
        error_rate: 0
      }
    ]
  ]);

  const staleResults = edgeSelector.selectOptimalEdges(mockEdges, staleMetrics, userLocation);
  const staleWithLyve = edgeSelector.addDirectLyveOption(staleResults, userLocation);
  
  printResults(staleWithLyve);
}

function printResults(results: any[]) {
  results.forEach(r => {
    console.log(`- ${r.edge.id.padEnd(15)} | Score: ${r.score.toFixed(3)} | Weight: ${(r.weight * 100).toFixed(1)}% | Latency: ${r.latency}ms | Load: ${r.load}%`);
  });
}

verifyEdgeIntelligence().catch(console.error);
