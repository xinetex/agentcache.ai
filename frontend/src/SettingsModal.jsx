import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export default function SettingsModal({ onClose, user }) {
  const [pqcMode, setPqcMode] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [ollamaEndpoint, setOllamaEndpoint] = useState('');
  const [defaultCluster, setDefaultCluster] = useState('');
  
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.settings) {
      setPqcMode(!!user.settings.pqcMode);
      setOpenaiKey(user.settings.openaiKey || '');
      setAnthropicKey(user.settings.anthropicKey || '');
      setOllamaEndpoint(user.settings.ollamaEndpoint || '');
      setDefaultCluster(user.settings.defaultCluster || '');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: '', type: '' });

    const token = localStorage.getItem('agentcache_token');
    const newSettings = {
      pqcMode, openaiKey, anthropicKey, ollamaEndpoint, defaultCluster
    };

    try {
      const res = await fetch('/api/auth/settings', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ settings: newSettings })
      });
      
      if (res.ok) {
        setMsg({ text: 'Settings saved successfully!', type: 'success' });
        setTimeout(() => setMsg({ text: '', type: '' }), 3000);
      } else {
        setMsg({ text: 'Failed to save settings.', type: 'error' });
      }
    } catch (err) {
      setMsg({ text: 'Network error saving settings.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2>Preferences & Security</h2>
          <button className="icon-btn" onClick={onClose}><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit}>
          {/* PQC Security */}
          <div className="settings-section">
            <h4 className="section-title">Quantum Security</h4>
            <div className="input-group checkbox-group">
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={pqcMode}
                  onChange={(e) => setPqcMode(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>Strict Post-Quantum Mode</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Enforce ML-DSA signatures and ML-KEM encryption.</div>
              </div>
            </div>
          </div>

          {/* BYOK */}
          <div className="settings-section" style={{ marginTop: '24px' }}>
            <h4 className="section-title">Agent AI Providers (BYOK)</h4>
            <div className="input-group">
              <label>OpenAI API Key</label>
              <input type="password" value={openaiKey} onChange={(e)=>setOpenaiKey(e.target.value)} placeholder="sk-..." />
            </div>
            <div className="input-group">
              <label>Anthropic API Key</label>
              <input type="password" value={anthropicKey} onChange={(e)=>setAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
            </div>
            <div className="input-group">
              <label>Local Ollama Endpoint</label>
              <input type="text" value={ollamaEndpoint} onChange={(e)=>setOllamaEndpoint(e.target.value)} placeholder="http://localhost:11434" />
            </div>
          </div>
          
          {msg.text && (
            <p className={msg.type === 'error' ? 'error-text' : 'success-text'} style={{ fontSize: '12px', marginBottom: '16px', color: msg.type === 'error' ? '#ff5555' : '#4caf50' }}>
              {msg.text}
            </p>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Preferences'}
          </button>
        </form>
      </div>
    </div>
  );
}
