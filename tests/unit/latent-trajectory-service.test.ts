import { describe, expect, it } from 'vitest';
import { LatentTrajectoryService } from '../../src/services/LatentTrajectoryService.js';

const anchorMap = {
  robotics: [
    {
      id: 'robotics-anchor-1',
      sector: 'robotics',
      version: '1.0.0',
      embedding: [0, 1, 0],
      description: 'Manipulator baseline',
    },
  ],
  finance: [
    {
      id: 'finance-anchor-1',
      sector: 'finance',
      version: '1.0.0',
      embedding: [1, 0, 0],
      description: 'Finance baseline',
    },
  ],
} as const;

const embedder = async (text: string) => {
  const lower = text.toLowerCase();
  if (lower.includes('manipulator')) return [0.2, 0.8, 0];
  if (lower.includes('robotics goal')) return [0, 1, 0];
  if (lower.includes('finance')) return [0.9, 0.1, 0];
  if (lower.includes('teleport')) return [0, 0, 1];
  return [0.3, 0.3, 0.4];
};

const monitor = {
  async initializeDefaultAnchors() { },
  getAnchorsForSector(sector: keyof typeof anchorMap) {
    return [...(anchorMap[sector] || [])];
  },
  async measureDrift(_sector: string, vector: number[]) {
    return Math.max(0, 1 - Math.max(...vector));
  },
};

describe('LatentTrajectoryService', () => {
  it('predicts a stable anchor-guided latent shift for manipulator queries', async () => {
    const service = new LatentTrajectoryService({
      embedder,
      monitor: monitor as any,
    });

    const result = await service.predict({
      query: 'Need inverse kinematics support for a 6-DOF manipulator',
      goalQuery: 'robotics goal',
    });

    expect(result.sector).toBe('robotics');
    expect(result.mode).toBe('goal_guided');
    expect(result.anchorCount).toBe(1);
    expect(result.expectedShift).toBeGreaterThan(0.005);
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.collapseRisk).toBeLessThan(0.9);
  });

  it('flags implausible latent jumps as surprising', async () => {
    const service = new LatentTrajectoryService({
      embedder,
      monitor: monitor as any,
    });

    const result = await service.assessRealization({
      query: 'finance reconciliation workflow',
      actualQuery: 'teleport the manipulator to a new frame',
      sector: 'finance',
    });

    expect(result.surpriseScore).toBeGreaterThan(0.35);
    expect(result.plausible).toBe(false);
    expect(result.predictionError).toBeGreaterThan(0.2);
  });

  it('treats under-realized latent transitions as surprising too', async () => {
    const service = new LatentTrajectoryService({
      embedder,
      monitor: monitor as any,
    });

    const result = await service.assessRealization({
      query: 'finance reconciliation workflow',
      actualQuery: 'finance reconciliation workflow',
      sector: 'finance',
      goalQuery: 'robotics goal',
    });

    expect(result.expectedShift).toBeGreaterThan(0.05);
    expect(result.actualShift).toBeLessThan(result.expectedShift / 2);
    expect(result.surpriseScore).toBeGreaterThan(0.35);
    expect(result.plausible).toBe(false);
  });
});
