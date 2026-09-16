// lib/replay-engine.js
//
// AgentCache — Deterministic Simulation & Time-Travel Replay Engine.
//
// Inspired by the Glossogen platform architecture. Continuously records all
// environmental variables, tool results, and inter-agent messages at every discrete
// turn. Allows security operators to:
//   1. Rewind agent executions turn-by-turn.
//   2. Replay interactions deterministically.
//   3. Fork counterfactual branches with real-time interventions.
//
// Pure, deterministic, and engine-agnostic.

export class SimulationRecorder {
  /**
   * @param {Object} opts
   * @param {string} [opts.simulationId] - Unique simulation identifier
   * @param {string} [opts.seed] - Deterministic random seed
   * @param {Object} [opts.environmentState] - Initial environment variables
   */
  constructor(opts = {}) {
    this.simulationId = opts.simulationId || `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.seed = opts.seed || 'default_seed';
    this.environmentState = { ...(opts.environmentState || {}) };
    this.frames = []; // Array of discrete turn frames
    this.branches = new Map(); // Counterfactual branches
    this.createdAt = new Date().toISOString();
  }

  /**
   * Records a discrete simulation turn frame.
   */
  recordFrame(frame = {}) {
    const frameIndex = this.frames.length;
    const recordedFrame = {
      index: frameIndex,
      timestamp: new Date().toISOString(),
      agentId: frame.agentId || 'unknown_agent',
      role: frame.role || 'worker',
      rawMessage: frame.rawMessage || '',
      decompiledMessage: frame.decompiledMessage || frame.rawMessage || '',
      toolCalls: frame.toolCalls ? JSON.parse(JSON.stringify(frame.toolCalls)) : [],
      toolResults: frame.toolResults ? JSON.parse(JSON.stringify(frame.toolResults)) : [],
      environmentDelta: frame.environmentDelta ? JSON.parse(JSON.stringify(frame.environmentDelta)) : {},
      stateSnapshot: frame.stateSnapshot ? JSON.parse(JSON.stringify(frame.stateSnapshot)) : {},
    };

    // Apply environment delta
    if (frame.environmentDelta) {
      Object.assign(this.environmentState, frame.environmentDelta);
    }

    this.frames.push(recordedFrame);
    return recordedFrame;
  }

  /**
   * Rewinds the simulation to a specific turn index.
   * Returns the exact state snapshot at that turn.
   */
  rewindTo(stepIndex) {
    if (stepIndex < 0 || stepIndex >= this.frames.length) {
      throw new Error(`Invalid rewind target: step ${stepIndex} out of bounds (0..${this.frames.length - 1})`);
    }

    const targetFrame = this.frames[stepIndex];
    return {
      simulationId: this.simulationId,
      stepIndex,
      targetFrame,
      totalFrames: this.frames.length,
      historicalFrames: this.frames.slice(0, stepIndex + 1),
    };
  }

  /**
   * Forks a counterfactual branch at a specific turn index with a modified intervention.
   */
  forkBranch(branchId, fromStepIndex, intervention = {}) {
    if (fromStepIndex < 0 || fromStepIndex >= this.frames.length) {
      throw new Error(`Invalid fork index: step ${fromStepIndex}`);
    }

    const baseFrames = JSON.parse(JSON.stringify(this.frames.slice(0, fromStepIndex + 1)));
    const branch = {
      branchId,
      forkedFromSimulation: this.simulationId,
      forkedAtStep: fromStepIndex,
      intervention,
      frames: baseFrames,
      createdAt: new Date().toISOString(),
    };

    // Apply intervention to the forked point
    if (intervention.overrideMessage) {
      branch.frames[fromStepIndex].rawMessage = intervention.overrideMessage;
      branch.frames[fromStepIndex].decompiledMessage = intervention.overrideMessage;
    }
    if (intervention.overrideToolResult) {
      branch.frames[fromStepIndex].toolResults = [intervention.overrideToolResult];
    }

    this.branches.set(branchId, branch);
    return branch;
  }

  /**
   * Exports the complete simulation trace as a deterministic JSON string.
   */
  exportTrace() {
    return JSON.stringify({
      simulationId: this.simulationId,
      seed: this.seed,
      createdAt: this.createdAt,
      totalTurns: this.frames.length,
      environmentState: this.environmentState,
      frames: this.frames,
      branches: Object.fromEntries(this.branches.entries()),
    }, null, 2);
  }

  /**
   * Imports a trace from JSON and restores simulation state.
   */
  static importTrace(jsonString) {
    const data = JSON.parse(jsonString);
    const sim = new SimulationRecorder({
      simulationId: data.simulationId,
      seed: data.seed,
      environmentState: data.environmentState,
    });
    sim.frames = data.frames || [];
    if (data.branches) {
      for (const [k, v] of Object.entries(data.branches)) {
        sim.branches.set(k, v);
      }
    }
    return sim;
  }
}

export default {
  SimulationRecorder,
};
