/**
 * AgentCache Wizard Modal
 * 3-step intelligent pipeline creation wizard
 */

class WizardModal {
  constructor() {
    this.currentStep = 1;
    this.formData = {
      sector: '',
      useCase: '',
      traffic: 'steady',
      qps: 100,
      priority: 'balanced'
    };
    this.recommendation = null;
    this.gameSessionId = null; // Track game session for scoring
    this.sessionStartTime = null;
    this.init();
  }

  init() {
    this.render();
    this.attachEventListeners();
  }

  render() {
    const modalHTML = `
      <div id="wizardModal" class="modal" style="display: none;">
        <div class="modal-content wizard-content">
          <span class="close">&times;</span>
          
          <!-- Progress bar -->
          <div class="wizard-progress">
            <div class="step ${this.currentStep >= 1 ? 'active' : ''}" data-step="1">
              <div class="step-number">1</div>
              <div class="step-label">Industry</div>
            </div>
            <div class="step ${this.currentStep >= 2 ? 'active' : ''}" data-step="2">
              <div class="step-number">2</div>
              <div class="step-label">Details</div>
            </div>
            <div class="step ${this.currentStep >= 3 ? 'active' : ''}" data-step="3">
              <div class="step-number">3</div>
              <div class="step-label">Review</div>
            </div>
          </div>

          <div id="wizardSteps">
            ${this.renderStep1()}
          </div>

          <div class="wizard-actions">
            <button id="wizardBack" class="btn-secondary" style="display: none;">Back</button>
            <button id="wizardNext" class="btn-primary">Next</button>
          </div>
        </div>
      </div>
    `;

    // Inject if not exists
    if (!document.getElementById('wizardModal')) {
      document.body.insertAdjacentHTML('beforeend', modalHTML);
    }
  }

  renderStep1() {
    return `
      <div class="wizard-step" data-step="1">
        <h2>Select Your Industry</h2>
        <p class="step-description">Choose the sector that best fits your use case</p>
        
        <div class="sector-grid">
          ${this.renderSectorCard('healthcare', '🏥', 'Healthcare', 'HIPAA-compliant caching for medical records')}
          ${this.renderSectorCard('finance', '💰', 'Finance', 'SOC2-compliant caching for transactions')}
          ${this.renderSectorCard('ecommerce', '🛍️', 'E-commerce', 'Product catalog and cart caching')}
          ${this.renderSectorCard('filestorage', '📁', 'File Storage', 'CDN-powered file metadata caching')}
          ${this.renderSectorCard('aiml', '🤖', 'AI/ML', 'Model response and embedding caching')}
          ${this.renderSectorCard('saas', '☁️', 'SaaS', 'API and query result caching')}
        </div>
      </div>
    `;
  }

  renderSectorCard(value, icon, title, description) {
    const selected = this.formData.sector === value ? 'selected' : '';
    return `
      <div class="sector-card ${selected}" data-sector="${value}">
        <div class="sector-icon">${icon}</div>
        <div class="sector-title">${title}</div>
        <div class="sector-description">${description}</div>
      </div>
    `;
  }

  renderStep2() {
    return `
      <div class="wizard-step" data-step="2">
        <h2>Tell Us About Your Workload</h2>
        <p class="step-description">Help us optimize your pipeline configuration</p>
        
        <div class="form-group">
          <label>What will you be caching?</label>
          <input type="text" id="useCase" class="form-input" 
                 placeholder="e.g., Patient medical records, Product catalog, LLM responses"
                 value="${this.formData.useCase}">
        </div>

        <div class="form-group">
          <label>Traffic Pattern</label>
          <select id="traffic" class="form-select">
            <option value="steady" ${this.formData.traffic === 'steady' ? 'selected' : ''}>Steady - Consistent traffic</option>
            <option value="bursty" ${this.formData.traffic === 'bursty' ? 'selected' : ''}>Bursty - Occasional spikes</option>
            <option value="spiky" ${this.formData.traffic === 'spiky' ? 'selected' : ''}>Spiky - Frequent large spikes</option>
          </select>
        </div>

        <div class="form-group">
          <label>Expected Queries Per Second</label>
          <input type="number" id="qps" class="form-input" 
                 min="1" max="100000" value="${this.formData.qps}">
          <small class="form-hint">Approximate average requests per second</small>
        </div>

        <div class="form-group">
          <label>Priority</label>
          <div class="priority-options">
            ${this.renderPriorityOption('performance', '⚡', 'Performance', 'Fastest possible response times')}
            ${this.renderPriorityOption('balanced', '⚖️', 'Balanced', 'Good speed and reasonable cost')}
            ${this.renderPriorityOption('cost', '💵', 'Cost-Optimized', 'Lowest cost, acceptable speed')}
          </div>
        </div>
      </div>
    `;
  }

  renderPriorityOption(value, icon, title, description) {
    const selected = this.formData.priority === value ? 'selected' : '';
    return `
      <div class="priority-card ${selected}" data-priority="${value}">
        <div class="priority-icon">${icon}</div>
        <div class="priority-title">${title}</div>
        <div class="priority-description">${description}</div>
      </div>
    `;
  }

  renderStep3() {
    if (!this.recommendation) {
      return '<div class="loading">Generating recommendation...</div>';
    }

    const metrics = this.recommendation.expectedMetrics;
    
    return `
      <div class="wizard-step" data-step="3">
        <h2>🎉 Your Pipeline is Ready</h2>
        <p class="step-description">AI-generated configuration based on your requirements</p>
        
        <div class="recommendation-summary">
          <div class="confidence-badge">
            ${this.recommendation.confidence}% Confidence
          </div>
          
          <p class="recommendation-reason">${this.recommendation.reason}</p>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-label">Expected Hit Rate</div>
            <div class="metric-value">${(metrics.hitRate * 100).toFixed(1)}%</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Avg Latency</div>
            <div class="metric-value">${metrics.avgLatency}ms</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Monthly Savings</div>
            <div class="metric-value">$${metrics.estimatedCostSavings.monthly}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Pipeline Nodes</div>
            <div class="metric-value">${this.recommendation.recommended.nodes.length}</div>
          </div>
        </div>

        <div class="node-preview">
          <h3>Pipeline Configuration</h3>
          <div class="nodes-list">
            ${this.recommendation.recommended.nodes.map(node => `
              <div class="node-item">
                <span class="node-type">${node.type}</span>
                <span class="node-label">${node.label}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="alternatives">
          <h3>Other Options</h3>
          <div class="alternatives-grid">
            ${this.recommendation.alternatives.map(alt => `
              <div class="alternative-card">
                <div class="alt-name">${alt.name}</div>
                <div class="alt-description">${alt.description}</div>
                <div class="alt-cost">$${alt.estimatedCost}/mo</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  attachEventListeners() {
    const modal = document.getElementById('wizardModal');
    const closeBtn = modal.querySelector('.close');
    const nextBtn = document.getElementById('wizardNext');
    const backBtn = document.getElementById('wizardBack');

    closeBtn.onclick = () => this.close();
    nextBtn.onclick = () => this.next();
    backBtn.onclick = () => this.back();

    // Close on outside click
    window.onclick = (event) => {
      if (event.target === modal) {
        this.close();
      }
    };

    // Sector selection
    document.addEventListener('click', (e) => {
      if (e.target.closest('.sector-card')) {
        const sector = e.target.closest('.sector-card').dataset.sector;
        this.formData.sector = sector;
        document.querySelectorAll('.sector-card').forEach(card => card.classList.remove('selected'));
        e.target.closest('.sector-card').classList.add('selected');
      }
    });

    // Priority selection
    document.addEventListener('click', (e) => {
      if (e.target.closest('.priority-card')) {
        const priority = e.target.closest('.priority-card').dataset.priority;
        this.formData.priority = priority;
        document.querySelectorAll('.priority-card').forEach(card => card.classList.remove('selected'));
        e.target.closest('.priority-card').classList.add('selected');
      }
    });
  }

  async next() {
    if (this.currentStep === 1) {
      if (!this.formData.sector) {
        alert('Please select an industry');
        return;
      }
      this.currentStep = 2;
      this.updateStep();
    } else if (this.currentStep === 2) {
      // Capture form data
      this.formData.useCase = document.getElementById('useCase').value;
      this.formData.traffic = document.getElementById('traffic').value;
      this.formData.qps = parseInt(document.getElementById('qps').value);

      if (!this.formData.useCase) {
        alert('Please describe what you will be caching');
        return;
      }

      this.currentStep = 3;
      this.updateStep();
      
      // Generate recommendation
      await this.generateRecommendation();
    } else if (this.currentStep === 3) {
      // Open in Studio
      this.openInStudio();
    }
  }

  back() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.updateStep();
    }
  }

  updateStep() {
    const stepsContainer = document.getElementById('wizardSteps');
    const nextBtn = document.getElementById('wizardNext');
    const backBtn = document.getElementById('wizardBack');

    // Update content
    if (this.currentStep === 1) {
      stepsContainer.innerHTML = this.renderStep1();
      nextBtn.textContent = 'Next';
      backBtn.style.display = 'none';
    } else if (this.currentStep === 2) {
      stepsContainer.innerHTML = this.renderStep2();
      nextBtn.textContent = 'Generate Pipeline';
      backBtn.style.display = 'inline-block';
    } else if (this.currentStep === 3) {
      stepsContainer.innerHTML = this.renderStep3();
      nextBtn.textContent = 'Open in Studio';
      backBtn.style.display = 'inline-block';
    }

    // Update progress bar
    document.querySelectorAll('.wizard-progress .step').forEach((step, index) => {
      if (index < this.currentStep) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });
  }

  async generateRecommendation() {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/wizard/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(this.formData)
      });

      if (!response.ok) {
        throw new Error('Failed to generate recommendation');
      }

      this.recommendation = await response.json();
      this.updateStep(); // Re-render with recommendation
    } catch (error) {
      console.error('Error generating recommendation:', error);
      alert('Failed to generate recommendation. Please try again.');
      this.back();
    }
  }

  async openInStudio() {
    try {
      // Save pipeline first
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/pipelines', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: `${this.formData.sector} Pipeline`,
          description: this.formData.useCase,
          sector: this.formData.sector,
          config: this.recommendation.recommended
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save pipeline');
      }

      const data = await response.json();
      
      // Complete game session with success metrics
      await this.completeGameSession(true);
      
      // Redirect to Studio with pipeline ID
      window.location.href = `/studio.html?pipeline=${data.pipeline.id}`;
    } catch (error) {
      console.error('Error saving pipeline:', error);
      alert('Failed to create pipeline. Please try again.');
    }
  }

  async open() {
    this.currentStep = 1;
    this.recommendation = null;
    this.updateStep();
    document.getElementById('wizardModal').style.display = 'block';
    
    // Start game session tracking
    await this.startGameSession();
  }

  close() {
    document.getElementById('wizardModal').style.display = 'none';
  }
}

  async startGameSession() {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      this.sessionStartTime = Date.now();
      
      const response = await fetch('/api/game/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'start',
          sessionType: 'wizard',
          sector: this.formData.sector || 'unknown',
          useCase: this.formData.useCase || 'Exploring AgentCache',
          goal: 'Create optimal caching pipeline',
          pipelineConfig: null
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.gameSessionId = data.sessionId;
        console.log('[Game] Session started:', this.gameSessionId);
      }
    } catch (error) {
      console.error('[Game] Failed to start session:', error);
    }
  }

  async completeGameSession(success = true) {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token || !this.gameSessionId) return;

      const metrics = {
        hitRate: this.recommendation?.expectedMetrics?.hitRate || 0,
        avgLatency: this.recommendation?.expectedMetrics?.avgLatency || 0,
        latencyImprovement: 50, // Estimated improvement
        costSavings: this.recommendation?.expectedMetrics?.estimatedCostSavings?.monthly || 0,
        startedAt: this.sessionStartTime
      };

      const response = await fetch('/api/game/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'complete',
          sessionId: this.gameSessionId,
          sector: this.formData.sector,
          useCase: this.formData.useCase,
          pipelineConfig: this.recommendation?.recommended,
          success,
          metrics
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Game] Session completed:', {
          score: data.score,
          discoveredPattern: data.discoveredPattern,
          achievements: data.achievements
        });

        // Show achievements if any
        if (data.achievements && data.achievements.length > 0) {
          this.showAchievements(data.achievements);
        }
      }
    } catch (error) {
      console.error('[Game] Failed to complete session:', error);
    }
  }

  showAchievements(achievements) {
    // Simple toast notification for achievements
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    toast.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px;">🏆 Achievements Unlocked!</div>
      ${achievements.map(a => `<div>• ${a.name}: ${a.description}</div>`).join('')}
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
}

// Initialize wizard
const wizard = new WizardModal();

// Expose globally
window.launchWizard = () => wizard.open();
