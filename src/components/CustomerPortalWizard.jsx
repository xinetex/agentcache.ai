import React, { useState } from 'react';
import './CustomerPortalWizard.css';

function CustomerPortalWizard({ onClose, onComplete }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form State
    const [orgProfile, setOrgProfile] = useState({
        name: '',
        sector: 'general',
        contact_email: '',
        contact_name: ''
    });
    const [scale, setScale] = useState('single_tenant');
    const [planTier, setPlanTier] = useState('starter');
    const [namespaceStrategy, setNamespaceStrategy] = useState('auto');
    const [customNamespaces, setCustomNamespaces] = useState([]);

    const handleNext = async () => {
        if (step === 1) {
            if (!orgProfile.name.trim()) {
                setError('Please enter your Organization Name');
                return;
            }
            if (!orgProfile.contact_email.trim() || !orgProfile.contact_email.includes('@')) {
                setError('Please enter a valid contact email');
                return;
            }
            setError(null);
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            setStep(4);
            await provisionOrganization();
        }
    };

    const provisionOrganization = async () => {
        setLoading(true);
        setError(null);

        try {
            const authToken = localStorage.getItem('agentcache_token');
            if (!authToken) {
                throw new Error('Not authenticated');
            }

            const response = await fetch('/api/onboarding/complete', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    sector: orgProfile.sector,
                    useCase: `${orgProfile.name} - ${orgProfile.sector} organization`,
                    priority: 'balanced', // Can be derived from planTier
                    wizardPrompt: `Setup for ${orgProfile.name} in ${orgProfile.sector} sector`
                })
            });

            const data = await response.json();

            if (data.success) {
                setLoading(false);
                if (onComplete) {
                    onComplete({
                        organization: data.organization,
                        pipeline: data.pipeline,
                        apiKey: data.apiKey,
                        projectedSavings: data.projectedSavings,
                        dashboard_url: `/studio-v2.html`
                    });
                }
            } else {
                throw new Error(data.error || 'Failed to complete onboarding');
            }
        } catch (err) {
            setError(err.message);
            setLoading(false);
            setStep(3);
        }
    };

    const sectors = [
        { id: 'filestorage', name: 'File Storage & CDN', icon: '💾', description: 'Content delivery, file management, Seagate Lyve integration' },
        { id: 'healthcare', name: 'Healthcare & Medical', icon: '🏥', description: 'HIPAA-compliant EHR, patient data, clinical workflows' },
        { id: 'finance', name: 'Financial Services', icon: '📈', description: 'Trading, market data, PCI-DSS compliance' },
        { id: 'legal', name: 'Legal & Compliance', icon: '⚖️', description: 'Document review, privilege protection, matter tracking' },
        { id: 'general', name: 'General Purpose', icon: '⚡', description: 'Standard caching for any application' }
    ];

    return (
        <div className="wizard-overlay-customer" onClick={onClose}>
            <div className="wizard-modal-customer" onClick={(e) => e.stopPropagation()}>
                {/* Top Bar */}
                <div className="wizard-header-customer">
                    <div className="wizard-brand">
                        <div className="wizard-icon-customer">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>
                        <div>
                            <h2>Customer Onboarding</h2>
                            <p className="wizard-subtitle">Set up your AgentCache organization in minutes</p>
                        </div>
                    </div>

                    <div className="wizard-controls">
                        <div className="step-indicator">
                            <span className="step-number">{step}</span>
                            <span className="step-label">
                                {step === 1 ? 'Profile' : step === 2 ? 'Use Case' : step === 3 ? 'Namespaces' : 'Provision'}
                            </span>
                            <span className="step-total">/ 4</span>
                        </div>
                        <button className="close-btn-customer" onClick={onClose}>
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="wizard-body-customer">
                    {step === 1 && (
                        <div className="wizard-step-customer">
                            <div className="step-header">
                                <div>
                                    <h3>Organization Profile</h3>
                                    <p>Tell us about your organization to customize your experience.</p>
                                </div>
                            </div>

                            <div className="customer-input-group">
                                <label>Organization Name <span className="required">*</span></label>
                                <input
                                    type="text"
                                    className="customer-input"
                                    placeholder="e.g. JettyThunder, Acme Corp"
                                    value={orgProfile.name}
                                    onChange={(e) => setOrgProfile({ ...orgProfile, name: e.target.value })}
                                />
                            </div>

                            <div className="customer-input-group">
                                <label>Contact Name <span className="required">*</span></label>
                                <input
                                    type="text"
                                    className="customer-input"
                                    placeholder="Your full name"
                                    value={orgProfile.contact_name}
                                    onChange={(e) => setOrgProfile({ ...orgProfile, contact_name: e.target.value })}
                                />
                            </div>

                            <div className="customer-input-group">
                                <label>Contact Email <span className="required">*</span></label>
                                <input
                                    type="email"
                                    className="customer-input"
                                    placeholder="you@company.com"
                                    value={orgProfile.contact_email}
                                    onChange={(e) => setOrgProfile({ ...orgProfile, contact_email: e.target.value })}
                                />
                            </div>

                            {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="wizard-step-customer">
                            <div className="step-header">
                                <h3>Industry & Scale</h3>
                                <p>Select your sector and deployment scale for optimized configuration.</p>
                            </div>

                            <div className="section-label">Industry Sector</div>
                            <div className="customer-grid">
                                {sectors.map(sector => (
                                    <button
                                        key={sector.id}
                                        className={`customer-card ${orgProfile.sector === sector.id ? 'selected' : ''}`}
                                        onClick={() => setOrgProfile({ ...orgProfile, sector: sector.id })}
                                    >
                                        <div className="card-icon">{sector.icon}</div>
                                        <div className="card-content">
                                            <h4>{sector.name}</h4>
                                            <p>{sector.description}</p>
                                        </div>
                                        {orgProfile.sector === sector.id && (
                                            <div className="selection-indicator">
                                                <div className="selection-dot"></div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="section-label mt-6">Deployment Scale</div>
                            <div className="scale-options">
                                <button
                                    className={`scale-option ${scale === 'single_tenant' ? 'selected' : ''}`}
                                    onClick={() => setScale('single_tenant')}
                                >
                                    <div className="scale-header">
                                        <span className="scale-icon">🏢</span>
                                        <h4>Single Tenant</h4>
                                    </div>
                                    <p>One organization, direct access to all resources</p>
                                </button>

                                <button
                                    className={`scale-option ${scale === 'multi_customer' ? 'selected' : ''}`}
                                    onClick={() => setScale('multi_customer')}
                                >
                                    <div className="scale-header">
                                        <span className="scale-icon">🏭</span>
                                        <h4>Multi-Customer</h4>
                                    </div>
                                    <p>Serve multiple customers with tenant isolation</p>
                                </button>
                            </div>

                            <div className="section-label mt-6">Plan Tier</div>
                            <div className="plan-tier-options">
                                <button
                                    className={`plan-tier-card ${planTier === 'starter' ? 'selected' : ''}`}
                                    onClick={() => setPlanTier('starter')}
                                >
                                    <h4>Starter</h4>
                                    <p className="plan-price">$49/mo</p>
                                    <ul className="plan-features">
                                        <li>5 namespaces</li>
                                        <li>3 API keys</li>
                                        <li>100GB cache</li>
                                    </ul>
                                </button>

                                <button
                                    className={`plan-tier-card ${planTier === 'professional' ? 'selected' : ''}`}
                                    onClick={() => setPlanTier('professional')}
                                >
                                    <div className="recommended-badge-small">Recommended</div>
                                    <h4>Professional</h4>
                                    <p className="plan-price">$199/mo</p>
                                    <ul className="plan-features">
                                        <li>20 namespaces</li>
                                        <li>10 API keys</li>
                                        <li>1TB cache</li>
                                    </ul>
                                </button>

                                <button
                                    className={`plan-tier-card ${planTier === 'enterprise' ? 'selected' : ''}`}
                                    onClick={() => setPlanTier('enterprise')}
                                >
                                    <h4>Enterprise</h4>
                                    <p className="plan-price">Custom</p>
                                    <ul className="plan-features">
                                        <li>100+ namespaces</li>
                                        <li>50+ API keys</li>
                                        <li>Unlimited cache</li>
                                    </ul>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="wizard-step-customer">
                            <div className="step-header">
                                <h3>Namespace Strategy</h3>
                                <p>Choose how to organize your cache namespaces.</p>
                            </div>

                            <div className="namespace-strategy-options">
                                <button
                                    className={`namespace-strategy-card ${namespaceStrategy === 'auto' ? 'selected' : ''}`}
                                    onClick={() => setNamespaceStrategy('auto')}
                                >
                                    <div className="strategy-icon">🤖</div>
                                    <div className="strategy-content">
                                        <h4>AI-Recommended (Default)</h4>
                                        <p>We'll create optimal namespaces based on your sector and scale</p>
                                        <div className="strategy-preview">
                                            {orgProfile.sector === 'filestorage' && (
                                                <span className="badge-list">storage • cdn • metadata</span>
                                            )}
                                            {orgProfile.sector === 'healthcare' && (
                                                <span className="badge-list">patients • clinical • admin</span>
                                            )}
                                            {orgProfile.sector === 'finance' && (
                                                <span className="badge-list">trading • research • compliance</span>
                                            )}
                                            {orgProfile.sector === 'legal' && (
                                                <span className="badge-list">matters • research • billing</span>
                                            )}
                                            {orgProfile.sector === 'general' && (
                                                <span className="badge-list">production • staging</span>
                                            )}
                                        </div>
                                    </div>
                                    {namespaceStrategy === 'auto' && (
                                        <div className="selection-indicator">
                                            <div className="selection-dot"></div>
                                        </div>
                                    )}
                                </button>

                                <button
                                    className={`namespace-strategy-card ${namespaceStrategy === 'custom' ? 'selected' : ''}`}
                                    onClick={() => setNamespaceStrategy('custom')}
                                >
                                    <div className="strategy-icon">⚙️</div>
                                    <div className="strategy-content">
                                        <h4>Custom Namespaces</h4>
                                        <p>Define your own namespace structure (advanced)</p>
                                    </div>
                                    {namespaceStrategy === 'custom' && (
                                        <div className="selection-indicator">
                                            <div className="selection-dot"></div>
                                        </div>
                                    )}
                                </button>
                            </div>

                            {namespaceStrategy === 'custom' && (
                                <div className="custom-namespace-input mt-4">
                                    <label>Custom Namespaces (comma-separated)</label>
                                    <input
                                        type="text"
                                        className="customer-input"
                                        placeholder="e.g. prod, staging, dev, customer-a, customer-b"
                                        onChange={(e) => {
                                            const namespaces = e.target.value.split(',').map(ns => ns.trim()).filter(Boolean);
                                            setCustomNamespaces(namespaces);
                                        }}
                                    />
                                    <p className="text-xs text-slate-500 mt-2">
                                        Max {planTier === 'starter' ? '5' : planTier === 'professional' ? '20' : '100'} namespaces on your plan
                                    </p>
                                </div>
                            )}

                            {error && <div className="text-red-400 text-sm mt-4">{error}</div>}
                        </div>
                    )}

                    {step === 4 && (
                        <div className="wizard-step-customer">
                            {loading ? (
                                <div className="loading-state-customer">
                                    <div className="spinner-customer"></div>
                                    <p>Provisioning Your Organization...</p>
                                    <span className="loading-subtitle-customer">
                                        Creating namespaces, generating API keys, configuring sector nodes
                                    </span>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-500/20 mb-6">
                                        <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                        </svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Welcome to AgentCache! 🎉</h3>
                                    <p className="text-slate-400 mb-8">Your organization is ready. Start caching in seconds.</p>

                                    <div className="bg-slate-900/50 p-6 rounded-xl text-left max-w-md mx-auto border border-slate-800">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-slate-500">Organization</span>
                                            <span className="text-white font-medium">{orgProfile.name}</span>
                                        </div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-slate-500">Sector</span>
                                            <span className="text-sky-400 font-mono">{orgProfile.sector}</span>
                                        </div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-slate-500">Plan</span>
                                            <span className="text-emerald-400 capitalize">{planTier}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Namespaces</span>
                                            <span className="text-emerald-400">Ready</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="wizard-footer-customer">
                    <div className="footer-hint">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>Your data is encrypted and isolated in your own namespace.</span>
                    </div>
                    <div className="footer-actions">
                        {step > 1 && step < 4 && (
                            <button className="btn-customer btn-secondary-customer" onClick={() => setStep(step - 1)}>
                                Back
                            </button>
                        )}
                        {step < 4 && (
                            <button className="btn-customer btn-primary-customer" onClick={handleNext}>
                                <span>{step === 3 ? 'Create Organization' : 'Next'}</span>
                            </button>
                        )}
                        {step === 4 && !loading && (
                            <button className="btn-customer btn-primary-customer" onClick={onClose}>
                                Go to Dashboard
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CustomerPortalWizard;
