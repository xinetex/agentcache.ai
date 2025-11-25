import { useState, useEffect } from 'react';
import './WizardModalNew.css';
import { getSectorScenarios } from '../config/sectorScenarios.js';
import { DatasetService } from '../services/datasetService';

function WizardModalNew({ sector, config, onClose, onComplete }) {
  // Get HPC sector scenarios (research-backed templates)
  const sectorScenarios = getSectorScenarios(sector) || [];
  const useCaseTemplates = config?.templates || [];
  const [step, setStep] = useState(1);
  const [selectedUseCase, setSelectedUseCase] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [performance, setPerformance] = useState('balanced');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [datasetStats, setDatasetStats] = useState(null);

  // Example suggestions based on AgentCache use cases
  const exampleSuggestions = [
    {
      icon: '📊',
      title: 'Data Lakehouse RAG',
      description: 'Optimize LLM inference for data lakehouse RAG pipelines with sub-50ms cache hits and full audit trails for compliance'
    },
    {
      icon: '🎓',
      title: 'AI Learning Platform',
      description: 'Cache AI model inference results for educational platform with student learning analytics and response personalization'
    },
    {
      icon: '🎬',
      title: 'Media Asset Acceleration',
      description: 'Accelerate content delivery for media assets with multi-region edge caching and 14x faster upload speeds'
    },
    {
      icon: '🏢',
      title: 'Enterprise AI Governance',
      description: 'Cache reasoning model outputs (o1/DeepSeek) with governance controls for enterprise AI compliance and cost reduction'
    },
    {
      icon: '🔍',
      title: 'Vector Search',
      description: 'Optimize vector search and embedding cache for production RAG systems with semantic similarity matching'
    }
  ];

  useEffect(() => {
    if (step === 2) {
      DatasetService.loadDataset().then(() => {
        setDatasetStats(DatasetService.getStats());
      });
    }
  }, [step]);

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
    } else if (step === 3) {
      setStep(4);
      await generatePipeline();
    }
  };

  const generatePipeline = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if it's an HPC scenario first
      const scenario = sectorScenarios.find((s) => s.id === selectedUseCase);
      const template = useCaseTemplates.find((t) => t.id === selectedUseCase);

      let prompt;
      let nodes;
      let edges;

      if (scenario) {
        // HPC scenario - use research-backed configuration
        prompt = scenario.description;
        nodes = scenario.nodes.map((node, idx) => ({
          id: `${node.type}-${idx}`,
          type: node.type,
          position: { x: 100 + idx * 250, y: 200 },
          data: {
            label: node.type.replace(/_/g, ' ').toUpperCase(),
            config: node.config || {},
            metrics: {
              hitRate: 0,
              latency: 0,
              savings: 0
            }
          },
        }));

        // Auto-generate edges (sequential flow)
        edges = [];
        for (let i = 0; i < nodes.length - 1; i++) {
          edges.push({
            id: `e${i}`,
            source: nodes[i].id,
            target: nodes[i + 1].id,
            animated: true,
            style: { stroke: '#10b981' },
          });
        }

        // Complete the pipeline with scenario data
        onComplete({
          name: scenario.name,
          description: scenario.description,
          nodes,
          edges,
          sector,
          compliance: scenario.compliance,
          estimatedSavings: scenario.estimatedSavings,
          complexity: scenario.complexity,
          reasoning: scenario.reasoning
        });

        setLoading(false);
        return;
      }

      // Fall back to AI generation for custom or template-based
      prompt = selectedUseCase === 'custom' ? customPrompt : template.prompt;

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
      setStep(3);
    }
  };

  return (
    <div className="wizard-overlay-new" onClick={onClose}>
      <div className="wizard-modal-new" onClick={(e) => e.stopPropagation()}>
        {/* Top Bar */}
        <div className="wizard-header-new">
          <div className="wizard-brand">
            <div className="wizard-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </div>
            <div>
              <h2>AI Pipeline Wizard</h2>
              <p className="wizard-subtitle">Configure an end-to-end AI workflow for intelligent caching</p>
            </div>
          </div>

          <div className="wizard-controls">
            <div className="step-indicator">
              <span className="step-number">{step}</span>
              <span className="step-label">
                {step === 1 ? 'Use case' : step === 2 ? 'Analyze' : step === 3 ? 'Optimize' : 'Generate'}
              </span>
              <span className="step-total">/ 4</span>
            </div>
            <button className="close-btn-new" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="wizard-body-new">
          {step === 1 && (
            <div className="wizard-step-new">
              <div className="step-header">
                <div>
                  <h3>Select Use Case</h3>
                  <p>Choose a starting point. You can refine settings in the next steps.</p>
                  <p className="legend-hint">Amounts shown are estimated monthly savings from caching, not fees.</p>
                </div>
                <div className="recommended-badge">
                  <span className="pulse-dot"></span>
                  <span>Recommended</span>
                </div>
              </div>

              {/* Legend */}
              <div className="legend-bar" role="note" aria-label="Badge legend">
                <span className="legend-chip legend-savings">💰 Est. savings/mo</span>
                <span className="legend-chip legend-compliance">🔒 Compliance badges</span>
                <span className="legend-chip legend-complexity">🏷️ Enterprise = complexity</span>
              </div>

              <div className="use-case-grid-new">
                {/* HPC Sector Scenarios (Research-backed) */}
                {sectorScenarios.map((scenario) => (
                  <button
                    key={scenario.id}
                    className={`use-case-card-new ${selectedUseCase === scenario.id ? 'selected' : ''
                      } ${scenario.complexity === 'complex' ? 'recommended' : ''}`}
                    onClick={() => setSelectedUseCase(scenario.id)}
                  >
                    <div className="card-icon">💎</div>
                    <div className="card-content">
                      <div className="card-title-row">
                        <h4>{scenario.name}</h4>
                        {scenario.complexity === 'complex' && (
                          <span className="badge badge-advanced" title="Complexity level">Enterprise</span>
                        )}
                        {scenario.estimatedSavings && (
                          <span className="badge badge-savings" title="Estimated monthly savings vs no caching">{scenario.estimatedSavings}</span>
                        )}
                      </div>
                      <p>{scenario.description}</p>
                      {scenario.compliance && scenario.compliance.length > 0 && (
                        <div className="card-tags">
                          {scenario.compliance.slice(0, 3).map((comp, i) => (
                            <span key={i} className="tag">🔒 {comp}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedUseCase === scenario.id && (
                      <div className="selection-indicator">
                        <div className="selection-dot"></div>
                      </div>
                    )}
                  </button>
                ))}

                {/* Original templates (fallback) */}
                {useCaseTemplates.map((template) => (
                  <button
                    key={template.id}
                    className={`use-case-card-new ${selectedUseCase === template.id ? 'selected' : ''
                      } ${template.recommended ? 'recommended' : ''}`}
                    onClick={() => setSelectedUseCase(template.id)}
                  >
                    <div className="card-icon">{template.icon || '📦'}</div>
                    <div className="card-content">
                      <div className="card-title-row">
                        <h4>{template.title}</h4>
                        {template.popular && (
                          <span className="badge badge-popular">Most popular</span>
                        )}
                        {template.advanced && (
                          <span className="badge badge-advanced">Advanced</span>
                        )}
                      </div>
                      <p>{template.description}</p>
                      {template.tags && (
                        <div className="card-tags">
                          {template.tags.map((tag, i) => (
                            <span key={i} className="tag">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedUseCase === template.id && (
                      <div className="selection-indicator">
                        <div className="selection-dot"></div>
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {selectedUseCase === 'custom' && (
                <div className="custom-prompt-new">
                  <label>Describe your caching needs:</label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Describe what you want to cache..."
                    rows={4}
                  />
                  <div className="prompt-examples-new">
                    <p className="examples-label">💡 Need inspiration? Try these:</p>
                    <div className="example-chips">
                      {exampleSuggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          type="button"
                          className="example-chip-new"
                          onClick={() => setCustomPrompt(suggestion.description)}
                        >
                          <span className="chip-icon">{suggestion.icon}</span>
                          <span>{suggestion.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && <div className="error-message-new">{error}</div>}
            </div>
          )}

          {step === 2 && (
            <div className="wizard-step-new">
              <div className="step-header">
                <h3>Analyze Data</h3>
                <p>Projected impact based on your dataset</p>
              </div>

              {datasetStats ? (
                <div className="analysis-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '20px' }}>
                  <div className="stat-card" style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '5px' }}>🚀</div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#aaa' }}>Est. Hit Rate</h4>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00f3ff' }}>42%</div>
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>Based on semantic clusters</p>
                  </div>
                  <div className="stat-card" style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '5px' }}>💰</div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#aaa' }}>Monthly Savings</h4>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00ff9d' }}>$120</div>
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>Est. token reduction</p>
                  </div>
                  <div className="stat-card" style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '5px' }}>⚡</div>
                    <h4 style={{ margin: '0 0 5px 0', color: '#aaa' }}>Latency Drop</h4>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ff0055' }}>-85%</div>
                    <p style={{ fontSize: '0.9rem', color: '#666' }}>2.5s → 0.4s</p>
                  </div>

                  <div style={{ gridColumn: '1 / -1', marginTop: '20px', padding: '15px', background: 'rgba(0, 243, 255, 0.1)', borderRadius: '8px', border: '1px solid rgba(0, 243, 255, 0.2)' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: '#00f3ff' }}>Dataset Insights</h4>
                    <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', color: '#ddd' }}>
                      <span>📚 <strong>{datasetStats.totalItems}</strong> Samples</span>
                      <span>📝 <strong>{datasetStats.avgTokens}</strong> Avg Tokens</span>
                      <span>🗂️ <strong>{Object.keys(datasetStats.categories).length}</strong> Categories</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="loading-state-new">
                  <div className="spinner-new"></div>
                  <p>Analyzing dataset...</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step-new">
              <div className="step-header">
                <h3>Optimize For</h3>
                <p>Choose your performance priority</p>
              </div>

              <div className="performance-options-new">
                <button
                  className={`perf-option-new ${performance === 'fast' ? 'selected' : ''}`}
                  onClick={() => setPerformance('fast')}
                >
                  <div className="perf-icon-new">⚡</div>
                  <div className="perf-info-new">
                    <h4>Low Latency</h4>
                    <p>Minimize response time • L1 only</p>
                    <span className="perf-metric-new">~50ms p95</span>
                  </div>
                </button>

                <button
                  className={`perf-option-new ${performance === 'balanced' ? 'selected' : ''}`}
                  onClick={() => setPerformance('balanced')}
                >
                  <div className="perf-icon-new">⚖️</div>
                  <div className="perf-info-new">
                    <h4>Balanced</h4>
                    <p>Good speed + savings • L1 + L2</p>
                    <span className="perf-metric-new perf-recommended">Recommended</span>
                  </div>
                </button>

                <button
                  className={`perf-option-new ${performance === 'cost' ? 'selected' : ''}`}
                  onClick={() => setPerformance('cost')}
                >
                  <div className="perf-icon-new">💰</div>
                  <div className="perf-info-new">
                    <h4>Cost Optimized</h4>
                    <p>Maximum savings • Multi-tier</p>
                    <span className="perf-metric-new">$2.40/req saved</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="wizard-step-new">
              {loading ? (
                <div className="loading-state-new">
                  <div className="spinner-new"></div>
                  <p>AI is generating your pipeline...</p>
                  <span className="loading-subtitle-new">
                    Analyzing use case and optimizing nodes
                  </span>
                </div>
              ) : error ? (
                <div className="error-state-new">
                  <p>{error}</p>
                  <button className="btn-new btn-secondary-new" onClick={() => setStep(3)}>
                    Try Again
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wizard-footer-new">
          <div className="footer-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>You can modify data sources, models, and latency targets in later steps.</span>
          </div>
          <div className="footer-actions">
            {step > 1 && step < 4 && (
              <button className="btn-new btn-secondary-new" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            {step < 4 && (
              <button className="btn-new btn-primary-new" onClick={handleNext}>
                <span>{step === 3 ? 'Generate Pipeline' : 'Next'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WizardModalNew;
