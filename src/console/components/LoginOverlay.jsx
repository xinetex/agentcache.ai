import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Lock, ArrowRight } from 'lucide-react';
import CyberCard from './CyberCard';

export default function LoginOverlay() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const success = await login(email);
        if (!success) {
            setError('Login failed. Please try again.');
        }
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <div className="w-full max-w-md p-6">
                <CyberCard title="Mission Control Access" icon={Lock} className="border-[var(--hud-accent)] shadow-[0_0_50px_rgba(0,243,255,0.2)]">
                    <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                        <div>
                            <label className="block text-xs font-mono text-[var(--hud-text-dim)] mb-2">OPERATOR ID (EMAIL)</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="alice@acme.com"
                                className="w-full bg-black border border-[var(--hud-border)] rounded p-3 text-white focus:border-[var(--hud-accent)] focus:outline-none transition-colors"
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-red-500 text-xs font-mono border border-red-500/50 bg-red-500/10 p-2 rounded">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-[var(--hud-accent)] text-black font-bold rounded hover:bg-white transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? 'AUTHENTICATING...' : (
                                <>
                                    ENTER CONSOLE <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                        <div className="text-center text-[10px] text-[var(--hud-text-dim)] font-mono">
                            SECURE TERMINAL // AUTHORIZED PERSONNEL ONLY
                        </div>
                    </form>
                </CyberCard>
            </div>
        </div>
    );
}
