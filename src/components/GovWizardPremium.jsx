import React, { useState, useEffect } from 'react';
import './GovWizardPremium.css';

function GovWizardPremium({ onClose, onComplete }) {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form State
    const [agencyProfile, setAgencyProfile] = useState({
        name: '',
        mission: 'Scientific Discovery (Genesis Mission)'
    });
    const [securityLevel, setSecurityLevel] = useState('IL4');
    const [compliance, setCompliance] = useState({
        fedramp: true,
        hipaa: false,
        neutrality: true
    });

    const handleNext = async () => {
        if (step === 1) {
            if (!agencyProfile.name.trim()) {
                setError('Please enter your Agency Name');
                return;
            }
            setError(null);
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            setStep(4);
            await provisionWorkspace();
        }
    };

    const provisionWorkspace = async () => {
        setLoading(true);
        setError(null);

        // Simulate provisioning delay
        setTimeout(() => {
            setLoading(false);
            if (onComplete) {
                onComplete({
                    agency: agencyProfile,
                    security: securityLevel,
                    compliance: compliance
                });
            }
        }, 2000);
    };

    const toggleCompliance = (key) => {
        if (key === 'fedramp') return; // Mandatory
        setCompliance(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="wizard-overlay-gov" onClick={onClose}>
            <div className="wizard-modal-gov" onClick={(e) => e.stopPropagation()}>
                {/* Top Bar */}
                <div className="wizard-header-gov">
                    <div className="wizard-brand">
                        <div className="wizard-icon-gov">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div>
                            <h2>Government Workspace</h2>
                            <p className="wizard-subtitle">Secure Onboarding & Provisioning</p>
                        </div>
                    </div>

                    <div className="wizard-controls">
                        <div className="step-indicator">
                            <span className="step-number">{step}</span>
                            <span className="step-label">
                                {step === 1 ? 'Profile' : step === 2 ? 'Security' : step === 3 ? 'Compliance' : 'Provision'}
                            </span>
                            <span className="step-total">/ 4</span>
                        </div>
                        <button className="close-btn-gov" onClick={onClose}>
                            ✕
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="wizard-body-gov">
                    {step === 1 && (
                        <div className="wizard-step-gov">
                            <div className="step-header">
                                <div>
                                    <h3>Agency Profile</h3>
                                    <p>Establish your secure tenant identity.</p>
                                </div>
                            </div>

                            <div className="gov-input-group">
                                <label>Agency / Department Name</label>
                                <input
                                    type="text"
                                    className="gov-input"
                                    placeholder="e.g. Department of Energy"
                                    value={agencyProfile.name}
                                    onChange={(e) => setAgencyProfile({ ...agencyProfile, name: e.target.value })}
                                />
                            </div>

                            <div className="gov-input-group">
                                <label>Mission Area</label>
                                <select
                                    className="gov-select"
                                    value={agencyProfile.mission}
                                    onChange={(e) => setAgencyProfile({ ...agencyProfile, mission: e.target.value })}
                                >
                                    <option>Scientific Discovery (Genesis Mission)</option>
                                    <option>National Security</option>
                                    <option>Citizen Services</option>
                                    <option>Healthcare (VA/HHS)</option>
                                </select>
                            </div>

                            {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="wizard-step-gov">
                            <div className="step-header">
                                <h3>Security Impact Level</h3>
                                <p>Select the data classification for this workspace.</p>
                            </div>

                            <div className="gov-grid">
                                <button
                                    className={`gov-card ${securityLevel === 'IL2' ? 'selected' : ''}`}
                                    onClick={() => setSecurityLevel('IL2')}
                                >
                                    <div className="card-icon">🛡️</div>
                                    <div className="card-content">
                                        <div className="card-title-row">
                                            <h4>IL2 (Public)</h4>
                                            <span className="badge badge-il">Low Impact</span>
                                        </div>
                                        <p>Non-controlled unclassified information. Standard security controls.</p>
                                    </div>
                                    {securityLevel === 'IL2' && <div className="selection-indicator"><div className="selection-dot"></div></div>}
                                </button>

                                <button
                                    className={`gov-card ${securityLevel === 'IL4' ? 'selected' : ''}`}
                                    onClick={() => setSecurityLevel('IL4')}
                                >
                                    <div className="card-icon">🔒</div>
                                    <div className="card-content">
                                        <div className="card-title-row">
                                            <h4>IL4 (CUI)</h4>
                                            <span className="badge badge-il">Moderate</span>
                                        </div>
                                        <p>Controlled Unclassified Information (PII/PHI). Enhanced privacy controls.</p>
                                    </div>
                                    {securityLevel === 'IL4' && <div className="selection-indicator"><div className="selection-dot"></div></div>}
                                </button>

                                <button
                                    className={`gov-card ${securityLevel === 'IL5' ? 'selected' : ''}`}
                                    onClick={() => setSecurityLevel('IL5')}
                                >
                                    <div className="card-icon">☢️</div>
                                    <div className="card-content">
                                        <div className="card-title-row">
                                            <h4>IL5 (Mission Critical)</h4>
                                            <span className="badge badge-critical">High Impact</span>
                                        </div>
                                        <p>National Security Systems (NSS). Highest level of unclassified protection.</p>
                                    </div>
                                    {securityLevel === 'IL5' && <div className="selection-indicator"><div className="selection-dot"></div></div>}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="wizard-step-gov">
                            <div className="step-header">
                                <h3>Compliance Frameworks</h3>
                                <p>Enable automated evidence collection.</p>
                            </div>

                            <div className="compliance-list">
                                <div className={`compliance-item checked`}>
                                    <div className="checkbox-custom">✓</div>
                                    <div>
                                        <h4 className="text-white font-medium">FedRAMP (NIST 800-53)</h4>
                                        <p className="text-slate-400 text-sm">Mandatory. Automated OSCAL evidence generation enabled.</p>
                                    </div>
                                </div>

                                <div
                                    className={`compliance-item ${compliance.hipaa ? 'checked' : ''}`}
                                    onClick={() => toggleCompliance('hipaa')}
                                >
                                    <div className="checkbox-custom">{compliance.hipaa && '✓'}</div>
                                    <div>
                                        <h4 className="text-white font-medium">HIPAA / HITECH</h4>
                                        <p className="text-slate-400 text-sm">Required for VA/HHS health data processing.</p>
                                    </div>
                                </div>

                                <div
                                    className={`compliance-item ${compliance.neutrality ? 'checked' : ''}`}
                                    onClick={() => toggleCompliance('neutrality')}
                                >
                                    <div className="checkbox-custom">{compliance.neutrality && '✓'}</div>
                                    <div>
                                        <h4 className="text-white font-medium">Viewpoint Neutrality Mandate</h4>
                                        <p className="text-slate-400 text-sm">Enforce objective truth standards (Executive Order 2025).</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="wizard-step-gov">
                            {loading ? (
                                <div className="loading-state-gov">
                                    <div className="spinner-gov"></div>
                                    <p>Provisioning Secure Workspace...</p>
                                    <span className="loading-subtitle-gov">
                                        Configuring Trust Center & OSCAL Controls
                                    </span>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-500/20 mb-6">
                                        <svg className="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Workspace Ready</h3>
                                    <p className="text-slate-400 mb-8">Your FedRAMP-aligned environment is active.</p>

                                    <div className="bg-slate-900/50 p-6 rounded-xl text-left max-w-md mx-auto border border-slate-800">
                                        <div className="flex justify-between mb-2">
                                            <span className="text-slate-500">Agency</span>
                                            <span className="text-white font-medium">{agencyProfile.name}</span>
                                        </div>
                                        <div className="flex justify-between mb-2">
                                            <span className="text-slate-500">Impact Level</span>
                                            <span className="text-blue-400 font-mono">{securityLevel}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">Compliance</span>
                                            <span className="text-green-400">FedRAMP Active</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="wizard-footer-gov">
                    <div className="footer-hint">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span>All actions logged to immutable audit trail.</span>
                    </div>
                    <div className="footer-actions">
                        {step > 1 && step < 4 && (
                            <button className="btn-gov btn-secondary-gov" onClick={() => setStep(step - 1)}>
                                Back
                            </button>
                        )}
                        {step < 4 && (
                            <button className="btn-gov btn-primary-gov" onClick={handleNext}>
                                <span>{step === 3 ? 'Provision Workspace' : 'Next'}</span>
                            </button>
                        )}
                        {step === 4 && !loading && (
                            <button className="btn-gov btn-primary-gov" onClick={onClose}>
                                Enter Workspace
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default GovWizardPremium;
