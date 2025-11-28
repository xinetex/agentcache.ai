/**
 * Demo Scenarios for AgentCache Studio
 * Pre-built scenarios that showcase caching value with live APIs
 */

const DEMO_SCENARIOS = [
  {
    id: 'crypto-trading',
    name: 'Crypto Trading Dashboard',
    icon: '₿',
    sector: 'finance',
    duration: 30,
    description: 'High-frequency price queries showing massive cost savings',
    dataSources: ['crypto-prices'],
    steps: [
      { action: 'fetch', sourceId: 'crypto-prices', delay: 2000, repeat: 15 }
    ],
    expectedMetrics: {
      calls: 15,
      hitRate: 93,
      costWithout: 0.030,
      costWith: 0.002,
      savings: 0.028
    }
  },
  {
    id: 'weather-monitoring',
    name: 'Weather Monitoring System',
    icon: '🌤️',
    sector: 'iot',
    duration: 25,
    description: 'IoT sensors with anti-cache invalidation on temp changes',
    dataSources: ['weather-data'],
    steps: [
      { action: 'fetch', sourceId: 'weather-data', delay: 5000, repeat: 5 }
    ],
    expectedMetrics: {
      calls: 5,
      hitRate: 80,
      costWithout: 0.005,
      costWith: 0.001,
      savings: 0.004
    }
  },
  {
    id: 'ecommerce-catalog',
    name: 'E-Commerce Product Catalog',
    icon: '🛒',
    sector: 'retail',
    duration: 20,
    description: 'Product queries demonstrating L1/L2/L3 cache hierarchy',
    dataSources: ['json-placeholder'],
    steps: [
      { action: 'fetch', sourceId: 'json-placeholder', delay: 1000, repeat: 20 }
    ],
    expectedMetrics: {
      calls: 20,
      hitRate: 95,
      costWithout: 0.020,
      costWith: 0.001,
      savings: 0.019
    }
  },
  {
    id: 'healthcare-lookup',
    name: 'Healthcare Drug Lookup',
    icon: '💊',
    sector: 'healthcare',
    duration: 15,
    description: 'HIPAA-compliant caching with deterministic results',
    dataSources: ['fda-drugs'],
    steps: [
      { action: 'fetch', sourceId: 'fda-drugs', delay: 3000, repeat: 5 }
    ],
    expectedMetrics: {
      calls: 5,
      hitRate: 80,
      costWithout: 0.015,
      costWith: 0.003,
      savings: 0.012
    }
  },
  {
    id: 'api-abuse-protection',
    name: 'High-Frequency API Protection',
    icon: '🚀',
    sector: 'general',
    duration: 15,
    description: 'Rapid-fire queries showing cache preventing rate limits',
    dataSources: ['crypto-prices'],
    steps: [
      { action: 'burst', sourceId: 'crypto-prices', count: 50, interval: 200 }
    ],
    expectedMetrics: {
      calls: 50,
      hitRate: 98,
      costWithout: 0.100,
      costWith: 0.002,
      savings: 0.098
    }
  }
];

/**
 * Scenario Runner - Executes demo scenarios with live data
 */
class ScenarioRunner {
  constructor(dataFetcher, onUpdate) {
    this.fetcher = dataFetcher;
    this.onUpdate = onUpdate;
    this.running = false;
    this.currentScenario = null;
    this.results = [];
  }

  /**
   * Run a scenario
   */
  async run(scenarioId) {
    const scenario = DEMO_SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    if (this.running) {
      throw new Error('A scenario is already running');
    }

    this.running = true;
    this.currentScenario = scenario;
    this.results = [];

    try {
      this.onUpdate({
        status: 'running',
        scenario,
        progress: 0,
        results: []
      });

      for (const step of scenario.steps) {
        if (step.action === 'fetch') {
          await this.executeFetchStep(step, scenario);
        } else if (step.action === 'burst') {
          await this.executeBurstStep(step, scenario);
        }
      }

      const finalMetrics = this.fetcher.getMetrics();
      
      this.onUpdate({
        status: 'completed',
        scenario,
        progress: 100,
        results: this.results,
        metrics: finalMetrics
      });

      return {
        scenario,
        results: this.results,
        metrics: finalMetrics
      };
    } catch (error) {
      this.onUpdate({
        status: 'error',
        scenario,
        error: error.message
      });
      throw error;
    } finally {
      this.running = false;
      this.currentScenario = null;
    }
  }

  /**
   * Execute fetch step (repeated API calls with delay)
   */
  async executeFetchStep(step, scenario) {
    const totalCalls = step.repeat || 1;
    
    for (let i = 0; i < totalCalls; i++) {
      if (!this.running) break;

      const result = await this.fetcher.fetch(step.sourceId, true);
      
      this.results.push({
        timestamp: Date.now(),
        call: i + 1,
        ...result
      });

      this.onUpdate({
        status: 'running',
        scenario,
        progress: Math.round(((i + 1) / totalCalls) * 100),
        results: this.results,
        currentCall: i + 1,
        totalCalls
      });

      if (i < totalCalls - 1) {
        await this.sleep(step.delay);
      }
    }
  }

  /**
   * Execute burst step (rapid-fire calls)
   */
  async executeBurstStep(step, scenario) {
    const promises = [];
    
    for (let i = 0; i < step.count; i++) {
      if (!this.running) break;

      const promise = this.fetcher.fetch(step.sourceId, true)
        .then(result => {
          this.results.push({
            timestamp: Date.now(),
            call: i + 1,
            ...result
          });

          this.onUpdate({
            status: 'running',
            scenario,
            progress: Math.round(((i + 1) / step.count) * 100),
            results: this.results,
            currentCall: i + 1,
            totalCalls: step.count
          });

          return result;
        })
        .catch(error => {
          console.error(`Burst call ${i + 1} failed:`, error);
          return { error: error.message, call: i + 1 };
        });

      promises.push(promise);

      if (step.interval && i < step.count - 1) {
        await this.sleep(step.interval);
      }
    }

    await Promise.all(promises);
  }

  /**
   * Stop running scenario
   */
  stop() {
    this.running = false;
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scenario by ID
   */
  static getScenario(scenarioId) {
    return DEMO_SCENARIOS.find(s => s.id === scenarioId);
  }

  /**
   * Get all scenarios
   */
  static getAllScenarios() {
    return DEMO_SCENARIOS;
  }

  /**
   * Get scenarios by sector
   */
  static getScenariosBySector(sector) {
    return DEMO_SCENARIOS.filter(s => s.sector === sector);
  }
}

// Export for use in Studio
if (typeof window !== 'undefined') {
  window.DEMO_SCENARIOS = DEMO_SCENARIOS;
  window.ScenarioRunner = ScenarioRunner;
}
