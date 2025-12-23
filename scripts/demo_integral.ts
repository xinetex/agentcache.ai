#!/usr/bin/env node
import { Simulator } from '../src/integral/Simulator.js';
import { UniversalOperator } from '../src/integral/UniversalOperator.js';

/**
 * Demo: Integral AGI Architecture
 * 
 * This script demonstrates the "Universal Simulator & Operator" loop.
 * It shows how the Operator:
 * 1. Consults the Simulator for a high-level abstraction.
 * 2. Formulates a plan.
 * 3. Simulates each step BEFORE execution to check for risks.
 * 4. Executes the step.
 */

async function main() {
    console.log('🚀 initializing Integral AGI Demo...\n');

    // 1. Initialize the World Model (Simulator)
    const simulator = new Simulator();
    await simulator.connect();

    // 2. Initialize the Agent (Operator)
    const operator = new UniversalOperator(simulator);

    // 3. Give the Agent a Goal
    // We'll give it a "memory management" goal which triggers a multi-step plan
    const goal = "Deep clean the system memory and optimize context for the next task.";

    await operator.executeGoal(goal);

    console.log('\n✅ Demo Complete. The Operator successfully planned, simulated, and executed the workflow.');
}

main().catch(console.error);
