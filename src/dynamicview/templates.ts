/**
 * Dynamic View Templates
 * 
 * Pre-built UI schemas for common AgentCache Studio use cases
 */

import { DynamicViewSchema } from './schema';

// ========== Template 1: Pipeline Performance Dashboard ==========

export const PIPELINE_DASHBOARD_TEMPLATE: DynamicViewSchema = {
  version: '1.0',
  id: 'pipeline-dashboard',
  title: 'Pipeline Performance Dashboard',
  description: 'Real-time metrics and visualizations for your caching pipeline',
  root: {
    id: 'root',
    type: 'column',
    gap: 16,
    children: [
      {
        id: 'header',
        type: 'row',
        gap: 12,
        align: 'center',
        children: [
          {
            id: 'title',
            type: 'heading',
            content: 'Pipeline Performance',
            level: 1,
          },
          {
            id: 'refresh-badge',
            type: 'badge',
            label: 'Live',
            variant: 'success',
            icon: '🟢',
          },
        ],
      },
      {
        id: 'metrics-grid',
        type: 'grid',
        columns: 3,
        gap: 16,
        children: [
          {
            id: 'hit-rate-card',
            type: 'card',
            title: 'Cache Hit Rate',
            variant: 'elevated',
            children: [
              {
                id: 'hit-rate-metric',
                type: 'metric',
                label: 'Current',
                value: 87.5,
                unit: '%',
                trend: 'up',
                trendValue: '+3.2%',
              },
              {
                id: 'hit-rate-progress',
                type: 'progress',
                value: 87.5,
                variant: 'success',
              },
            ],
          },
          {
            id: 'latency-card',
            type: 'card',
            title: 'Avg Latency',
            variant: 'elevated',
            children: [
              {
                id: 'latency-metric',
                type: 'metric',
                label: 'P95',
                value: 127,
                unit: 'ms',
                trend: 'down',
                trendValue: '-45ms',
              },
              {
                id: 'latency-sparkline',
                type: 'sparkline',
                data: [245, 220, 195, 180, 160, 145, 127],
                variant: 'line',
              },
            ],
          },
          {
            id: 'savings-card',
            type: 'card',
            title: 'Cost Savings',
            variant: 'elevated',
            children: [
              {
                id: 'savings-metric',
                type: 'metric',
                label: 'Today',
                value: '$487',
                trend: 'up',
                trendValue: '+12%',
              },
              {
                id: 'savings-chart',
                type: 'chart',
                chartType: 'bar',
                data: [
                  { label: 'Mon', value: 320 },
                  { label: 'Tue', value: 410 },
                  { label: 'Wed', value: 450 },
                  { label: 'Thu', value: 487 },
                ],
                showLegend: false,
              },
            ],
          },
        ],
      },
      {
        id: 'chart-section',
        type: 'card',
        title: 'Request Volume (24h)',
        children: [
          {
            id: 'volume-chart',
            type: 'chart',
            chartType: 'line',
            data: [
              { label: '00:00', value: 1200 },
              { label: '04:00', value: 800 },
              { label: '08:00', value: 2400 },
              { label: '12:00', value: 3600 },
              { label: '16:00', value: 3200 },
              { label: '20:00', value: 2100 },
            ],
            showLegend: true,
          },
        ],
      },
    ],
  },
  metadata: {
    generatedBy: 'template',
    generatedAt: Date.now(),
  },
};

// ========== Template 2: Cost Optimization Analyzer ==========

export const COST_OPTIMIZER_TEMPLATE: DynamicViewSchema = {
  version: '1.0',
  id: 'cost-optimizer',
  title: 'Cost Optimization Analyzer',
  description: 'Interactive tools to optimize caching costs and efficiency',
  root: {
    id: 'root',
    type: 'column',
    gap: 16,
    children: [
      {
        id: 'header',
        type: 'heading',
        content: 'Cost Optimization Analyzer',
        level: 1,
      },
      {
        id: 'cost-breakdown',
        type: 'card',
        title: 'Cost Breakdown',
        children: [
          {
            id: 'cost-chart',
            type: 'chart',
            chartType: 'pie',
            data: [
              { label: 'LLM API Calls', value: 450 },
              { label: 'Cache Storage', value: 50 },
              { label: 'Data Transfer', value: 20 },
            ],
            title: 'Monthly Costs',
            showLegend: true,
          },
        ],
      },
      {
        id: 'optimization-controls',
        type: 'card',
        title: 'Optimization Settings',
        children: [
          {
            id: 'ttl-slider',
            type: 'slider',
            label: 'Cache TTL (days)',
            min: 1,
            max: 30,
            step: 1,
            value: 7,
            onChange: 'update-ttl',
          },
          {
            id: 'compression-toggle',
            type: 'toggle',
            label: 'Enable compression',
            checked: true,
            onChange: 'toggle-compression',
          },
          {
            id: 'tier-select',
            type: 'select',
            label: 'Cache Tier Strategy',
            options: [
              { label: 'Single Tier (L1 only)', value: 'single' },
              { label: 'Dual Tier (L1 + L2)', value: 'dual' },
              { label: 'Multi-Tier (L1 + L2 + L3)', value: 'multi' },
            ],
            value: 'dual',
            onChange: 'change-tier',
          },
        ],
      },
      {
        id: 'projected-savings',
        type: 'card',
        title: 'Projected Monthly Savings',
        children: [
          {
            id: 'savings-metric',
            type: 'metric',
            label: 'With Current Settings',
            value: '$3,240',
            unit: '/month',
            trend: 'up',
            trendValue: '87% reduction',
          },
          {
            id: 'apply-button',
            type: 'button',
            label: 'Apply Optimizations',
            variant: 'primary',
            onClick: 'apply-optimizations',
          },
        ],
      },
    ],
  },
  metadata: {
    generatedBy: 'template',
    generatedAt: Date.now(),
  },
};

// ========== Template 3: Cache Hit Rate Visualization ==========

export const HIT_RATE_VIZ_TEMPLATE: DynamicViewSchema = {
  version: '1.0',
  id: 'hit-rate-viz',
  title: 'Cache Hit Rate Visualization',
  description: 'Detailed analysis of cache hit patterns and performance',
  root: {
    id: 'root',
    type: 'column',
    gap: 16,
    children: [
      {
        id: 'header',
        type: 'heading',
        content: 'Cache Hit Rate Analysis',
        level: 1,
      },
      {
        id: 'overview-row',
        type: 'row',
        gap: 16,
        children: [
          {
            id: 'overall-rate',
            type: 'card',
            title: 'Overall Hit Rate',
            variant: 'elevated',
            children: [
              {
                id: 'rate-metric',
                type: 'metric',
                label: '7-day average',
                value: 84.3,
                unit: '%',
                trend: 'up',
                trendValue: '+5.2%',
              },
              {
                id: 'rate-progress',
                type: 'progress',
                value: 84,
                variant: 'success',
              },
            ],
          },
          {
            id: 'cache-hits',
            type: 'card',
            title: 'Total Hits',
            variant: 'elevated',
            children: [
              {
                id: 'hits-metric',
                type: 'metric',
                label: 'Last 24h',
                value: '12.4K',
                trend: 'up',
                trendValue: '+8%',
              },
            ],
          },
          {
            id: 'cache-misses',
            type: 'card',
            title: 'Total Misses',
            variant: 'elevated',
            children: [
              {
                id: 'misses-metric',
                type: 'metric',
                label: 'Last 24h',
                value: '2.3K',
                trend: 'down',
                trendValue: '-3%',
              },
            ],
          },
        ],
      },
      {
        id: 'trend-chart',
        type: 'card',
        title: 'Hit Rate Trend',
        children: [
          {
            id: 'trend-line',
            type: 'chart',
            chartType: 'line',
            data: [
              { label: 'Mon', value: 78 },
              { label: 'Tue', value: 80 },
              { label: 'Wed', value: 82 },
              { label: 'Thu', value: 81 },
              { label: 'Fri', value: 85 },
              { label: 'Sat', value: 87 },
              { label: 'Sun', value: 84 },
            ],
            showLegend: false,
          },
        ],
      },
      {
        id: 'namespace-breakdown',
        type: 'card',
        title: 'Hit Rate by Namespace',
        children: [
          {
            id: 'namespace-chart',
            type: 'chart',
            chartType: 'bar',
            data: [
              { label: 'production', value: 92 },
              { label: 'staging', value: 78 },
              { label: 'development', value: 65 },
            ],
            showLegend: true,
          },
        ],
      },
    ],
  },
  metadata: {
    generatedBy: 'template',
    generatedAt: Date.now(),
  },
};

// ========== Template 4: Compliance Audit Checklist ==========

export const COMPLIANCE_CHECKLIST_TEMPLATE: DynamicViewSchema = {
  version: '1.0',
  id: 'compliance-checklist',
  title: 'Compliance Audit Checklist',
  description: 'HIPAA, SOC2, and other compliance requirements tracking',
  root: {
    id: 'root',
    type: 'column',
    gap: 16,
    children: [
      {
        id: 'header-row',
        type: 'row',
        gap: 12,
        align: 'center',
        children: [
          {
            id: 'title',
            type: 'heading',
            content: 'Compliance Checklist',
            level: 1,
          },
          {
            id: 'hipaa-badge',
            type: 'badge',
            label: 'HIPAA Compliant',
            variant: 'success',
            icon: '✓',
          },
        ],
      },
      {
        id: 'compliance-grid',
        type: 'grid',
        columns: 2,
        gap: 16,
        children: [
          {
            id: 'encryption-card',
            type: 'card',
            title: 'Data Encryption',
            variant: 'elevated',
            children: [
              {
                id: 'at-rest-toggle',
                type: 'toggle',
                label: 'Encryption at rest',
                checked: true,
              },
              {
                id: 'in-transit-toggle',
                type: 'toggle',
                label: 'Encryption in transit',
                checked: true,
              },
              {
                id: 'key-rotation-toggle',
                type: 'toggle',
                label: 'Automatic key rotation',
                checked: true,
              },
            ],
          },
          {
            id: 'access-control-card',
            type: 'card',
            title: 'Access Control',
            variant: 'elevated',
            children: [
              {
                id: 'mfa-toggle',
                type: 'toggle',
                label: 'Multi-factor authentication',
                checked: true,
              },
              {
                id: 'rbac-toggle',
                type: 'toggle',
                label: 'Role-based access control',
                checked: true,
              },
              {
                id: 'audit-logs-toggle',
                type: 'toggle',
                label: 'Audit logging enabled',
                checked: true,
              },
            ],
          },
          {
            id: 'data-handling-card',
            type: 'card',
            title: 'Data Handling',
            variant: 'elevated',
            children: [
              {
                id: 'retention-toggle',
                type: 'toggle',
                label: 'Data retention policy',
                checked: true,
              },
              {
                id: 'anonymization-toggle',
                type: 'toggle',
                label: 'PII anonymization',
                checked: false,
              },
              {
                id: 'deletion-toggle',
                type: 'toggle',
                label: 'Right to deletion',
                checked: true,
              },
            ],
          },
          {
            id: 'monitoring-card',
            type: 'card',
            title: 'Monitoring',
            variant: 'elevated',
            children: [
              {
                id: 'alerts-toggle',
                type: 'toggle',
                label: 'Security alerts',
                checked: true,
              },
              {
                id: 'anomaly-toggle',
                type: 'toggle',
                label: 'Anomaly detection',
                checked: true,
              },
              {
                id: 'reports-toggle',
                type: 'toggle',
                label: 'Monthly compliance reports',
                checked: true,
              },
            ],
          },
        ],
      },
      {
        id: 'compliance-score',
        type: 'card',
        title: 'Compliance Score',
        children: [
          {
            id: 'score-metric',
            type: 'metric',
            label: 'Overall Score',
            value: 92,
            unit: '/100',
            trend: 'up',
          },
          {
            id: 'score-progress',
            type: 'progress',
            value: 92,
            variant: 'success',
          },
        ],
      },
    ],
  },
  metadata: {
    generatedBy: 'template',
    generatedAt: Date.now(),
  },
};

// ========== Template 5: Node Configuration Panel ==========

export const NODE_CONFIG_TEMPLATE: DynamicViewSchema = {
  version: '1.0',
  id: 'node-config',
  title: 'Pipeline Node Configuration',
  description: 'Configure individual nodes in your caching pipeline',
  root: {
    id: 'root',
    type: 'column',
    gap: 16,
    children: [
      {
        id: 'header',
        type: 'heading',
        content: 'Configure Cache Node',
        level: 1,
      },
      {
        id: 'node-display',
        type: 'card',
        title: 'Selected Node',
        children: [
          {
            id: 'node-card',
            type: 'node-card',
            nodeType: 'cache_l1',
            label: 'L1 Cache',
            icon: '🚀',
            status: 'active',
            metadata: {
              'Hit Rate': '94%',
              'Latency': '5ms',
              'Size': '512MB',
            },
          },
        ],
      },
      {
        id: 'config-form',
        type: 'card',
        title: 'Configuration',
        children: [
          {
            id: 'name-input',
            type: 'input',
            label: 'Node Name',
            value: 'L1 Cache',
            placeholder: 'Enter node name',
            onChange: 'update-name',
          },
          {
            id: 'size-slider',
            type: 'slider',
            label: 'Cache Size (MB)',
            min: 128,
            max: 2048,
            step: 128,
            value: 512,
            onChange: 'update-size',
          },
          {
            id: 'eviction-select',
            type: 'select',
            label: 'Eviction Policy',
            options: [
              { label: 'Least Recently Used (LRU)', value: 'lru' },
              { label: 'Least Frequently Used (LFU)', value: 'lfu' },
              { label: 'First In First Out (FIFO)', value: 'fifo' },
              { label: 'Time To Live (TTL)', value: 'ttl' },
            ],
            value: 'lru',
            onChange: 'change-eviction',
          },
          {
            id: 'compression-toggle',
            type: 'toggle',
            label: 'Enable compression',
            checked: true,
            onChange: 'toggle-compression',
          },
          {
            id: 'warmup-toggle',
            type: 'toggle',
            label: 'Pre-warm on startup',
            checked: false,
            onChange: 'toggle-warmup',
          },
        ],
      },
      {
        id: 'actions-row',
        type: 'row',
        gap: 8,
        children: [
          {
            id: 'save-button',
            type: 'button',
            label: 'Save Changes',
            variant: 'primary',
            onClick: 'save-config',
          },
          {
            id: 'reset-button',
            type: 'button',
            label: 'Reset to Defaults',
            variant: 'secondary',
            onClick: 'reset-config',
          },
        ],
      },
    ],
  },
  metadata: {
    generatedBy: 'template',
    generatedAt: Date.now(),
  },
};

// ========== Template Registry ==========

export const TEMPLATE_REGISTRY: Record<string, DynamicViewSchema> = {
  'pipeline-dashboard': PIPELINE_DASHBOARD_TEMPLATE,
  'cost-optimizer': COST_OPTIMIZER_TEMPLATE,
  'hit-rate-viz': HIT_RATE_VIZ_TEMPLATE,
  'compliance-checklist': COMPLIANCE_CHECKLIST_TEMPLATE,
  'node-config': NODE_CONFIG_TEMPLATE,
};

export function getTemplate(id: string): DynamicViewSchema | null {
  return TEMPLATE_REGISTRY[id] || null;
}

export function getAllTemplates(): Array<{ id: string; title: string; description: string }> {
  return Object.values(TEMPLATE_REGISTRY).map(t => ({
    id: t.id,
    title: t.title,
    description: t.description || '',
  }));
}
