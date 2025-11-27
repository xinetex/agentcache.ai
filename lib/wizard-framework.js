/**
 * Wizard Framework
 * Extensible system for multiple AI assistants that learn from usage
 * Each wizard uses platform memory to get smarter over time
 */

import { platformMemory, NAMESPACES } from './platform-memory.js';
import { calculateComplexity } from './complexity-calculator.js';

/**
 * Base Wizard Class
 * All wizards inherit from this to get cognitive capabilities
 */
class BaseWizard {
  constructor(wizardId, namespace) {
    this.wizardId = wizardId;
    this.namespace = namespace;
    this.conversationHistory = [];
  }

  /**
   * Check if wizard has seen this pattern before
   */
  async recall(patternKey, options = {}) {
    const result = await platformMemory.get(this.namespace, patternKey, options);
    
    if (result.hit) {
      return {
        found: true,
        data: result.data,
        confidence: result.confidence,
        usage_count: result.hit_count,
        tier: result.tier
      };
    }
    
    return { found: false };
  }

  /**
   * Learn from successful interaction
   */
  async learn(patternKey, data, confidence = 0.85) {
    await platformMemory.set(this.namespace, patternKey, data, {
      confidence,
      reasoning: `${this.wizardId} learned successful pattern`,
      metadata: {
        wizard: this.wizardId,
        timestamp: new Date().toISOString()
      }
    });
    
    return { learned: true };
  }

  /**
   * Analyze patterns to improve suggestions
   */
  async analyzePatterns(minConfidence = 0.7) {
    return await platformMemory.analyzePatterns(this.namespace, {
      min_confidence: minConfidence
    });
  }

  /**
   * Add message to conversation history
   */
  addMessage(role, content) {
    this.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Pipeline Wizard
 * Helps users build cache pipelines
 */
export class PipelineWizard extends BaseWizard {
  constructor() {
    super('pipeline_wizard', NAMESPACES.WIZARD);
  }

  /**
   * Step 1: Understand use case
   */
  async analyzeUseCase(userPrompt, context = {}) {
    const { sector, existingPipelines = [] } = context;
    
    // Check if we've seen similar use case
    const patternKey = `usecase:${sector}:${this.extractKeywords(userPrompt).join('_')}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      return {
        suggestions: memory.data.nodes,
        confidence: memory.confidence,
        reason: `Based on ${memory.usage_count} similar ${sector} pipelines`,
        learned: true
      };
    }
    
    // New pattern - analyze from scratch
    return {
      suggestions: this.inferNodes(userPrompt, sector),
      confidence: 0.6,
      reason: 'Inferred from use case description',
      learned: false
    };
  }

  /**
   * Step 2: Suggest nodes
   */
  async suggestNodes(useCase, sector) {
    const patternKey = `nodes:${sector}:${useCase}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      return {
        nodes: memory.data.nodes,
        confidence: memory.confidence,
        source: 'learned_pattern'
      };
    }
    
    // Generate suggestions
    return {
      nodes: this.getDefaultNodes(sector),
      confidence: 0.5,
      source: 'defaults'
    };
  }

  /**
   * Step 3: Optimize configuration
   */
  async optimizeConfiguration(pipeline) {
    const complexity = calculateComplexity(pipeline);
    
    // Check for known optimizations
    const patternKey = `optimize:${complexity.tier}:${pipeline.sector}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found && memory.data.optimizations) {
      return {
        current: complexity,
        suggestions: memory.data.optimizations,
        proven_savings: memory.data.avg_savings
      };
    }
    
    return {
      current: complexity,
      suggestions: [],
      proven_savings: 0
    };
  }

  /**
   * Learn from completed pipeline
   */
  async learnFromPipeline(pipeline, success = true) {
    if (!success) return;
    
    // Store use case → nodes pattern
    const useCaseKey = `nodes:${pipeline.sector}:${pipeline.use_case || 'general'}`;
    await this.learn(useCaseKey, {
      nodes: pipeline.nodes.map(n => ({ type: n.type, config: n.config })),
      sector: pipeline.sector,
      complexity: pipeline.complexity_tier
    });
    
    // Store complexity pattern
    const nodeTypes = pipeline.nodes.map(n => n.type).sort().join(',');
    const complexityKey = `complexity:${nodeTypes}:${pipeline.sector}`;
    await this.learn(complexityKey, {
      tier: pipeline.complexity_tier,
      score: pipeline.complexity_score,
      cost: pipeline.monthly_cost
    }, 0.95);
    
    return { learned: true };
  }

  // Helper methods
  extractKeywords(text) {
    const keywords = text.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 4);
    return keywords.slice(0, 3);
  }

  inferNodes(prompt, sector) {
    const lower = prompt.toLowerCase();
    const nodes = ['cache_l1'];
    
    if (lower.includes('patient') || lower.includes('medical')) {
      nodes.push('phi_filter', 'hipaa_audit');
    }
    if (lower.includes('trading') || lower.includes('financial')) {
      nodes.push('pci_filter', 'finra_audit');
    }
    if (lower.includes('legal') || lower.includes('document')) {
      nodes.push('privilege_guard');
    }
    
    nodes.push('llm_advanced');
    return nodes;
  }

  getDefaultNodes(sector) {
    const defaults = {
      healthcare: ['ehr_connector', 'phi_filter', 'cache_l2', 'llm_advanced', 'hipaa_audit'],
      finance: ['market_data', 'pci_filter', 'cache_l2', 'llm_advanced', 'finra_audit'],
      legal: ['legal_research', 'privilege_guard', 'cache_l2', 'llm_advanced', 'matter_tracker'],
      general: ['http_api', 'cache_l1', 'llm_basic', 'output']
    };
    return defaults[sector] || defaults.general;
  }
}

/**
 * Agent Orchestrator Wizard
 * Helps users set up multi-agent systems with coordinated caching
 */
export class AgentOrchestratorWizard extends BaseWizard {
  constructor() {
    super('agent_orchestrator', 'platform/orchestrator');
  }

  /**
   * Analyze multi-agent architecture
   */
  async analyzeArchitecture(description, context = {}) {
    const { agentCount, useCase, sector } = context;
    
    const patternKey = `architecture:${sector}:${agentCount}_agents:${useCase}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      return {
        architecture: memory.data.architecture,
        caching_strategy: memory.data.caching_strategy,
        confidence: memory.confidence,
        reason: `Based on ${memory.usage_count} similar multi-agent setups`
      };
    }
    
    // Design new architecture
    return this.designArchitecture(agentCount, useCase, sector);
  }

  /**
   * Design multi-agent architecture
   */
  designArchitecture(agentCount, useCase, sector) {
    const architecture = {
      agents: [],
      shared_memory: {
        l1: 'per-agent', // Each agent has own L1
        l2: 'shared',    // All agents share L2
        l3: 'global'     // Global long-term memory
      },
      coordination: {
        pattern: agentCount > 5 ? 'hierarchical' : 'peer-to-peer',
        communication: 'message-queue'
      }
    };
    
    // Generate agent roles
    for (let i = 0; i < agentCount; i++) {
      architecture.agents.push({
        id: `agent_${i + 1}`,
        role: this.inferAgentRole(i, agentCount, useCase),
        cache_namespace: `${sector}/agent_${i + 1}`,
        pipeline_config: {
          cache_l1: true,
          shared_l2: true,
          reasoning_cache: agentCount > 3 // Enable for complex systems
        }
      });
    }
    
    return {
      architecture,
      caching_strategy: this.designCachingStrategy(architecture),
      confidence: 0.7,
      reason: 'Generated from requirements'
    };
  }

  /**
   * Design caching strategy for multi-agent system
   */
  designCachingStrategy(architecture) {
    return {
      per_agent: {
        ttl: 300, // 5 min
        strategy: 'exact',
        description: 'Fast lookups for agent-specific context'
      },
      shared_l2: {
        ttl: 3600, // 1 hour
        strategy: 'semantic',
        description: 'Cross-agent knowledge sharing'
      },
      global_l3: {
        ttl: 86400 * 7, // 7 days
        strategy: 'vector',
        description: 'Long-term organizational memory'
      },
      coordination: {
        agent_discovery: 'cache_enabled',
        result_sharing: 'automatic',
        conflict_resolution: 'latest_wins'
      }
    };
  }

  /**
   * Optimize multi-agent caching
   */
  async optimizeMultiAgent(currentSetup) {
    const patternKey = `optimize:${currentSetup.agent_count}_agents`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      return {
        optimizations: memory.data.optimizations,
        expected_savings: memory.data.avg_savings,
        confidence: memory.confidence
      };
    }
    
    // Generate optimization suggestions
    return {
      optimizations: [
        {
          type: 'enable_reasoning_cache',
          impact: 'high',
          savings: '90% on repeated reasoning tasks'
        },
        {
          type: 'shared_l2_cache',
          impact: 'medium',
          savings: '60% on common queries across agents'
        }
      ],
      expected_savings: 0,
      confidence: 0.5
    };
  }

  /**
   * Learn from deployed multi-agent system
   */
  async learnFromDeployment(setup, metrics) {
    if (!metrics.success) return;
    
    const patternKey = `architecture:${setup.sector}:${setup.agent_count}_agents:${setup.use_case}`;
    
    await this.learn(patternKey, {
      architecture: setup.architecture,
      caching_strategy: setup.caching_strategy,
      metrics: {
        hit_rate: metrics.hit_rate,
        cost_savings: metrics.cost_savings,
        latency: metrics.avg_latency
      }
    }, 0.9);
    
    return { learned: true };
  }

  // Helper methods
  inferAgentRole(index, total, useCase) {
    const roles = [
      'coordinator',
      'researcher',
      'analyzer',
      'validator',
      'executor'
    ];
    
    if (total === 1) return 'general';
    if (index === 0) return 'coordinator';
    return roles[(index % (roles.length - 1)) + 1];
  }
}

/**
 * Compliance Wizard
 * Helps users ensure regulatory compliance
 */
export class ComplianceWizard extends BaseWizard {
  constructor() {
    super('compliance_wizard', NAMESPACES.COMPLIANCE);
  }

  /**
   * Audit pipeline for compliance
   */
  async auditPipeline(pipeline) {
    const { sector, nodes } = pipeline;
    
    // Check learned compliance requirements
    const patternKey = `requirements:${sector}`;
    const memory = await this.recall(patternKey);
    
    const issues = [];
    
    if (memory.found) {
      const required = memory.data.required_nodes || [];
      const missing = required.filter(
        reqNode => !nodes.some(n => n.type === reqNode)
      );
      
      missing.forEach(nodeType => {
        issues.push({
          severity: 'high',
          type: 'missing_required_node',
          node: nodeType,
          message: `${nodeType} is required in ${memory.usage_count} similar pipelines`,
          confidence: memory.confidence
        });
      });
    }
    
    // Check sector-specific rules
    if (sector === 'healthcare' && !nodes.some(n => n.type.includes('hipaa'))) {
      issues.push({
        severity: 'critical',
        type: 'missing_compliance',
        message: 'Healthcare pipelines typically require HIPAA audit logging'
      });
    }
    
    return {
      compliant: issues.length === 0,
      issues,
      recommendations: this.generateRecommendations(sector, issues)
    };
  }

  /**
   * Generate compliance recommendations
   */
  generateRecommendations(sector, issues) {
    return issues.map(issue => ({
      issue: issue.type,
      action: `Add ${issue.node} node to pipeline`,
      benefit: 'Required for regulatory compliance',
      priority: issue.severity
    }));
  }

  /**
   * Learn compliance patterns
   */
  async learnFromAudit(pipeline, passed) {
    if (!passed) return;
    
    const patternKey = `requirements:${pipeline.sector}`;
    const existing = await this.recall(patternKey);
    
    const stats = existing.found ? existing.data : {
      required_nodes: {},
      total_audits: 0
    };
    
    // Count node usage
    pipeline.nodes.forEach(node => {
      if (node.type.includes('audit') || node.type.includes('filter')) {
        stats.required_nodes[node.type] = (stats.required_nodes[node.type] || 0) + 1;
      }
    });
    
    stats.total_audits += 1;
    
    // Nodes used in >80% are "required"
    const threshold = stats.total_audits * 0.8;
    const required = Object.entries(stats.required_nodes)
      .filter(([_, count]) => count >= threshold)
      .map(([node]) => node);
    
    await this.learn(patternKey, {
      ...stats,
      required_nodes: required
    }, Math.min(0.95, stats.total_audits / 100));
    
    return { learned: true };
  }
}

/**
 * Cost Optimization Wizard
 * Helps users reduce costs
 */
export class CostOptimizerWizard extends BaseWizard {
  constructor() {
    super('cost_optimizer', NAMESPACES.OPTIMIZATION);
  }

  /**
   * Analyze pipeline for cost savings
   */
  async analyzeCosts(pipeline, currentMetrics) {
    const opportunities = [];
    
    // Check for proven optimizations
    const patternKey = `optimize:${pipeline.complexity_tier}:${pipeline.sector}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found && memory.data.optimizations) {
      memory.data.optimizations.forEach(opt => {
        opportunities.push({
          ...opt,
          proven: true,
          success_rate: opt.success_rate || 0.8,
          based_on: memory.usage_count
        });
      });
    }
    
    // Add general optimizations
    if (pipeline.complexity_tier === 'complex') {
      opportunities.push({
        type: 'simplify',
        action: 'Remove non-essential audit nodes',
        potential_savings: 50,
        confidence: 0.7
      });
    }
    
    return {
      current_cost: pipeline.monthly_cost,
      opportunities,
      total_potential_savings: opportunities.reduce((sum, o) => sum + (o.potential_savings || 0), 0)
    };
  }

  /**
   * Learn from successful optimization
   */
  async learnFromOptimization(before, after, actualSavings) {
    const patternKey = `optimize:${before.complexity_tier}:${before.sector}`;
    const existing = await this.recall(patternKey);
    
    const optimizations = existing.found ? existing.data.optimizations || [] : [];
    
    optimizations.push({
      change: this.describeChange(before, after),
      savings: actualSavings,
      success_rate: 1
    });
    
    await this.learn(patternKey, {
      optimizations,
      avg_savings: optimizations.reduce((sum, o) => sum + o.savings, 0) / optimizations.length
    }, 0.9);
    
    return { learned: true };
  }

  describeChange(before, after) {
    const beforeNodes = before.nodes.map(n => n.type);
    const afterNodes = after.nodes.map(n => n.type);
    const removed = beforeNodes.filter(n => !afterNodes.includes(n));
    
    if (removed.length > 0) {
      return `removed_${removed.join('_')}`;
    }
    return 'configuration_change';
  }
}

/**
 * Customer Onboarding Wizard
 * Helps customers set up their organization, namespaces, and initial configuration
 */
export class CustomerOnboardingWizard extends BaseWizard {
  constructor() {
    super('customer_onboarding', 'platform/onboarding');
  }

  /**
   * Step 1: Analyze organization profile
   */
  async analyzeOrganization(orgProfile) {
    const { name, sector, plan_tier, contact } = orgProfile;
    
    // Check if we've onboarded similar organizations
    const patternKey = `org:${sector}:${plan_tier}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      return {
        suggested_config: memory.data.config,
        typical_namespaces: memory.data.namespaces,
        confidence: memory.confidence,
        reason: `Based on ${memory.usage_count} similar ${sector} organizations`,
        learned: true
      };
    }
    
    // New pattern - infer from sector
    return {
      suggested_config: this.inferConfigFromSector(sector, plan_tier),
      typical_namespaces: this.inferNamespacesFromSector(sector),
      confidence: 0.6,
      reason: 'Inferred from sector best practices',
      learned: false
    };
  }

  /**
   * Step 2: Suggest namespace strategy
   */
  async suggestNamespaces(sector, scale, useCase) {
    const patternKey = `namespaces:${sector}:${scale}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      return {
        namespaces: memory.data.namespaces,
        strategy: memory.data.strategy,
        confidence: memory.confidence,
        source: 'learned_pattern'
      };
    }
    
    // Generate namespace suggestions
    const namespaces = this.generateNamespaceStrategy(sector, scale, useCase);
    return {
      namespaces,
      strategy: scale === 'multi_customer' ? 'tenant_isolation' : 'single_tenant',
      confidence: 0.7,
      source: 'generated'
    };
  }

  /**
   * Step 3: Provision customer resources
   */
  async provisionCustomer(orgData, namespaceConfig) {
    const { organization, namespaces, api_keys_count } = orgData;
    
    // This returns the data structure for the backend API
    return {
      organization: {
        name: organization.name,
        slug: this.generateSlug(organization.name),
        sector: organization.sector,
        plan_tier: organization.plan_tier,
        max_namespaces: this.getMaxNamespaces(organization.plan_tier),
        max_api_keys: this.getMaxApiKeys(organization.plan_tier)
      },
      namespaces: namespaces.map(ns => ({
        name: ns.name,
        display_name: ns.display_name,
        description: ns.description,
        sector_nodes: this.getSectorNodes(organization.sector, ns.name)
      })),
      api_keys: Array(api_keys_count || 1).fill(null).map((_, i) => ({
        name: i === 0 ? 'Production Key' : `API Key ${i + 1}`,
        allowed_namespaces: namespaces.map(ns => ns.name)
      }))
    };
  }

  /**
   * Learn from successful customer onboarding
   */
  async learnFromOnboarding(organization, metrics) {
    if (!metrics.success) return;
    
    // Store org pattern
    const patternKey = `org:${organization.sector}:${organization.plan_tier}`;
    await this.learn(patternKey, {
      config: {
        max_namespaces: organization.max_namespaces,
        max_api_keys: organization.max_api_keys
      },
      namespaces: metrics.namespaces_created,
      success_metrics: {
        time_to_first_hit: metrics.time_to_first_hit,
        day_7_hit_rate: metrics.day_7_hit_rate
      }
    }, 0.9);
    
    // Store namespace pattern
    if (metrics.namespaces_created && metrics.namespaces_created.length > 0) {
      const namespaceKey = `namespaces:${organization.sector}:${metrics.scale || 'single_tenant'}`;
      await this.learn(namespaceKey, {
        namespaces: metrics.namespaces_created,
        strategy: metrics.namespace_strategy,
        customer_count: metrics.customer_count || 1
      });
    }
    
    return { learned: true };
  }

  // Helper methods
  inferConfigFromSector(sector, plan_tier) {
    const configs = {
      healthcare: {
        compliance_required: ['HIPAA'],
        default_nodes: ['phi_filter', 'hipaa_audit'],
        cache_strategy: 'strict_ttl'
      },
      finance: {
        compliance_required: ['PCI-DSS', 'FINRA'],
        default_nodes: ['pci_filter', 'finra_audit'],
        cache_strategy: 'low_latency'
      },
      filestorage: {
        compliance_required: ['SOC2'],
        default_nodes: ['file_dedup', 'audit_log'],
        cache_strategy: 'high_throughput'
      },
      legal: {
        compliance_required: ['Privilege Protection'],
        default_nodes: ['privilege_guard', 'matter_tracker'],
        cache_strategy: 'secure'
      },
      general: {
        compliance_required: [],
        default_nodes: ['cache_l1', 'cache_l2'],
        cache_strategy: 'balanced'
      }
    };
    return configs[sector] || configs.general;
  }

  inferNamespacesFromSector(sector) {
    const namespaces = {
      healthcare: ['patients', 'clinical', 'admin'],
      finance: ['trading', 'research', 'compliance'],
      filestorage: ['storage', 'cdn', 'metadata'],
      legal: ['matters', 'research', 'billing'],
      general: ['production', 'staging']
    };
    return namespaces[sector] || namespaces.general;
  }

  generateNamespaceStrategy(sector, scale, useCase) {
    const baseNamespaces = this.inferNamespacesFromSector(sector);
    
    if (scale === 'multi_customer') {
      // Multi-tenant: add customer segmentation
      return [
        { name: 'shared', display_name: 'Shared Resources', type: 'global' },
        ...baseNamespaces.map(ns => ({
          name: `${ns}_template`,
          display_name: `${ns.charAt(0).toUpperCase() + ns.slice(1)} Template`,
          type: 'tenant_template'
        }))
      ];
    }
    
    // Single tenant: standard namespaces
    return baseNamespaces.map(ns => ({
      name: ns,
      display_name: ns.charAt(0).toUpperCase() + ns.slice(1),
      type: 'standard'
    }));
  }

  generateSlug(name) {
    return name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  getMaxNamespaces(plan_tier) {
    const limits = {
      free: 2,
      starter: 5,
      professional: 20,
      enterprise: 100
    };
    return limits[plan_tier] || limits.free;
  }

  getMaxApiKeys(plan_tier) {
    const limits = {
      free: 1,
      starter: 3,
      professional: 10,
      enterprise: 50
    };
    return limits[plan_tier] || limits.free;
  }

  getSectorNodes(sector, namespaceName) {
    // Returns sector-specific node recommendations for a namespace
    const sectorNodes = {
      filestorage: ['seagate_lyve_connector', 'file_dedup_cache', 'cdn_accelerator', 'audit_log_cache'],
      healthcare: ['ehr_connector', 'phi_filter', 'hipaa_audit', 'cache_l2'],
      finance: ['market_data', 'pci_filter', 'finra_audit', 'low_latency_cache'],
      legal: ['legal_research', 'privilege_guard', 'matter_tracker', 'cache_l2']
    };
    return sectorNodes[sector] || ['cache_l1', 'cache_l2', 'llm_basic'];
  }
}

/**
 * Project Scanner Wizard
 * Scans customer's codebase/infrastructure and generates personalized setup
 */
export class ProjectScannerWizard extends BaseWizard {
  constructor() {
    super('project_scanner', 'platform/scanner');
  }

  /**
   * Step 1: Scan project (GitHub or manual)
   */
  async scanProject(input) {
    const { type, data } = input; // type: 'github' | 'manual', data: repo_url or tech_stack
    
    if (type === 'github') {
      return await this.scanGitHubRepo(data);
    } else {
      return await this.analyzeTechStack(data);
    }
  }

  /**
   * Scan GitHub repository
   */
  async scanGitHubRepo(repoUrl) {
    // Check if we've scanned similar repos
    const patternKey = `github:scan:${this.extractRepoSignature(repoUrl)}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      return {
        ...memory.data,
        cached: true,
        confidence: memory.confidence
      };
    }

    // Analyze repo structure, detect:
    const analysis = {
      languages: [],
      storage_apis: [],
      llm_usage: [],
      databases: [],
      api_endpoints: [],
      current_caching: []
    };

    // Store for future similar repos
    await this.learn(patternKey, analysis, 0.8);
    
    return {
      ...analysis,
      cached: false,
      repo: repoUrl
    };
  }

  /**
   * Analyze manually provided tech stack
   */
  async analyzeTechStack(techStack) {
    const { languages = [], storage = [], llm_provider, frameworks = [] } = techStack;
    
    return {
      languages,
      storage_apis: storage,
      llm_usage: llm_provider ? [{ provider: llm_provider, endpoints: ['completion'] }] : [],
      databases: [],
      api_endpoints: [],
      current_caching: [],
      manual: true
    };
  }

  /**
   * Step 2: Generate personalized recommendations
   */
  async generateRecommendations(scanResults, orgProfile = {}) {
    const { storage_apis, llm_usage, sector } = scanResults;
    
    // Determine sector from scan if not provided
    const detectedSector = sector || this.detectSector(scanResults);
    
    // Check for similar scan patterns
    const patternKey = `recommendations:${detectedSector}:${storage_apis.join(',')}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      return {
        ...memory.data,
        learned: true,
        confidence: memory.confidence
      };
    }

    // Generate fresh recommendations
    const recommendations = {
      sector: detectedSector,
      namespaces: this.suggestNamespacesFromScan(scanResults),
      cache_tiers: this.suggestCacheTiers(llm_usage),
      integration_points: this.findIntegrationPoints(scanResults),
      estimated_savings: this.calculatePotentialSavings(llm_usage),
      mesh_network: this.generateMeshNetwork(scanResults)
    };

    return recommendations;
  }

  /**
   * Step 3: Generate integration code
   */
  async generateIntegrationCode(scanResults, recommendations) {
    const { languages, storage_apis, llm_usage } = scanResults;
    const primaryLanguage = languages[0] || 'javascript';
    
    // Check for cached integration patterns
    const patternKey = `integration:${primaryLanguage}:${storage_apis.join(',')}`;
    const memory = await this.recall(patternKey);
    
    if (memory.found) {
      return {
        ...memory.data,
        learned: true
      };
    }

    // Generate code for their specific stack
    const code = this.generateCodeForStack(primaryLanguage, storage_apis, llm_usage, recommendations);
    
    return {
      language: primaryLanguage,
      code,
      instructions: this.generateSetupInstructions(primaryLanguage),
      learned: false
    };
  }

  /**
   * Step 4: Create visual mesh network diagram data
   */
  generateMeshNetworkVisualization(scanResults, recommendations) {
    const { storage_apis, databases } = scanResults;
    const { namespaces, cache_tiers } = recommendations;
    
    return {
      nodes: [
        // Customer's infrastructure
        ...storage_apis.map((api, i) => ({
          id: `storage_${i}`,
          type: 'storage',
          label: api.name || api,
          layer: 'infrastructure',
          icon: '💾'
        })),
        // AgentCache layers
        ...cache_tiers.map((tier, i) => ({
          id: `cache_${tier.name}`,
          type: 'cache',
          label: tier.name,
          layer: 'agentcache',
          latency: tier.latency,
          icon: tier.icon
        })),
        // Application layer
        {
          id: 'app',
          type: 'application',
          label: 'Your AI App',
          layer: 'application',
          icon: '🚀'
        }
      ],
      edges: this.generateFlowEdges(storage_apis, cache_tiers)
    };
  }

  // Helper methods
  extractRepoSignature(repoUrl) {
    // Simple signature for similar repos
    return repoUrl.split('/').slice(-2).join('_').replace('.git', '');
  }

  detectSector(scanResults) {
    const { storage_apis = [], api_endpoints = [] } = scanResults;
    
    // File storage indicators
    if (storage_apis.some(api => ['s3', 'lyve', 'backblaze', 'blob'].some(t => api.toLowerCase().includes(t)))) {
      return 'filestorage';
    }
    
    // Healthcare indicators
    if (api_endpoints.some(ep => ['patient', 'ehr', 'fhir', 'hipaa'].some(t => ep.toLowerCase().includes(t)))) {
      return 'healthcare';
    }
    
    // Finance indicators
    if (api_endpoints.some(ep => ['trade', 'market', 'portfolio'].some(t => ep.toLowerCase().includes(t)))) {
      return 'finance';
    }
    
    return 'general';
  }

  suggestNamespacesFromScan(scanResults) {
    const sector = this.detectSector(scanResults);
    const { storage_apis = [] } = scanResults;
    
    if (sector === 'filestorage') {
      const namespaces = ['storage', 'metadata'];
      if (storage_apis.some(api => api.toLowerCase().includes('cdn'))) {
        namespaces.push('cdn');
      }
      return namespaces.map(ns => ({
        name: ns,
        display_name: ns.charAt(0).toUpperCase() + ns.slice(1),
        description: `${ns.charAt(0).toUpperCase() + ns.slice(1)} operations cache`
      }));
    }
    
    // Default namespaces
    return [
      { name: 'production', display_name: 'Production', description: 'Production environment cache' },
      { name: 'staging', display_name: 'Staging', description: 'Staging environment cache' }
    ];
  }

  suggestCacheTiers(llm_usage) {
    return [
      { name: 'L1 Cache', latency: '50ms', icon: '⚡', hit_rate: '92%' },
      { name: 'L2 Vector', latency: '200ms', icon: '🔷', hit_rate: '6%' },
      { name: 'Latent Manipulator', latency: '500ms', icon: '🧠', hit_rate: '2%' },
      { name: 'LLM Fallback', latency: '3-8s', icon: '🤖', hit_rate: '0%' }
    ];
  }

  findIntegrationPoints(scanResults) {
    const { llm_usage = [], api_endpoints = [] } = scanResults;
    
    return llm_usage.map(llm => ({
      type: 'llm_call',
      provider: llm.provider,
      endpoints: llm.endpoints || [],
      cacheable: true,
      estimated_calls_per_day: 10000 // Default estimate
    }));
  }

  calculatePotentialSavings(llm_usage) {
    const calls_per_day = 1000000; // Default estimate
    const cost_per_call = 0.002;
    const hit_rate = 0.92;
    
    const current_monthly = calls_per_day * 30 * cost_per_call;
    const with_cache = current_monthly * (1 - hit_rate);
    const savings = current_monthly - with_cache;
    
    return {
      current_monthly_cost: Math.round(current_monthly),
      with_agentcache: Math.round(with_cache),
      monthly_savings: Math.round(savings),
      annual_savings: Math.round(savings * 12),
      savings_percent: Math.round((savings / current_monthly) * 100)
    };
  }

  generateMeshNetwork(scanResults) {
    const { storage_apis = [] } = scanResults;
    
    return {
      infrastructure_nodes: storage_apis.map(api => ({
        name: api.name || api,
        type: 'storage',
        location: api.region || 'global'
      })),
      cache_nodes: [
        { tier: 'L1', location: 'edge', latency: '50ms' },
        { tier: 'L2', location: 'regional', latency: '200ms' },
        { tier: 'L3', location: 'central', latency: '500ms' }
      ],
      flow: 'request → cache_check → (hit: 50ms | miss: llm_fallback)'
    };
  }

  generateCodeForStack(language, storage_apis, llm_usage, recommendations) {
    if (language === 'javascript' || language === 'typescript') {
      return this.generateJavaScriptCode(storage_apis, recommendations);
    } else if (language === 'python') {
      return this.generatePythonCode(storage_apis, recommendations);
    }
    return this.generateJavaScriptCode(storage_apis, recommendations); // default
  }

  generateJavaScriptCode(storage_apis, recommendations) {
    const { namespaces } = recommendations;
    const namespaceList = namespaces.map(ns => ns.name).join("', '");
    
    return `import { AgentCache } from '@agentcache/sdk';

// Initialize AgentCache with your API key
const cache = new AgentCache({
  apiKey: process.env.AGENTCACHE_API_KEY,
  namespaces: ['${namespaceList}'],
});

// Wrap your LLM calls
async function queryWithCache(query, namespace = '${namespaces[0]?.name}') {
  // Check cache first
  const cached = await cache.get(query, { namespace });
  if (cached) {
    return cached;
  }
  
  // Cache miss - call LLM
  const response = await yourLLMProvider.completion(query);
  
  // Store in cache
  await cache.set(query, response, { 
    namespace,
    ttl: 3600 // 1 hour
  });
  
  return response;
}

export { queryWithCache };`;
  }

  generatePythonCode(storage_apis, recommendations) {
    const { namespaces } = recommendations;
    const namespaceList = namespaces.map(ns => ns.name).join("', '");
    
    return `from agentcache import AgentCache
import os

# Initialize AgentCache
cache = AgentCache(
    api_key=os.getenv('AGENTCACHE_API_KEY'),
    namespaces=['${namespaceList}']
)

def query_with_cache(query: str, namespace: str = '${namespaces[0]?.name}'):
    """Query with AgentCache layer"""
    # Check cache first
    cached = cache.get(query, namespace=namespace)
    if cached:
        return cached
    
    # Cache miss - call LLM
    response = your_llm_provider.completion(query)
    
    # Store in cache
    cache.set(query, response, namespace=namespace, ttl=3600)
    
    return response`;
  }

  generateSetupInstructions(language) {
    if (language === 'python') {
      return [
        'pip install agentcache',
        'export AGENTCACHE_API_KEY="your-api-key"',
        'Import and use queryWithCache() instead of direct LLM calls'
      ];
    }
    return [
      'npm install @agentcache/sdk',
      'export AGENTCACHE_API_KEY="your-api-key"',
      'Import and use queryWithCache() instead of direct LLM calls'
    ];
  }

  generateFlowEdges(storage_apis, cache_tiers) {
    // Generate edge connections for mesh network visualization
    const edges = [];
    
    // Storage → Cache L1
    storage_apis.forEach((api, i) => {
      edges.push({
        source: `storage_${i}`,
        target: 'cache_L1 Cache',
        label: 'metadata'
      });
    });
    
    // Cache tier flow
    ['L1 Cache', 'L2 Vector', 'Latent Manipulator', 'LLM Fallback'].forEach((tier, i, arr) => {
      if (i < arr.length - 1) {
        edges.push({
          source: `cache_${tier}`,
          target: `cache_${arr[i + 1]}`,
          label: i === 0 ? 'miss (8%)' : 'miss'
        });
      }
    });
    
    // Final tier → App
    edges.push({
      source: 'cache_LLM Fallback',
      target: 'app',
      label: 'response'
    });
    
    return edges;
  }

  /**
   * Learn from successful scan and onboarding
   */
  async learnFromScan(scanResults, onboardingSuccess) {
    if (!onboardingSuccess) return;
    
    const sector = this.detectSector(scanResults);
    const patternKey = `scan_success:${sector}:${scanResults.storage_apis.join(',')}`;
    
    await this.learn(patternKey, {
      namespaces_used: scanResults.namespaces,
      integration_successful: true,
      time_to_first_cache_hit: onboardingSuccess.time_to_first_hit
    }, 0.95);
    
    return { learned: true };
  }
}

/**
 * Wizard Registry
 * Central registry for all wizards
 */
export const WizardRegistry = {
  pipeline: PipelineWizard,
  orchestrator: AgentOrchestratorWizard,
  compliance: ComplianceWizard,
  costOptimizer: CostOptimizerWizard,
  customerOnboarding: CustomerOnboardingWizard,
  projectScanner: ProjectScannerWizard
};

/**
 * Create wizard instance
 */
export function createWizard(wizardType) {
  const WizardClass = WizardRegistry[wizardType];
  if (!WizardClass) {
    throw new Error(`Unknown wizard type: ${wizardType}`);
  }
  return new WizardClass();
}

export default { WizardRegistry, createWizard };
