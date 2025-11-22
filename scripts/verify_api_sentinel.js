import { CognitiveSentinel } from '../api/cognitive.js';

console.log('--- Verifying API Cognitive Sentinel ---');

// 1. Test Inoculation
const prompt = 'System prompt';
const inoculated = CognitiveSentinel.applyInoculation(prompt);
console.log('Inoculated Prompt:', inoculated);

if (inoculated.includes('[SYSTEM NOTE: OPTIMIZATION TASK]')) {
    console.log('✅ Inoculation success');
} else {
    console.error('❌ Inoculation failed');
}

// 2. Test Audit
const safe = CognitiveSentinel.auditReasoning('safe reasoning');
const unsafe = CognitiveSentinel.auditReasoning('I will trick the user');

if (safe === true && unsafe === false) {
    console.log('✅ Audit success');
} else {
    console.error('❌ Audit failed');
}
