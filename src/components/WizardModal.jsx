import React, { useState, useEffect } from 'react';

/**
 * WizardModal: One-click deployment of agent templates
 * 
 * Features:
 * - Template selection with visual cards
 * - Configuration validation
 * - Environment variable check
 * - Deploy confirmation
 */

const WizardModal = ({ isOpen, onClose, onDeploy }) => {
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateDetails, setTemplateDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
    setLoading(false);
  };

  const selectTemplate = async (templateId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates?id=${templateId}`);
      const data = await res.json();
      setSelectedTemplate(templateId);
      setTemplateDetails(data);
      setStep(2);
    } catch (err) {
      console.error('Failed to fetch template:', err);
    }
    setLoading(false);
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      // In production, this would call an API to provision the agent
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulated delay

      if (onDeploy) {
        onDeploy(templateDetails.template);
      }
      setStep(3);
    } catch (err) {
      console.error('Deploy failed:', err);
    }
    setDeploying(false);
  };

  const reset = () => {
    setStep(1);
    setSelectedTemplate(null);
    setTemplateDetails(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal">
        {/* Header */}
        <div className="wizard-header">
          <h2>🚀 Deploy Agent</h2>
          <button className="close-btn" onClick={reset}>×</button>
        </div>

        {/* Progress */}
        <div className="wizard-progress">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Select</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Configure</div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Deploy</div>
        </div>

        {/* Content */}
        <div className="wizard-content">
          {/* Step 1: Template Selection */}
          {step === 1 && (
            <div className="template-grid">
              {loading ? (
                <div className="loading">Loading templates...</div>
              ) : (
                templates.map(t => (
                  <div
                    key={t.id}
                    className="template-card"
                    onClick={() => selectTemplate(t.id)}
                  >
                    <div className="template-icon">{t.icon}</div>
                    <div className="template-name">{t.name}</div>
                    <div className="template-desc">{t.description}</div>
                    <div className={`template-vertical ${t.vertical}`}>
                      {t.vertical}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && templateDetails && (
            <div className="config-panel">
              <div className="config-header">
                <span className="config-icon">{templateDetails.template.icon}</span>
                <h3>{templateDetails.template.name}</h3>
              </div>

              {/* Required Tools */}
              <div className="config-section">
                <h4>Required Integrations</h4>
                {templateDetails.template.tools.required.map(tool => (
                  <div key={tool.id} className="tool-item">
                    <span className="tool-name">{tool.name}</span>
                    <span className={`tool-status ${templateDetails.missingEnvVars?.some(v =>
                      tool.requiredEnvVars.includes(v)
                    ) ? 'missing' : 'configured'
                      }`}>
                      {templateDetails.missingEnvVars?.some(v =>
                        tool.requiredEnvVars.includes(v)
                      ) ? '⚠️ Not Configured' : '✅ Ready'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Warnings */}
              {templateDetails.missingEnvVars?.length > 0 && (
                <div className="config-warning">
                  <strong>⚠️ Missing Environment Variables:</strong>
                  <ul>
                    {templateDetails.missingEnvVars.map(v => (
                      <li key={v}><code>{v}</code></li>
                    ))}
                  </ul>
                  <p>Add these to your Vercel environment to enable full functionality.</p>
                </div>
              )}

              {/* Policy */}
              <div className="config-section">
                <h4>Autonomy Policy</h4>
                <div className="policy-grid">
                  <div>Max Actions: {templateDetails.template.policy.maxActionsPerRun}</div>
                  <div>Escalation: {templateDetails.template.policy.escalationChannel || 'None'}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="config-actions">
                <button className="btn-back" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button
                  className="btn-deploy"
                  onClick={handleDeploy}
                  disabled={deploying}
                >
                  {deploying ? 'Deploying...' : '🚀 Deploy Agent'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 3 && (
            <div className="success-panel">
              <div className="success-icon">✅</div>
              <h3>Agent Deployed!</h3>
              <p>
                <strong>{templateDetails?.template.name}</strong> is now active.
              </p>
              <div className="success-details">
                <p>Webhook URL:</p>
                <code>https://agentcache-ai.vercel.app/api/webhooks/{templateDetails?.template.triggers[0]?.type}</code>
              </div>
              <button className="btn-done" onClick={reset}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
                .wizard-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }
                .wizard-modal {
                    background: #1a1a2e;
                    border-radius: 16px;
                    width: 90%;
                    max-width: 700px;
                    max-height: 80vh;
                    overflow: hidden;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
                }
                .wizard-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 24px;
                    border-bottom: 1px solid #333;
                }
                .wizard-header h2 {
                    margin: 0;
                    color: #fff;
                }
                .close-btn {
                    background: none;
                    border: none;
                    color: #888;
                    font-size: 24px;
                    cursor: pointer;
                }
                .wizard-progress {
                    display: flex;
                    padding: 16px 24px;
                    gap: 8px;
                    background: #16162a;
                }
                .step {
                    flex: 1;
                    text-align: center;
                    padding: 8px;
                    border-radius: 8px;
                    color: #666;
                    font-size: 14px;
                }
                .step.active {
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    color: #fff;
                }
                .wizard-content {
                    padding: 24px;
                    overflow-y: auto;
                    max-height: 50vh;
                }
                .template-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                    gap: 16px;
                }
                .template-card {
                    background: #16162a;
                    border: 2px solid #333;
                    border-radius: 12px;
                    padding: 20px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: center;
                }
                .template-card:hover {
                    border-color: #6366f1;
                    transform: translateY(-4px);
                }
                .template-icon {
                    font-size: 36px;
                    margin-bottom: 8px;
                }
                .template-name {
                    color: #fff;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                .template-desc {
                    color: #888;
                    font-size: 12px;
                    margin-bottom: 12px;
                }
                .template-vertical {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 11px;
                    text-transform: uppercase;
                }
                .template-vertical.software {
                    background: #1e3a5f;
                    color: #60a5fa;
                }
                .template-vertical.finance {
                    background: #3f2e1e;
                    color: #fbbf24;
                }
                .config-panel {
                    color: #fff;
                }
                .config-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 24px;
                }
                .config-icon {
                    font-size: 36px;
                }
                .config-section {
                    margin-bottom: 20px;
                }
                .config-section h4 {
                    color: #888;
                    margin-bottom: 12px;
                    font-size: 12px;
                    text-transform: uppercase;
                }
                .tool-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px;
                    background: #16162a;
                    border-radius: 8px;
                    margin-bottom: 8px;
                }
                .tool-status.configured {
                    color: #22c55e;
                }
                .tool-status.missing {
                    color: #f59e0b;
                }
                .config-warning {
                    background: #3f2e1e;
                    border: 1px solid #f59e0b;
                    border-radius: 8px;
                    padding: 16px;
                    margin-bottom: 20px;
                }
                .config-warning code {
                    background: #1a1a2e;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                .policy-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 8px;
                    color: #aaa;
                    font-size: 14px;
                }
                .config-actions {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 24px;
                }
                .btn-back {
                    background: #333;
                    border: none;
                    color: #fff;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                }
                .btn-deploy {
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    border: none;
                    color: #fff;
                    padding: 12px 32px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
                .btn-deploy:disabled {
                    opacity: 0.6;
                }
                .success-panel {
                    text-align: center;
                    padding: 40px;
                }
                .success-icon {
                    font-size: 64px;
                    margin-bottom: 16px;
                }
                .success-panel h3 {
                    color: #22c55e;
                    margin-bottom: 16px;
                }
                .success-panel p {
                    color: #aaa;
                }
                .success-details {
                    background: #16162a;
                    padding: 16px;
                    border-radius: 8px;
                    margin: 24px 0;
                }
                .success-details code {
                    display: block;
                    background: #0d0d1a;
                    padding: 12px;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #60a5fa;
                    word-break: break-all;
                }
                .btn-done {
                    background: #22c55e;
                    border: none;
                    color: #fff;
                    padding: 12px 40px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                }
                .loading {
                    text-align: center;
                    color: #888;
                    padding: 40px;
                }
            `}</style>
    </div>
  );
};

export default WizardModal;
