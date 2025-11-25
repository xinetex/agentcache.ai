import { useState } from 'react';
import './WizardModal.css';

function WizardModal({ sector, config, onClose, onComplete }) {
  const useCaseTemplates = config?.templates || [];
  const [step, setStep] = useState(1);
  const [selectedUseCase, setSelectedUseCase] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [performance, setPerformance] = useState('balanced');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleNext = async () => {
    if (step === 1) {
      if (!selectedUseCase) {
        setError('Please select a use case');
        return;
      }
      if (selectedUseCase === 'custom' && !customPrompt.trim()) {
        setError('Please describe your use case');
        return;
      }
      setError(null);
      setStep(2);
    } else if (step === 2) {
      setStep(3);
      await generatePipeline();
    }
  };

  const generatePipeline = async () => {
    setLoading(true);
    setError(null);

    try {
      const template = useCaseTemplates.find((t) => t.id === selectedUseCase);
      const prompt = selectedUseCase === 'custom' ? customPrompt : template.prompt;

      const response = await fetch('/api/pipeline/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sector, performance }),
      });

      const data = await response.json();

      if (data.success && data.pipeline) {
        onComplete(data.pipeline);
      } else {
        throw new Error(data.error || 'Failed to generate pipeline');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
      setStep(2);
    }
  };

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>🪄 AI Pipeline Wizard</h2>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="wizard-body">
          {step === 1 && (
            <div className="wizard-step">
              <h3>Select Use Case</h3>
              <div className="use-case-grid">
                {useCaseTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`use-case-card ${
                      selectedUseCase === template.id ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedUseCase(template.id)}
                  >
                    <h4>{template.title}</h4>
                    <p>{template.description}</p>
                  </div>
                ))}
              </div>

              {selectedUseCase === 'custom' && (
                <div className="custom-prompt">
                  <label>Describe your caching needs:</label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="E.g., Cache image generation results for marketing campaigns..."
                    rows={4}
                  />
                </div>
              )}

              {error && <div className="error-message">{error}</div>}
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step">
              <h3>Optimize For</h3>
              <div className="performance-options">
                <div
                  className={`perf-option ${performance === 'fast' ? 'selected' : ''}`}
                  onClick={() => setPerformance('fast')}
                >
                  <div className="perf-icon">⚡</div>
                  <div className="perf-info">
                    <h4>Low Latency</h4>
                    <p>Minimize response time • L1 only</p>
                    <span className="perf-metric">~50ms p95</span>
                  </div>
                </div>

                <div
                  className={`perf-option ${
                    performance === 'balanced' ? 'selected' : ''
                  }`}
                  onClick={() => setPerformance('balanced')}
                >
                  <div className="perf-icon">⚖️</div>
                  <div className="perf-info">
                    <h4>Balanced</h4>
                    <p>Good speed + savings • L1 + L2</p>
                    <span className="perf-metric">Recommended</span>
                  </div>
                </div>

                <div
                  className={`perf-option ${performance === 'cost' ? 'selected' : ''}`}
                  onClick={() => setPerformance('cost')}
                >
                  <div className="perf-icon">💰</div>
                  <div className="perf-info">
                    <h4>Cost Optimized</h4>
                    <p>Maximum savings • Multi-tier</p>
                    <span className="perf-metric">$2.40/req saved</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>AI is generating your pipeline...</p>
                  <span className="loading-subtitle">
                    Analyzing use case and optimizing nodes
                  </span>
                </div>
              ) : error ? (
                <div className="error-state">
                  <p>{error}</p>
                  <button className="btn btn-secondary" onClick={() => setStep(2)}>
                    Try Again
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="wizard-footer">
          {step > 1 && step < 3 && (
            <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < 3 && (
            <button className="btn btn-primary" onClick={handleNext}>
              {step === 2 ? 'Generate Pipeline' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default WizardModal;
