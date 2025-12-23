import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './AuthModal.css';

const AuthModal = ({ onClose, onSuccess, initialMode = 'login', message = null }) => {
    const [mode, setMode] = useState(initialMode); // 'login' or 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Registration fields
    const [organizationName, setOrganizationName] = useState('');
    const [sector, setSector] = useState('general');
    const [businessDescription, setBusinessDescription] = useState('');

    const { login, register, loading, error: authError } = useAuth();
    const [localError, setLocalError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError(null);

        let result;

        if (mode === 'login') {
            result = await login(email, password);
        } else {
            if (!email || !password || !organizationName) {
                setLocalError('Please fill in all required fields');
                return;
            }
            result = await register(email, password, organizationName, sector, businessDescription);
        }

        if (result.success) {
            if (onSuccess) {
                onSuccess(result.user);
            } else {
                onClose();
            }
        }
    };

    const toggleMode = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        setLocalError(null);
    };

    return (
        <div className="auth-overlay" onClick={onClose}>
            <div className="auth-modal" onClick={e => e.stopPropagation()}>
                <button className="auth-close-btn" onClick={onClose}>&times;</button>

                <div className="auth-header">
                    <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                    <p>{message || (mode === 'login' ? 'Log in to access your pipelines' : 'Sign up to save your work')}</p>
                </div>

                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => setMode('login')}
                    >
                        Log In
                    </button>
                    <button
                        className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                        onClick={() => setMode('register')}
                    >
                        Sign Up
                    </button>
                </div>

                {(localError || authError) && (
                    <div className="auth-error">
                        {localError || authError}
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {mode === 'register' && (
                        <>
                            <div className="form-group">
                                <label>Organization Name</label>
                                <input
                                    type="text"
                                    value={organizationName}
                                    onChange={(e) => setOrganizationName(e.target.value)}
                                    placeholder="Acme Corp"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Sector</label>
                                <select
                                    value={sector}
                                    onChange={(e) => setSector(e.target.value)}
                                    style={{
                                        background: '#334155',
                                        border: '1px solid #475569',
                                        borderRadius: '6px',
                                        padding: '10px 12px',
                                        color: '#fff',
                                        fontSize: '15px',
                                        outline: 'none'
                                    }}
                                >
                                    <option value="general">General</option>
                                    <option value="technology">Technology</option>
                                    <option value="finance">Finance</option>
                                    <option value="healthcare">Healthcare</option>
                                    <option value="retail">Retail</option>
                                    <option value="manufacturing">Manufacturing</option>
                                    <option value="education">Education</option>
                                </select>
                            </div>
                        </>
                    )}

                    <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? 'Processing...' : (mode === 'login' ? 'Log In' : 'Create Account')}
                    </button>
                </form>

                <div className="toggle-auth-mode">
                    {mode === 'login' ? (
                        <>Don't have an account? <button onClick={toggleMode}>Sign up</button></>
                    ) : (
                        <>Already have an account? <button onClick={toggleMode}>Log in</button></>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
