#!/usr/bin/env npx tsx
import 'dotenv/config';

import { LaneService } from '../src/lib/workflow/LaneService.js';
import { TranscriptService } from '../src/lib/workflow/TranscriptService.js';
import {
  BUILDOUT_STEPS,
  getBuildoutStep,
  listBuildoutSteps,
  summarizeBuildoutSteps,
  toMarkdownChecklist,
  toMarkdownSummary,
  type BuildoutLane,
} from '../src/lib/workflow/buildoutPlan.js';
import { AGENT_MANIFEST } from '../src/lib/workflow/agentManifest.js';
import fs from 'node:fs';
import path from 'node:path';

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

function generateWorkPacket(stepId: string) {
  const step = getBuildoutStep(stepId);
  if (!step) return null;

  const profile = AGENT_MANIFEST[step.lane];
  const packet = {
    stepId: step.id,
    lane: step.lane,
    role: profile.role,
    objective: step.objective,
    deliverable: step.deliverable,
    instructions: profile.instructions,
    capabilities: profile.capabilities,
    repo: step.repo,
    context: {
        timestamp: new Date().toISOString(),
        buildoutUrl: 'https://agentcache.ai/docs/buildout'
    }
  };

  const packetDir = path.join(process.cwd(), 'artifacts', 'packets');
  if (!fs.existsSync(packetDir)) {
      fs.mkdirSync(packetDir, { recursive: true });
  }

  const packetPath = path.join(packetDir, `${stepId}.json`);
  fs.writeFileSync(packetPath, JSON.stringify(packet, null, 2));
  
  return packet;
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

async function dispatchSteps(stepIds: string[], transcript?: TranscriptService) {
  const lanes = new LaneService();
  const dispatched: Array<{ stepId: string; lane: BuildoutLane; jobId: string }> = [];

  for (const stepId of stepIds) {
    const step = getBuildoutStep(stepId);
    if (!step) {
      const msg = `Unknown step id: ${stepId}`;
      console.warn(`[Orchestrator] ${msg}`);
      transcript?.log(msg, 'warn', stepId);
      continue;
    }

    // S49 Dependency Guardrail
    const dependencies = step.dependencies || [];
    const missing = dependencies.filter(depId => {
        const dep = getBuildoutStep(depId);
        return !dep || dep.status !== 'completed';
    });

    if (missing.length > 0) {
        const msg = `Blocked by missing dependencies: ${missing.join(', ')}`;
        console.warn(`[Orchestrator] ${stepId}: ${msg}`);
        transcript?.log(msg, 'error', stepId);
        continue;
    }

    const payload = buildDispatchPayload(stepId);
    if (!payload) continue;

    const jobId = await lanes.dispatch(step.lane, 'buildout_step', payload);
    
    // S50 Work Packet Generation
    const packet = generateWorkPacket(stepId);
    console.log(`  Work Packet: artifacts/packets/${stepId}.json`);
    
    transcript?.log(`Dispatched to lane ${step.lane}`, 'success', stepId, { jobId, packetPath: `artifacts/packets/${stepId}.json` });
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
  const shouldComplete = hasFlag('--complete');
  const showSummary = hasFlag('--summary');

  const transcript = new TranscriptService();
  transcript.log('Orchestrator run started', 'info');

  try {
    const steps = selectedStepIds.length
      ? selectedStepIds.map((stepId) => getBuildoutStep(stepId)).filter((s): s is any => !!s)
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

    if (shouldDispatch) {
      if (!selectedStepIds.length) {
        console.error('[Orchestrator] --dispatch requires --steps with explicit ids.');
        process.exitCode = 1;
        return;
      }

      const dispatched = await dispatchSteps(selectedStepIds, transcript);
      console.log('\n[Orchestrator] Dispatched jobs:');
      for (const item of dispatched) {
        console.log(`- ${item.stepId} -> lane=${item.lane} jobId=${item.jobId}`);
      }
      return;
    }

    if (shouldComplete) {
      console.log(`\n[Orchestrator] Marking steps as completed: ${selectedStepIds.join(', ')}`);
      console.log('[Orchestrator] Note: Manual update of buildoutPlan.ts required for persistence in this version.');
      
      for (const stepId of selectedStepIds) {
          transcript.log('Step marked as completed', 'success', stepId);
      }
      return;
    }

    if (!shouldDispatch && !shouldComplete) {
      console.log('\n[Orchestrator] Dry-run only. Use --dispatch or --complete with --steps to affect state.');
    }
  } catch (error) {
    transcript.log(`Orchestrator run failed: ${error}`, 'error');
    throw error;
  } finally {
    const transcriptPath = await transcript.finalize('operator-1', process.env.TRUSTOPS_SIGNING_SECRET);
    console.log(`[Orchestrator] Transcript saved to: ${transcriptPath}`);
  }
}

main().catch((error) => {
  console.error('[Orchestrator] Failed:', error);
  process.exitCode = 1;
});
