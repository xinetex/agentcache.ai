import React, { useState } from 'react';
import { Box, X } from 'lucide-react';

export default function LoginModal({ onLoginSuccess }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const action = isLoginMode ? 'login' : 'signup';
    try {
      const res = await fetch(`/api/auth/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem('agentcache_token', data.token);
        onLoginSuccess(data.user);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error connecting to backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Box size={40} color="var(--accent-amber)" style={{ margin: '0 auto 16px' }} />
          <h2>Welcome to AgentCache</h2>
          <p className="subtitle" style={{ marginBottom: 0 }}>The Folder That Thinks.</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          {error && <div className="error-text">{error}</div>}
          
          <div className="input-group">
            <label>Email Address</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" 
            />
          </div>
          
          <div className="input-group">
            <label>Password</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '16px' }} disabled={loading}>
            {loading ? 'Authenticating...' : (isLoginMode ? 'Login' : 'Sign Up')}
          </button>
          
          <div style={{ textAlign: 'center', fontSize: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            </span>
            <a href="#" style={{ color: 'var(--accent-amber)' }} onClick={(e) => {
              e.preventDefault();
              setIsLoginMode(!isLoginMode);
              setError('');
            }}>
              {isLoginMode ? 'Sign up here' : 'Login here'}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
