/**
 * Test Sector Templates
 * Validates all 10 sector pipeline templates are properly configured
 * Usage: node scripts/test-sector-templates.js
 */

import { PIPELINE_PRESETS } from '../src/config/presets.js';

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function log(color, symbol, message) {
  console.log(`${color}${symbol}${COLORS.reset} ${message}`);
}

function validateTemplate(template, sector) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!template.id) errors.push('Missing id');
  if (!template.name) errors.push('Missing name');
  if (!template.description) errors.push('Missing description');
  if (!template.icon) warnings.push('Missing icon');
  if (!template.metrics) errors.push('Missing metrics');
  if (!template.nodes) errors.push('Missing nodes array');
  if (!template.edges) errors.push('Missing edges array');

  // Validate metrics
  if (template.metrics) {
    if (template.metrics.hitRate < 0 || template.metrics.hitRate > 1) {
      errors.push(`Invalid hitRate: ${template.metrics.hitRate} (must be 0-1)`);
    }
    if (template.metrics.latency < 0) {
      errors.push(`Invalid latency: ${template.metrics.latency} (must be positive)`);
    }
  }

  // Validate nodes
  if (template.nodes) {
    if (template.nodes.length === 0) {
      errors.push('No nodes defined');
    }
    
    template.nodes.forEach((node, idx) => {
      if (!node.type) errors.push(`Node ${idx} missing type`);
      if (!node.position) errors.push(`Node ${idx} missing position`);
      if (!node.config) warnings.push(`Node ${idx} missing config`);
    });
  }

  // Validate edges
  if (template.edges) {
    template.edges.forEach((edge, idx) => {
      if (!edge.source) errors.push(`Edge ${idx} missing source`);
      if (!edge.target) errors.push(`Edge ${idx} missing target`);
    });
    
    // Check that edges reference existing nodes
    const nodeIds = template.nodes.map((n, i) => `${n.type}-${i}`);
    template.edges.forEach((edge) => {
      const sourceExists = edge.source.split('-')[0];
      const targetExists = edge.target.split('-')[0];
      if (!template.nodes.find(n => n.type === sourceExists)) {
        errors.push(`Edge source "${edge.source}" references non-existent node`);
      }
      if (!template.nodes.find(n => n.type === targetExists)) {
        errors.push(`Edge target "${edge.target}" references non-existent node`);
      }
    });
  }

  return { errors, warnings };
}

console.log('\n🧪 Testing Sector Pipeline Templates\n');
console.log('='.repeat(60));

const sectors = Object.keys(PIPELINE_PRESETS);
let totalTemplates = 0;
let totalErrors = 0;
let totalWarnings = 0;

for (const sector of sectors) {
  const presets = PIPELINE_PRESETS[sector];
  
  log(COLORS.cyan, '\n📁', `Sector: ${sector} (${presets.length} templates)`);
  
  for (const preset of presets) {
    totalTemplates++;
    const { errors, warnings } = validateTemplate(preset, sector);
    
    if (errors.length === 0 && warnings.length === 0) {
      log(COLORS.green, '  ✅', `${preset.name}`);
      console.log(`      Nodes: ${preset.nodes.length}, Edges: ${preset.edges.length}, Hit Rate: ${(preset.metrics.hitRate * 100).toFixed(0)}%`);
    } else {
      if (errors.length > 0) {
        log(COLORS.red, '  ❌', `${preset.name}`);
        errors.forEach(err => console.log(`      ERROR: ${err}`));
        totalErrors += errors.length;
      }
      if (warnings.length > 0) {
        log(COLORS.yellow, '  ⚠️ ', `${preset.name}`);
        warnings.forEach(warn => console.log(`      WARN: ${warn}`));
        totalWarnings += warnings.length;
      }
    }
  }
}

console.log('\n' + '='.repeat(60));
console.log('\n📊 Test Summary:\n');
console.log(`   Total Sectors: ${sectors.length}`);
console.log(`   Total Templates: ${totalTemplates}`);
console.log(`   ${COLORS.green}✅ Passed: ${totalTemplates - Math.min(totalErrors, totalTemplates)}${COLORS.reset}`);
console.log(`   ${COLORS.red}❌ Errors: ${totalErrors}${COLORS.reset}`);
console.log(`   ${COLORS.yellow}⚠️  Warnings: ${totalWarnings}${COLORS.reset}`);

// Calculate stats
const allPresets = Object.values(PIPELINE_PRESETS).flat();
const avgHitRate = allPresets.reduce((sum, p) => sum + p.metrics.hitRate, 0) / allPresets.length;
const avgLatency = allPresets.reduce((sum, p) => sum + p.metrics.latency, 0) / allPresets.length;
const avgNodes = allPresets.reduce((sum, p) => sum + p.nodes.length, 0) / allPresets.length;

console.log('\n📈 Performance Metrics:\n');
console.log(`   Average Hit Rate: ${(avgHitRate * 100).toFixed(1)}%`);
console.log(`   Average Latency: ${avgLatency.toFixed(0)}ms`);
console.log(`   Average Nodes per Template: ${avgNodes.toFixed(1)}`);

if (totalErrors === 0) {
  log(COLORS.green, '\n✅', 'All templates validated successfully!');
  process.exit(0);
} else {
  log(COLORS.red, '\n❌', `${totalErrors} errors found. Please fix before deploying.`);
  process.exit(1);
}
