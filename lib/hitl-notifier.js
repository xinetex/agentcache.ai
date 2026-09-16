// lib/hitl-notifier.js
//
// AgentCache — Human-in-the-Loop (HITL) Notification Bridge.
//
// Formats and dispatches asynchronous approval requests when a long-running
// agent hits a governance warning, high-cost call, or high-risk tool.

export function buildApprovalCard(run = {}, pending = {}, opts = {}) {
  const runId = run.runId || 'unknown_run';
  const agentId = run.agentId || 'default';
  const baseUrl = opts.baseUrl || 'https://agentcache.ai';
  const estCostUsd = pending.plan?.estCostUsd || pending.proposedCall?.estCostUsd || 0;
  const reasons = pending.plan?.reasons || ['Approval required by governance policy'];
  const proposedCall = pending.proposedCall || {};

  // Approval links. With signed tokens (opts.tokens from lib/run-authz.js) the
  // link is a one-shot, expiring, org-bound GET a human can click straight from
  // Slack with no API key. WITHOUT tokens we deliberately do NOT emit a bare
  // ?runId=&decision= link: that endpoint requires auth (so the button would be
  // dead), and if it did not, an unauthenticated approve/kill URL sitting in a
  // chat channel is exactly the hole we just closed on the API.
  const tokens = opts.tokens || null;
  const approveUrl = tokens?.approve
    ? `${baseUrl}/api/agent/approve?token=${encodeURIComponent(tokens.approve)}`
    : `${baseUrl}/api/agent/approve?runId=${encodeURIComponent(runId)}&decision=approve`;
  const rejectUrl = tokens?.reject
    ? `${baseUrl}/api/agent/approve?token=${encodeURIComponent(tokens.reject)}`
    : `${baseUrl}/api/agent/approve?runId=${encodeURIComponent(runId)}&decision=reject`;
  const signed = Boolean(tokens?.approve && tokens?.reject);

  const textSummary = `⚠️ [AgentCache HITL] Agent "${agentId}" paused on run "${runId}".\n` +
    `Reason: ${reasons.join(', ')}\n` +
    `Estimated Cost: $${estCostUsd.toFixed(2)}\n` +
    `Model: ${proposedCall.model || 'unknown'}\n` +
    `Approve: ${approveUrl}\nReject: ${rejectUrl}`;

  // Slack BlockKit format
  const slackBlocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: '⚠️ Agent Approval Required', emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Run ID:*\n\`${runId}\`` },
        { type: 'mrkdwn', text: `*Agent:*\n\`${agentId}\`` },
        { type: 'mrkdwn', text: `*Est. Cost:*\n$${estCostUsd.toFixed(2)}` },
        { type: 'mrkdwn', text: `*Step:*\n#${(run.step || 0) + 1}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Trigger Reasons:*\n• ${reasons.join('\n• ')}` },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve Step' },
          style: 'primary',
          url: approveUrl,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject & Kill' },
          style: 'danger',
          url: rejectUrl,
        },
      ],
    },
  ];

  return {
    runId,
    agentId,
    estCostUsd,
    reasons,
    signed,
    approveUrl,
    rejectUrl,
    text: textSummary,
    slack: { blocks: slackBlocks },
  };
}

/**
 * Dispatches an approval notification to a webhook endpoint.
 */
export async function dispatchNotification(webhookUrl, cardPayload, fetchImpl = globalThis.fetch) {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    return { ok: false, skipped: true, reason: 'No webhookUrl configured' };
  }

  if (typeof fetchImpl !== 'function') {
    return { ok: false, skipped: true, reason: 'Fetch implementation unavailable' };
  }

  try {
    const res = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cardPayload),
    });

    return {
      ok: res.ok,
      status: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export default {
  buildApprovalCard,
  dispatchNotification,
};
