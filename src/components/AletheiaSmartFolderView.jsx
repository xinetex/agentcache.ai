import React, { useState } from 'react';

/**
 * AletheiaSmartFolderView — First unification slice (5173 ↔ 3000)
 *
 * TEMPORARY / SLICE CODE for the unification phase.
 * This component lives in the main RSVPuix Studio (Vite app at :5173)
 * and talks live to the enhanced legacy API we wired at :3000 (Documents/agentcache-ai/api).
 *
 * It demonstrates the "Enhanced Automator for Grounded Cache" vision:
 * - List smart folders/nodes from the real backend
 * - Simulate file upload that triggers the wired suggestFileActions + GroundedReceipt emission
 * - Show live receipts + agentic dials
 * - Trigger automations (file:added style)
 *
 * This is the smallest viable slice that turns the two separate things the user saw
 * (5173 UI vs 3000 backend) into one coherent experience.
 *
 * Future: This will be replaced / evolved into the full rich folder-grid + sliding panels
 * + n8n canvas using more RSVPuix components (FocusedContent, LiveTile, etc.).
 * The API surface it calls (receipts, tools, upload, trigger) is intended to be permanent.
 */

const API_BASE = 'http://localhost:3000';

export default function AletheiaSmartFolderView() {
  const [nodes, setNodes] = useState([]);
  const [tools, setTools] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [dials, setDials] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const fetchNodes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/nodes`);
      const data = await res.json();
      setNodes(data.nodes || []);
      setMessage(`Loaded ${data.nodes?.length || 0} nodes from live API`);
    } catch (e) {
      setMessage('Failed to reach 3000 API — is the enhanced server running?');
    }
    setLoading(false);
  };

  const fetchTools = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/tools`);
      const data = await res.json();
      setTools(data.tools || []);
      setMessage(`Loaded ${data.tools?.length || 0} connectable tools (with ports)`);
    } catch (e) {
      setMessage('Tools endpoint not available');
    }
  };

  const simulateUpload = async (nodeId) => {
    if (!nodeId) {
      setMessage('Select a folder node first');
      return;
    }
    setLoading(true);
    try {
      const demoFile = {
        name: 'Q3_Earnings_Brief.pdf',
        type: 'application/pdf',
        size: 245760,
        contentHash: 'demo-' + Date.now(),
      };

      const res = await fetch(`${API_BASE}/api/nodes?action=upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          file: demoFile,
          inventions: [], // demo — real ones would come from the engine
        }),
      });

      const data = await res.json();

      if (data.receipt) {
        setReceipts(prev => [data.receipt, ...prev].slice(0, 12));
        setMessage(`Upload complete. Receipt ${data.receipt.id} emitted with ${data.receipt.inventions?.length || 0} inventions.`);
      }

      if (data.suggestedActions) {
        setMessage(m => m + ` | Suggested: ${data.suggestedActions.map(a => a.label).join(', ')}`);
      }

      // Refresh nodes so the new file node appears
      await fetchNodes();
    } catch (e) {
      setMessage('Upload simulation failed — check :3000 server');
    }
    setLoading(false);
  };

  const triggerAutomation = async (nodeId) => {
    if (!nodeId) {
      setMessage('Select a node');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/nodes?action=trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          event: 'file:added',
          tool: 'builtin.summarize',
        }),
      });
      const data = await res.json();

      if (data.receipt) {
        setReceipts(prev => [data.receipt, ...prev].slice(0, 12));
        setMessage(`Automation triggered. New receipt: ${data.receipt.id}`);
      }
    } catch (e) {
      setMessage('Trigger failed');
    }
    setLoading(false);
  };

  const fetchTelemetry = async (nodeIds) => {
    if (!nodeIds || nodeIds.length === 0) return;
    try {
      const res = await fetch(`${API_BASE}/api/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds }),
      });
      const data = await res.json();
      if (data.telemetry) {
        setDials(data.telemetry);
        setMessage('Agentic dials refreshed from live telemetry');
      }
    } catch (e) {
      // silent — dials are nice-to-have in this slice
    }
  };

  const loadEverything = async () => {
    await fetchNodes();
    await fetchTools();
    if (nodes.length > 0) {
      await fetchTelemetry(nodes.map(n => n.id).slice(0, 5));
    }
  };

  return (
    <div style={{ padding: '20px', color: '#e2e8f0', background: '#0f172a', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 700 }}>📁 Aletheia Smart Folder</div>
          <div style={{ fontSize: 12, opacity: 0.6, background: '#1e2937', padding: '4px 10px', borderRadius: 999 }}>
            LIVE — 5173 UI ↔ 3000 Grounded API
          </div>
        </div>

        <div style={{ marginBottom: 16, fontSize: 14, opacity: 0.85 }}>
          This is the first unification slice. The Studio (5173) now talks to the wired Aletheia backend (3000) that emits real GroundedReceipts.
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <button onClick={loadEverything} disabled={loading} style={btnStyle}>
            Load Live Data from 3000
          </button>
          <button onClick={() => fetchNodes()} disabled={loading} style={btnStyle}>
            Refresh Folders
          </button>
          <button onClick={() => fetchTools()} disabled={loading} style={btnStyle}>
            Load Tools Palette
          </button>
        </div>

        {message && (
          <div style={{ background: '#1e2937', padding: 12, borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
            {message}
          </div>
        )}

        {/* Folders / Nodes */}
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ marginBottom: 12 }}>Smart Folders (live from 3000)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {nodes.length === 0 && <div style={{ opacity: 0.6 }}>No nodes loaded yet — click "Load Live Data"</div>}
            {nodes.map(node => (
              <div
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                style={{
                  background: selectedNodeId === node.id ? '#1e40af' : '#1e2937',
                  border: '1px solid #334155',
                  borderRadius: 12,
                  padding: 14,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600 }}>{node.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                  {node.node_type} • {node.status}
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button onClick={(e) => { e.stopPropagation(); simulateUpload(node.id); }} style={smallBtn}>
                    Simulate Upload
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); triggerAutomation(node.id); }} style={smallBtn}>
                    Trigger Automation
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tools Palette */}
        {tools.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 12 }}>Tools Palette (ComfyUI-style ports — live)</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {tools.slice(0, 6).map(tool => (
                <div key={tool.id} style={{ background: '#1e2937', border: '1px solid #475569', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                  <div style={{ fontWeight: 600 }}>{tool.name}</div>
                  <div style={{ opacity: 0.6 }}>{tool.type} • {tool.category}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Receipts + Dials */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div>
            <h3 style={{ marginBottom: 12 }}>Recent GroundedReceipts (live)</h3>
            {receipts.length === 0 && <div style={{ opacity: 0.6 }}>No receipts yet — upload or trigger above</div>}
            {receipts.map(r => (
              <div key={r.id} style={{ background: '#1e2937', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 13 }}>
                <div><strong>{r.id}</strong></div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  {r.created_at} • drift {r.summary?.drift_score} • inventions {r.summary?.invention_count}
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{ marginBottom: 12 }}>Agentic Dials (live from telemetry)</h3>
            {Object.keys(dials).length === 0 && <div style={{ opacity: 0.6 }}>Load data to see dials</div>}
            {Object.entries(dials).slice(0, 3).map(([nodeId, dial]) => (
              <div key={nodeId} style={{ background: '#1e2937', borderRadius: 8, padding: 12, marginBottom: 8, fontSize: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{nodeId.slice(0, 8)}…</div>
                <div>Heartbeat: {dial.dials?.heartbeat_age_sec}s ago • Souls: {dial.dials?.souls} • Drift: {dial.dials?.drift_score}</div>
                <div>Skills: {(dial.dials?.skills || []).join(', ')}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 40, fontSize: 11, opacity: 0.5 }}>
          This is the unification slice. Real receipts, real tools with ports, real dials — all coming from the api/ we just wired.
          The future full experience will feel like Automator inside a grounded, receipt-bearing smart folder.
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  background: '#3b82f6',
  color: 'white',
  border: 'none',
  padding: '10px 18px',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
};

const smallBtn = {
  background: '#334155',
  color: '#e2e8f0',
  border: 'none',
  padding: '6px 10px',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};
