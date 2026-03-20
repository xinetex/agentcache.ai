import { describe, expect, it } from 'vitest';
import {
  BUILDOUT_STEPS,
  getBuildoutStep,
  listBuildoutSteps,
  toMarkdownChecklist,
  toMarkdownSummary,
  summarizeBuildoutSteps,
} from '../../src/lib/workflow/buildoutPlan.js';

describe('buildout plan', () => {
  it('defines the first 60 build steps', () => {
    expect(BUILDOUT_STEPS).toHaveLength(60);
  });

  it('can filter build steps by lane', () => {
    const trustSteps = listBuildoutSteps({ lane: 'trust-evidence' });
    expect(trustSteps.length).toBeGreaterThan(0);
    expect(trustSteps.every((step) => step.lane === 'trust-evidence')).toBe(true);
  });

  it('returns a known step by id', () => {
    const step = getBuildoutStep('S23');
    expect(step?.title).toContain('managed buildout orchestrator');
  });

  it('renders a markdown checklist grouped by phase', () => {
    const markdown = toMarkdownChecklist(BUILDOUT_STEPS.slice(0, 2));
    expect(markdown).toContain('# Buildout Execution Graph');
    expect(markdown).toContain('## Phase 1: Foundation');
    expect(markdown).toContain('S01');
  });

  it('summarizes buildout status and phase progress', () => {
    const summary = summarizeBuildoutSteps(BUILDOUT_STEPS);
    const markdown = toMarkdownSummary(BUILDOUT_STEPS);

    expect(summary.total).toBe(60);
    expect((summary.byStatus.completed || 0)).toBeGreaterThan(0);
    expect(markdown).toContain('# Buildout Summary');
    expect(markdown).toContain('Phase 1: Foundation');
  });
});
