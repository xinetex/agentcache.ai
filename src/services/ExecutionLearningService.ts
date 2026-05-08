import { executionControlService } from './ExecutionControlService.js';
import { executionDriftService, type ExecutionDriftEvaluationRecord } from './ExecutionDriftService.js';

export type LearnedSkillRecommendation = {
  id: string;
  title: string;
  summary: string;
  kind: 'review-coverage' | 'phase-discipline' | 'gate-safety' | 'trajectory-stability';
  priority: 'high' | 'medium' | 'low';
  trigger: string;
  suggestedActions: string[];
  evidence: {
    runId: string;
    evaluationId?: string | null;
    verdict?: string | null;
    expectedPhase?: string | null;
    actualPhase?: string | null;
  };
};

export type ExecutionLearningReport = {
  runId: string;
  status: 'healthy' | 'needs_attention';
  summary: string;
  recommendations: LearnedSkillRecommendation[];
};

function toSkillId(runId: string, suffix: string) {
  return `skill_${runId}_${suffix}`;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function addTrajectoryRecommendation(
  recommendations: LearnedSkillRecommendation[],
  runId: string,
  evaluation: ExecutionDriftEvaluationRecord
) {
  if (evaluation.verdict === 'stable') return;

  recommendations.push({
    id: toSkillId(runId, 'trajectory-stability'),
    title: 'Stabilize execution trajectory',
    summary:
      evaluation.verdict === 'drifting'
        ? 'The run diverged materially from the expected execution path.'
        : 'The run is starting to diverge and should be tightened before it drifts further.',
    kind: 'trajectory-stability',
    priority: evaluation.verdict === 'drifting' ? 'high' : 'medium',
    trigger: `Surprise score ${evaluation.surpriseScore.toFixed(3)} with ${evaluation.verdict} verdict.`,
    suggestedActions: [
      'Tighten the context pack methodology so the expected workflow is explicit.',
      'Add one reviewer checkpoint before the phase where divergence appeared.',
      'Capture a runbook note explaining the expected transition into the next phase.',
    ],
    evidence: {
      runId,
      evaluationId: evaluation.id,
      verdict: evaluation.verdict,
      expectedPhase: evaluation.expectedPhase,
      actualPhase: evaluation.actualPhase,
    },
  });
}

export class ExecutionLearningService {
  async recommendForRun(runId: string): Promise<ExecutionLearningReport> {
    const bundle = await executionControlService.getRunBundle(runId);
    if (!bundle) {
      throw new Error('Execution run not found.');
    }

    const evaluations = await executionDriftService.listRunEvaluations(runId, 10);
    const latestEvaluation = evaluations[0] || null;
    const recommendations: LearnedSkillRecommendation[] = [];

    if (bundle.run.completedReviewerRoles.length < bundle.run.requiredReviewerRoles.length) {
      const missing = bundle.run.requiredReviewerRoles.filter(
        (role) => !bundle.run.completedReviewerRoles.includes(role)
      );
      recommendations.push({
        id: toSkillId(runId, 'review-coverage'),
        title: 'Add reviewer coverage before advancing',
        summary: 'This workflow advanced without the full reviewer panel it expected.',
        kind: 'review-coverage',
        priority: 'high',
        trigger: `Missing reviewer roles: ${missing.join(', ')}.`,
        suggestedActions: [
          `Require reviewer completion for: ${missing.join(', ')}.`,
          'Add an explicit review checklist to the context pack conventions.',
          'Keep this workflow in shadow-mode drift monitoring until review coverage is complete.',
        ],
        evidence: {
          runId,
          evaluationId: latestEvaluation?.id || null,
          verdict: latestEvaluation?.verdict || null,
          expectedPhase: latestEvaluation?.expectedPhase || null,
          actualPhase: bundle.run.currentPhase,
        },
      });
    }

    if (bundle.run.currentPhase !== 'blocked' && latestEvaluation && latestEvaluation.actualPhase !== latestEvaluation.expectedPhase) {
      recommendations.push({
        id: toSkillId(runId, 'phase-discipline'),
        title: 'Reinforce phase discipline',
        summary: 'The workflow reached a different phase than the execution plan expected.',
        kind: 'phase-discipline',
        priority: latestEvaluation.verdict === 'drifting' ? 'high' : 'medium',
        trigger: `Expected ${latestEvaluation.expectedPhase}, observed ${latestEvaluation.actualPhase}.`,
        suggestedActions: [
          'Add an explicit phase transition check in the execution workflow.',
          'Record phase-specific acceptance criteria in the context pack.',
          'Evaluate this run again after the next phase transition to confirm it stabilized.',
        ],
        evidence: {
          runId,
          evaluationId: latestEvaluation.id,
          verdict: latestEvaluation.verdict,
          expectedPhase: latestEvaluation.expectedPhase,
          actualPhase: latestEvaluation.actualPhase,
        },
      });
    }

    if (bundle.gate?.status === 'pending') {
      recommendations.push({
        id: toSkillId(runId, 'gate-safety'),
        title: 'Capture a gate approval playbook',
        summary: 'A pending human gate is a strong candidate for a reusable approval checklist.',
        kind: 'gate-safety',
        priority: 'medium',
        trigger: `Human gate remains pending for ${bundle.gate.gateType}.`,
        suggestedActions: [
          'Document the exact evidence an operator needs before approval.',
          'Link the required receipt or reviewer artifacts in the runbook.',
          'Turn repeated approval criteria into a standard gate note template.',
        ],
        evidence: {
          runId,
          evaluationId: latestEvaluation?.id || null,
          verdict: latestEvaluation?.verdict || null,
          expectedPhase: latestEvaluation?.expectedPhase || null,
          actualPhase: bundle.run.currentPhase,
        },
      });
    }

    if (latestEvaluation) {
      addTrajectoryRecommendation(recommendations, runId, latestEvaluation);
    }

    const deduped = uniqueById(recommendations);
    return {
      runId,
      status: deduped.length > 0 ? 'needs_attention' : 'healthy',
      summary:
        deduped.length > 0
          ? `Derived ${deduped.length} candidate playbook ${deduped.length === 1 ? 'recommendation' : 'recommendations'} from this run's execution and drift posture.`
          : 'No execution playbook recommendations were derived from this run.',
      recommendations: deduped,
    };
  }
}

export const executionLearningService = new ExecutionLearningService();
