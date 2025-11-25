/**
 * Pipeline Generation API
 * Uses PipelineWizard to generate cache pipelines from natural language prompts
 */

import { PipelineWizard } from '../../lib/wizard-framework.js';
import { calculateComplexity } from '../../lib/complexity-calculator.js';

const wizard = new PipelineWizard();

/**
 * POST /api/pipeline/generate
 * Generate a cache pipeline from user prompt
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, sector = 'general', performance = 'balanced' } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ 
      success: false,
      error: 'Prompt is required' 
    });
  }

  try {
    // Step 1: Analyze use case
    const analysis = await wizard.analyzeUseCase(prompt, { sector });
    
    // Step 2: Suggest nodes based on prompt and performance
    const nodeSuggestions = await wizard.suggestNodes(
      extractUseCase(prompt), 
      sector
    );
    
    // Apply performance optimization
    const nodes = applyPerformanceSettings(nodeSuggestions.nodes, performance);
    
    // Step 3: Build pipeline object
    const pipeline = {
      name: generatePipelineName(prompt, sector),
      description: prompt,
      sector,
      nodes,
      use_case: extractUseCase(prompt)
    };
    
    // Step 4: Calculate complexity
    const complexity = calculateComplexity(pipeline);
    pipeline.complexity_tier = complexity.tier;
    pipeline.complexity_score = complexity.score;
    pipeline.monthly_cost = complexity.cost;
    
    // Step 5: Generate reasoning
    const reasoning = generateReasoning(
      analysis, 
      nodeSuggestions, 
      complexity, 
      performance
    );
    
    // Step 6: Calculate metrics
    const metrics = calculateMetrics(nodes, performance);
    
    // Learn from this generation (async, don't block response)
    wizard.learnFromPipeline(pipeline, true).catch(err => {
      console.error('Failed to learn from pipeline:', err);
    });
    
    return res.status(200).json({
      success: true,
      pipeline: {
        ...pipeline,
        reasoning,
        metrics,
        confidence: Math.max(analysis.confidence, nodeSuggestions.confidence),
        learned: analysis.learned || nodeSuggestions.source === 'learned_pattern'
      }
    });
    
  } catch (error) {
    console.error('Pipeline generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate pipeline',
      details: error.message
    });
  }
}

/**
 * Apply performance-specific node configurations
 */
function applyPerformanceSettings(baseNodes, performance) {
  if (performance === 'fast') {
    // Low latency: Use only L1 cache
    return [
      { type: 'cache_l1', config: { ttl: 300, max_size: '500MB' } }
    ];
  }
  
  if (performance === 'cost') {
    // Cost optimized: Multi-tier with longer TTLs
    return [
      { type: 'cache_l1', config: { ttl: 300, max_size: '500MB' } },
      { type: 'cache_l2', config: { ttl: 3600, storage: 'redis' } },
      { type: 'cache_l3', config: { ttl: 86400, storage: 'postgresql' } },
      { type: 'semantic_dedup', config: { threshold: 0.92 } }
    ];
  }
  
  // Balanced: L1 + L2
  return [
    { type: 'cache_l1', config: { ttl: 300, max_size: '500MB' } },
    { type: 'cache_l2', config: { ttl: 3600, storage: 'redis' } },
    ...baseNodes.filter(n => 
      !['cache_l1', 'cache_l2', 'cache_l3'].includes(n.type)
    )
  ];
}

/**
 * Generate pipeline name from prompt
 */
function generatePipelineName(prompt, sector) {
  const keywords = prompt
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 3)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1));
    
  return keywords.length > 0 
    ? `${keywords.join(' ')} Pipeline`
    : `${sector.charAt(0).toUpperCase() + sector.slice(1)} Pipeline`;
}

/**
 * Extract use case from prompt
 */
function extractUseCase(prompt) {
  const lower = prompt.toLowerCase();
  
  // Healthcare patterns
  if (lower.includes('patient') || lower.includes('medical')) return 'patient_data';
  if (lower.includes('diagnosis') || lower.includes('clinical')) return 'clinical_decision';
  if (lower.includes('ehr') || lower.includes('record')) return 'ehr_integration';
  
  // Finance patterns
  if (lower.includes('risk') || lower.includes('fraud')) return 'risk_analysis';
  if (lower.includes('transaction') || lower.includes('payment')) return 'transaction_processing';
  if (lower.includes('compliance') || lower.includes('kyc')) return 'compliance';
  
  // Support patterns
  if (lower.includes('support') || lower.includes('ticket')) return 'customer_support';
  if (lower.includes('chatbot') || lower.includes('assistant')) return 'ai_assistant';
  
  // Content patterns
  if (lower.includes('content') || lower.includes('moderation')) return 'content_moderation';
  if (lower.includes('summarize') || lower.includes('summary')) return 'summarization';
  
  return 'general';
}

/**
 * Generate reasoning for UI display
 */
function generateReasoning(analysis, nodeSuggestions, complexity, performance) {
  const reasons = [];
  
  // Learning-based reasoning
  if (analysis.learned) {
    reasons.push(analysis.reason);
  } else {
    reasons.push('Analyzed your use case and inferred optimal configuration');
  }
  
  // Node selection reasoning
  if (nodeSuggestions.source === 'learned_pattern') {
    reasons.push(`Selected nodes based on ${nodeSuggestions.confidence * 100}% confidence from similar pipelines`);
  } else {
    reasons.push('Selected recommended nodes for your sector');
  }
  
  // Performance reasoning
  if (performance === 'fast') {
    reasons.push('Optimized for low latency with single L1 cache layer');
  } else if (performance === 'cost') {
    reasons.push('Optimized for maximum cost savings with multi-tier caching');
  } else {
    reasons.push('Balanced configuration for good speed and cost savings');
  }
  
  // Complexity reasoning
  reasons.push(`Pipeline complexity: ${complexity.tier} (${complexity.score} points)`);
  
  if (complexity.suggestions && complexity.suggestions.length > 0) {
    reasons.push(`Found ${complexity.suggestions.length} potential optimizations`);
  }
  
  return reasons;
}

/**
 * Calculate performance metrics
 */
function calculateMetrics(nodes, performance) {
  let latency_ms = 50; // Base
  let hit_rate = 0.70; // Base
  let savings_per_request = 1.20; // Base
  
  // Adjust based on nodes
  if (nodes.some(n => n.type === 'cache_l1')) {
    latency_ms += 5;
    hit_rate += 0.10;
  }
  
  if (nodes.some(n => n.type === 'cache_l2')) {
    latency_ms += 15;
    hit_rate += 0.08;
  }
  
  if (nodes.some(n => n.type === 'cache_l3')) {
    latency_ms += 30;
    hit_rate += 0.05;
  }
  
  if (nodes.some(n => n.type === 'semantic_dedup')) {
    hit_rate += 0.12;
    latency_ms += 8;
  }
  
  // Performance adjustments
  if (performance === 'fast') {
    latency_ms *= 0.7;
    hit_rate *= 0.9;
    savings_per_request *= 0.8;
  } else if (performance === 'cost') {
    latency_ms *= 1.3;
    hit_rate *= 1.1;
    savings_per_request *= 1.4;
  }
  
  // Cap hit rate at 98%
  hit_rate = Math.min(hit_rate, 0.98);
  
  return {
    estimated_latency_ms: Math.round(latency_ms),
    estimated_hit_rate: Math.round(hit_rate * 100) / 100,
    estimated_savings_per_request: Math.round(savings_per_request * 100) / 100
  };
}
