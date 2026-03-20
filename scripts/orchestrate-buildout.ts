#!/usr/bin/env npx tsx
import 'dotenv/config';

import { LaneService } from '../src/lib/workflow/LaneService.js';
import {
  BUILDOUT_STEPS,
  getBuildoutStep,
  listBuildoutSteps,
  summarizeBuildoutSteps,
  toMarkdownChecklist,
  toMarkdownSummary,
  type BuildoutLane,
} from '../src/lib/workflow/buildoutPlan.js';

type OutputFormat = 'markdown' | 'json';

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function parseStepIds(): string[] {
  const value = getArg('--steps');
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function buildDispatchPayload(stepId: string) {
  const step = getBuildoutStep(stepId);
  if (!step) return null;

  return {
    stepId: step.id,
    phase: step.phase,
    title: step.title,
    repo: step.repo,
    objective: step.objective,
    deliverable: step.deliverable,
    validation: step.validation,
    dependencies: step.dependencies || [],
  };
}

async function dispatchSteps(stepIds: string[]) {
  const lanes = new LaneService();
  const dispatched: Array<{ stepId: string; lane: BuildoutLane; jobId: string }> = [];

  for (const stepId of stepIds) {
    const step = getBuildoutStep(stepId);
    if (!step) {
      console.warn(`[Orchestrator] Unknown step id: ${stepId}`);
      continue;
    }

    const payload = buildDispatchPayload(stepId);
    if (!payload) continue;

    const jobId = await lanes.dispatch(step.lane, 'buildout_step', payload);
    dispatched.push({ stepId, lane: step.lane, jobId });
  }

  return dispatched;
}

async function main() {
  const format = (getArg('--format') as OutputFormat | undefined) || 'markdown';
  const phase = getArg('--phase');
  const lane = getArg('--lane') as BuildoutLane | undefined;
  const status = getArg('--status') as 'planned' | 'ready' | 'blocked' | 'completed' | undefined;
  const selectedStepIds = parseStepIds();
  const shouldDispatch = hasFlag('--dispatch');
  const showSummary = hasFlag('--summary');

  const steps = selectedStepIds.length
    ? selectedStepIds.map((stepId) => getBuildoutStep(stepId)).filter(Boolean)
    : listBuildoutSteps({ phase, lane, status });

  if (format === 'json') {
    if (showSummary) {
      console.log(JSON.stringify({ summary: summarizeBuildoutSteps(steps), steps }, null, 2));
    } else {
      console.log(JSON.stringify(steps, null, 2));
    }
  } else {
    if (showSummary) {
      console.log(toMarkdownSummary(steps));
      console.log('');
    }
    console.log(toMarkdownChecklist(steps));
  }

  if (!shouldDispatch) {
    console.log('\n[Orchestrator] Dry-run only. Use --dispatch --steps S01,S02 to enqueue work.');
    return;
  }

  if (!selectedStepIds.length) {
    console.error('[Orchestrator] --dispatch requires --steps with explicit ids.');
    process.exitCode = 1;
    return;
  }

  const dispatched = await dispatchSteps(selectedStepIds);
  console.log('\n[Orchestrator] Dispatched jobs:');
  for (const item of dispatched) {
    console.log(`- ${item.stepId} -> lane=${item.lane} jobId=${item.jobId}`);
  }
}

main().catch((error) => {
  console.error('[Orchestrator] Failed:', error);
  process.exitCode = 1;
});
