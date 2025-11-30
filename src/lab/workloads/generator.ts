/**
 * Monte Carlo Workload Generator
 * Generates realistic synthetic workloads for cache strategy testing
 */

export interface WorkloadConfig {
  sector: string;
  scenario: string;
  duration: number; // seconds
  qps: number; // queries per second
  distribution: 'uniform' | 'zipfian' | 'pareto' | 'temporal_burst';
  uniqueQueries: number;
  
  // Data characteristics
  avgPayloadSize: number; // bytes
  freshnessRequirement?: number; // max acceptable staleness in seconds
  burstiness?: number; // 0-1, how spiky the traffic is
  
  // Sector-specific
  complianceRequired?: boolean;
  dataClassification?: 'public' | 'confidential' | 'sensitive' | 'restricted';
}

export interface Query {
  id: string;
  timestamp: number;
  payload: string;
  metadata: {
    sector: string;
    category: string;
    priority: 'low' | 'normal' | 'high' | 'critical';
    freshnessRequired: boolean;
    sensitiveData: boolean;
  };
  expectedResponseSize: number;
}

export interface WorkloadResult {
  queries: Query[];
  statistics: {
    totalQueries: number;
    uniqueQueries: number;
    avgQPS: number;
    peakQPS: number;
    distribution: Record<string, number>; // category → count
  };
}

/**
 * Healthcare sector workload generator
 */
export class HealthcareWorkloadGenerator {
  private categories = [
    'patient_lookup',
    'medication_interaction',
    'lab_results',
    'diagnosis_codes',
    'procedure_codes',
    'insurance_verification',
    'clinical_guidelines',
    'drug_formulary',
  ];
  
  private patients = this.generatePatientIds(10000);
  
  private generatePatientIds(count: number): string[] {
    return Array.from({ length: count }, (_, i) => 
      `P${String(i + 1).padStart(8, '0')}`
    );
  }
  
  generate(config: WorkloadConfig): WorkloadResult {
    const queries: Query[] = [];
    const totalQueries = config.duration * config.qps;
    const distribution: Record<string, number> = {};
    
    // Zipfian distribution: 80% of queries target 20% of patients
    const hotPatients = this.zipfianSample(this.patients, 0.2);
    
    let currentTime = Date.now();
    let qpsTracker = config.qps;
    
    for (let i = 0; i < totalQueries; i++) {
      // Adjust QPS for burstiness
      if (config.burstiness && Math.random() < config.burstiness) {
        qpsTracker = config.qps * (1 + Math.random() * 3); // Spike up to 4x
      } else {
        qpsTracker = config.qps;
      }
      
      const interval = 1000 / qpsTracker;
      currentTime += interval;
      
      // Select category (weighted distribution)
      const category = this.weightedCategory();
      distribution[category] = (distribution[category] || 0) + 1;
      
      // 80/20 rule: 80% of queries for 20% of patients
      const patient = Math.random() < 0.8
        ? hotPatients[Math.floor(Math.random() * hotPatients.length)]
        : this.patients[Math.floor(Math.random() * this.patients.length)];
      
      queries.push({
        id: `q-${i}`,
        timestamp: currentTime,
        payload: this.generatePayload(category, patient),
        metadata: {
          sector: 'healthcare',
          category,
          priority: this.getPriority(category),
          freshnessRequired: this.requiresFreshness(category),
          sensitiveData: true, // All healthcare data is sensitive
        },
        expectedResponseSize: this.getResponseSize(category),
      });
    }
    
    const peakQPS = Math.max(...this.calculateQPSTimeseries(queries));
    
    return {
      queries,
      statistics: {
        totalQueries: queries.length,
        uniqueQueries: new Set(queries.map(q => q.payload)).size,
        avgQPS: config.qps,
        peakQPS,
        distribution,
      },
    };
  }
  
  private weightedCategory(): string {
    // Weighted by real-world frequency
    const weights = {
      patient_lookup: 0.30,
      medication_interaction: 0.20,
      lab_results: 0.15,
      diagnosis_codes: 0.12,
      procedure_codes: 0.10,
      insurance_verification: 0.08,
      clinical_guidelines: 0.03,
      drug_formulary: 0.02,
    };
    
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [category, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (rand < cumulative) return category;
    }
    
    return 'patient_lookup';
  }
  
  private generatePayload(category: string, patient: string): string {
    const templates = {
      patient_lookup: `GET /api/patients/${patient}`,
      medication_interaction: `POST /api/medications/check {drugs: ["${this.randomDrug()}", "${this.randomDrug()}"]}`,
      lab_results: `GET /api/patients/${patient}/labs?type=${this.randomLabType()}`,
      diagnosis_codes: `GET /api/icd10/${this.randomICD10()}`,
      procedure_codes: `GET /api/cpt/${this.randomCPT()}`,
      insurance_verification: `POST /api/insurance/verify {patient: "${patient}"}`,
      clinical_guidelines: `GET /api/guidelines?condition=${this.randomCondition()}`,
      drug_formulary: `GET /api/formulary/${this.randomDrug()}`,
    };
    
    return templates[category as keyof typeof templates] || templates.patient_lookup;
  }
  
  private getPriority(category: string): 'low' | 'normal' | 'high' | 'critical' {
    const priorities: Record<string, 'low' | 'normal' | 'high' | 'critical'> = {
      patient_lookup: 'high',
      medication_interaction: 'critical',
      lab_results: 'high',
      diagnosis_codes: 'normal',
      procedure_codes: 'normal',
      insurance_verification: 'low',
      clinical_guidelines: 'normal',
      drug_formulary: 'normal',
    };
    return priorities[category] || 'normal';
  }
  
  private requiresFreshness(category: string): boolean {
    // These categories need real-time data
    return ['medication_interaction', 'insurance_verification'].includes(category);
  }
  
  private getResponseSize(category: string): number {
    const sizes: Record<string, number> = {
      patient_lookup: 2048,
      medication_interaction: 512,
      lab_results: 4096,
      diagnosis_codes: 256,
      procedure_codes: 256,
      insurance_verification: 1024,
      clinical_guidelines: 8192,
      drug_formulary: 512,
    };
    return sizes[category] || 1024;
  }
  
  private zipfianSample<T>(array: T[], fraction: number): T[] {
    const count = Math.floor(array.length * fraction);
    return array.slice(0, count);
  }
  
  private calculateQPSTimeseries(queries: Query[]): number[] {
    const buckets: Record<number, number> = {};
    queries.forEach(q => {
      const bucket = Math.floor(q.timestamp / 1000);
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });
    return Object.values(buckets);
  }
  
  private randomDrug() {
    const drugs = ['aspirin', 'warfarin', 'metformin', 'lisinopril', 'atorvastatin', 'omeprazole'];
    return drugs[Math.floor(Math.random() * drugs.length)];
  }
  
  private randomLabType() {
    const types = ['cbc', 'bmp', 'lipid', 'hba1c', 'tsh', 'urinalysis'];
    return types[Math.floor(Math.random() * types.length)];
  }
  
  private randomICD10() {
    const codes = ['E11.9', 'I10', 'J44.9', 'M79.3', 'F41.9', 'K21.9'];
    return codes[Math.floor(Math.random() * codes.length)];
  }
  
  private randomCPT() {
    const codes = ['99213', '99214', '99215', '80053', '36415', '93000'];
    return codes[Math.floor(Math.random() * codes.length)];
  }
  
  private randomCondition() {
    const conditions = ['diabetes', 'hypertension', 'copd', 'chf', 'sepsis', 'pneumonia'];
    return conditions[Math.floor(Math.random() * conditions.length)];
  }
}

/**
 * Finance sector workload generator
 */
export class FinanceWorkloadGenerator {
  private symbols = ['BTC', 'ETH', 'AAPL', 'GOOGL', 'TSLA', 'SPY', 'EUR/USD', 'GLD'];
  private accounts = this.generateAccountIds(5000);
  
  private generateAccountIds(count: number): string[] {
    return Array.from({ length: count }, (_, i) => 
      `ACC${String(i + 100000)}`
    );
  }
  
  generate(config: WorkloadConfig): WorkloadResult {
    const queries: Query[] = [];
    const totalQueries = config.duration * config.qps;
    const distribution: Record<string, number> = {};
    
    let currentTime = Date.now();
    
    for (let i = 0; i < totalQueries; i++) {
      currentTime += 1000 / config.qps;
      
      const category = this.weightedCategory();
      distribution[category] = (distribution[category] || 0) + 1;
      
      queries.push({
        id: `q-${i}`,
        timestamp: currentTime,
        payload: this.generatePayload(category),
        metadata: {
          sector: 'finance',
          category,
          priority: this.getPriority(category),
          freshnessRequired: this.requiresFreshness(category),
          sensitiveData: category.includes('account') || category.includes('fraud'),
        },
        expectedResponseSize: this.getResponseSize(category),
      });
    }
    
    return {
      queries,
      statistics: {
        totalQueries: queries.length,
        uniqueQueries: new Set(queries.map(q => q.payload)).size,
        avgQPS: config.qps,
        peakQPS: config.qps * 1.5, // Finance has moderate spikes
        distribution,
      },
    };
  }
  
  private weightedCategory(): string {
    const weights = {
      market_data: 0.35,
      account_balance: 0.25,
      fraud_check: 0.15,
      transaction_history: 0.10,
      compliance_check: 0.08,
      risk_assessment: 0.05,
      portfolio_valuation: 0.02,
    };
    
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [category, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (rand < cumulative) return category;
    }
    
    return 'market_data';
  }
  
  private generatePayload(category: string): string {
    const symbol = this.symbols[Math.floor(Math.random() * this.symbols.length)];
    const account = this.accounts[Math.floor(Math.random() * this.accounts.length)];
    
    const templates: Record<string, string> = {
      market_data: `GET /api/quote/${symbol}`,
      account_balance: `GET /api/accounts/${account}/balance`,
      fraud_check: `POST /api/fraud/check {account: "${account}", amount: ${Math.random() * 10000}}`,
      transaction_history: `GET /api/accounts/${account}/transactions?days=30`,
      compliance_check: `POST /api/compliance/verify {account: "${account}"}`,
      risk_assessment: `GET /api/risk/${account}`,
      portfolio_valuation: `GET /api/portfolios/${account}/value`,
    };
    
    return templates[category] || templates.market_data;
  }
  
  private getPriority(category: string): 'low' | 'normal' | 'high' | 'critical' {
    if (category === 'fraud_check') return 'critical';
    if (category === 'market_data') return 'high';
    if (category === 'compliance_check') return 'high';
    return 'normal';
  }
  
  private requiresFreshness(category: string): boolean {
    // Market data and fraud checks need real-time data
    return ['market_data', 'fraud_check', 'account_balance'].includes(category);
  }
  
  private getResponseSize(category: string): number {
    const sizes: Record<string, number> = {
      market_data: 512,
      account_balance: 256,
      fraud_check: 1024,
      transaction_history: 8192,
      compliance_check: 2048,
      risk_assessment: 4096,
      portfolio_valuation: 1024,
    };
    return sizes[category] || 512;
  }
}

/**
 * HPC (High Performance Computing) sector workload generator
 */
export class HPCWorkloadGenerator {
  private jobs = this.generateJobIds(1000);
  private checkpoints = this.generateCheckpointIds(5000);
  
  private generateJobIds(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `job-${i}`);
  }
  
  private generateCheckpointIds(count: number): string[] {
    return Array.from({ length: count }, (_, i) => `ckpt-${i}`);
  }
  
  generate(config: WorkloadConfig): WorkloadResult {
    const queries: Query[] = [];
    const totalQueries = config.duration * config.qps;
    const distribution: Record<string, number> = {};
    
    let currentTime = Date.now();
    
    for (let i = 0; i < totalQueries; i++) {
      currentTime += 1000 / config.qps;
      
      const category = this.weightedCategory();
      distribution[category] = (distribution[category] || 0) + 1;
      
      queries.push({
        id: `q-${i}`,
        timestamp: currentTime,
        payload: this.generatePayload(category),
        metadata: {
          sector: 'hpc',
          category,
          priority: this.getPriority(category),
          freshnessRequired: false, // HPC cares about throughput, not freshness
          sensitiveData: category.includes('research'),
        },
        expectedResponseSize: this.getResponseSize(category),
      });
    }
    
    return {
      queries,
      statistics: {
        totalQueries: queries.length,
        uniqueQueries: new Set(queries.map(q => q.payload)).size,
        avgQPS: config.qps,
        peakQPS: config.qps * 2, // HPC has high burst during checkpoint writes
        distribution,
      },
    };
  }
  
  private weightedCategory(): string {
    const weights = {
      checkpoint_read: 0.30,
      checkpoint_write: 0.25,
      tensor_operation: 0.20,
      simulation_state: 0.12,
      research_data: 0.08,
      model_weights: 0.05,
    };
    
    const rand = Math.random();
    let cumulative = 0;
    
    for (const [category, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (rand < cumulative) return category;
    }
    
    return 'checkpoint_read';
  }
  
  private generatePayload(category: string): string {
    const job = this.jobs[Math.floor(Math.random() * this.jobs.length)];
    const ckpt = this.checkpoints[Math.floor(Math.random() * this.checkpoints.length)];
    
    const templates: Record<string, string> = {
      checkpoint_read: `GET /api/checkpoints/${ckpt}`,
      checkpoint_write: `POST /api/checkpoints/${job} {state: "${ckpt}", size: ${Math.random() * 1000}MB}`,
      tensor_operation: `POST /api/tensor/matmul {shape: [1024, 1024]}`,
      simulation_state: `GET /api/simulations/${job}/state`,
      research_data: `GET /api/datasets/${this.randomDataset()}/chunk/${Math.floor(Math.random() * 1000)}`,
      model_weights: `GET /api/models/${this.randomModel()}/weights`,
    };
    
    return templates[category] || templates.checkpoint_read;
  }
  
  private getPriority(category: string): 'low' | 'normal' | 'high' | 'critical' {
    if (category === 'checkpoint_write') return 'critical';
    if (category === 'tensor_operation') return 'high';
    return 'normal';
  }
  
  private getResponseSize(category: string): number {
    const sizes: Record<string, number> = {
      checkpoint_read: 1048576, // 1MB
      checkpoint_write: 256,
      tensor_operation: 524288, // 512KB
      simulation_state: 2048,
      research_data: 1048576,
      model_weights: 10485760, // 10MB
    };
    return sizes[category] || 1024;
  }
  
  private randomDataset() {
    const datasets = ['imagenet', 'coco', 'genomics', 'climate', 'physics'];
    return datasets[Math.floor(Math.random() * datasets.length)];
  }
  
  private randomModel() {
    const models = ['resnet50', 'bert', 'gpt', 'vit', 'diffusion'];
    return models[Math.floor(Math.random() * models.length)];
  }
}

/**
 * Factory function to create workload generators
 */
export function createWorkloadGenerator(sector: string) {
  switch (sector.toLowerCase()) {
    case 'healthcare':
      return new HealthcareWorkloadGenerator();
    case 'finance':
      return new FinanceWorkloadGenerator();
    case 'hpc':
      return new HPCWorkloadGenerator();
    default:
      throw new Error(`Unsupported sector: ${sector}`);
  }
}
