import { z } from 'zod';

/**
 * Lab Strategy Configuration Schema
 * Defines cache configurations for scientific testing
 */

// Cache eviction policies
export const CachePolicySchema = z.enum([
  'LRU',   // Least Recently Used
  'LFU',   // Least Frequently Used
  'FIFO',  // First In First Out
  'ARC',   // Adaptive Replacement Cache
  'TLRU',  // Time-aware LRU
]);

// Tier configuration (L1/L2/L3)
export const TierConfigSchema = z.object({
  enabled: z.boolean(),
  ttl: z.number().int().positive(), // Time to live in seconds
  maxSize: z.string().regex(/^\d+(KB|MB|GB)$/), // e.g., "50MB", "5GB"
  policy: CachePolicySchema,
  
  // Optional L3-specific (semantic cache)
  semantic: z.boolean().optional(),
  similarityThreshold: z.number().min(0).max(1).optional(), // Cosine similarity for L3
  
  // Advanced options
  compression: z.boolean().optional().default(false),
  encryption: z.boolean().optional().default(false),
  
  // Performance tuning
  prefetchEnabled: z.boolean().optional().default(false),
  writeThrough: z.boolean().optional().default(true), // vs write-back
});

// Routing rules for intelligent cache tier selection
export const RoutingRuleSchema = z.object({
  condition: z.string(), // Human-readable condition
  action: z.enum(['L1', 'L2', 'L3', 'bypass', 'multi_tier']),
  
  // Optional parameters for the action
  params: z.record(z.string(), z.unknown()).optional(),
});

// Compliance and validation rules
export const ValidationConfigSchema = z.object({
  hipaa: z.boolean().optional(),
  pciDss: z.boolean().optional(),
  soc2: z.boolean().optional(),
  
  // PII/PHI filtering
  piiFilter: z.boolean().optional(),
  phiFilter: z.boolean().optional(),
  
  // Data freshness requirements
  maxStalenessSeconds: z.number().int().positive().optional(),
  
  // Custom validators
  customRules: z.array(z.string()).optional(),
});

// Complete strategy configuration
export const StrategyConfigSchema = z.object({
  // Strategy metadata
  name: z.string().min(3).max(255),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  version: z.number().int().positive().default(1),
  
  // Context
  sector: z.enum([
    'healthcare',
    'finance',
    'hpc',
    'ecommerce',
    'education',
    'government',
    'iot',
    'media',
    'logistics',
    'research',
  ]),
  useCase: z.string().min(10).max(500),
  hypothesis: z.string().max(1000).optional(),
  
  // Tier configuration
  tiers: z.object({
    L1: TierConfigSchema,
    L2: TierConfigSchema,
    L3: TierConfigSchema,
  }),
  
  // Intelligent routing
  routing: z.array(RoutingRuleSchema).optional(),
  
  // Compliance and validation
  validation: ValidationConfigSchema.optional(),
  
  // Performance targets
  targets: z.object({
    minHitRate: z.number().min(0).max(100).optional(), // Percentage
    maxLatencyP95: z.number().int().positive().optional(), // Milliseconds
    maxCostPer1k: z.number().positive().optional(), // Dollars
  }).optional(),
  
  // Tags and metadata
  tags: z.array(z.string()).optional(),
  complianceFlags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CachePolicy = z.infer<typeof CachePolicySchema>;
export type TierConfig = z.infer<typeof TierConfigSchema>;
export type RoutingRule = z.infer<typeof RoutingRuleSchema>;
export type ValidationConfig = z.infer<typeof ValidationConfigSchema>;
export type StrategyConfig = z.infer<typeof StrategyConfigSchema>;

/**
 * Validate strategy configuration
 */
export function validateStrategy(config: unknown): { 
  valid: boolean; 
  data?: StrategyConfig; 
  errors?: z.ZodError;
} {
  try {
    const data = StrategyConfigSchema.parse(config);
    return { valid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, errors: error };
    }
    throw error;
  }
}

/**
 * Parse size string to bytes
 */
export function parseSizeToBytes(size: string): number {
  const match = size.match(/^(\d+)(KB|MB|GB)$/);
  if (!match) throw new Error(`Invalid size format: ${size}`);
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const multipliers = {
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
  };
  
  return value * multipliers[unit as keyof typeof multipliers];
}

/**
 * Calculate strategy complexity score (0-100)
 * Higher = more complex configuration
 */
export function calculateComplexity(config: StrategyConfig): number {
  let score = 0;
  
  // Base complexity from enabled tiers
  const enabledTiers = [config.tiers.L1, config.tiers.L2, config.tiers.L3]
    .filter(t => t.enabled).length;
  score += enabledTiers * 15;
  
  // Routing rules complexity
  if (config.routing) {
    score += Math.min(30, config.routing.length * 5);
  }
  
  // Compliance requirements
  if (config.validation) {
    const complianceCount = [
      config.validation.hipaa,
      config.validation.pciDss,
      config.validation.soc2,
    ].filter(Boolean).length;
    score += complianceCount * 10;
  }
  
  // Advanced features
  const advancedFeatures = [
    config.tiers.L1.compression,
    config.tiers.L1.encryption,
    config.tiers.L1.prefetchEnabled,
    config.tiers.L2.compression,
    config.tiers.L2.encryption,
    config.tiers.L3.semantic,
  ].filter(Boolean).length;
  score += advancedFeatures * 3;
  
  return Math.min(100, score);
}

/**
 * Generate strategy slug from name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
