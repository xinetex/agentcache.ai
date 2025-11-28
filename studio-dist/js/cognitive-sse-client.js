/**
 * Cognitive Universe SSE Client & Predictive Analytics Module
 * Real-time event streaming and ML-based forecasting for AgentCache
 */

class CognitiveSSEClient {
  constructor() {
    this.eventSource = null;
    this.connected = false;
    this.eventCounts = {
      cache_hit: 0,
      latent_manipulation: 0,
      hallucination_prevented: 0,
      security_block: 0,
      validation_passed: 0,
      cross_sector_intelligence: 0,
      memory_optimization: 0,
      anomaly_detected: 0
    };
    this.eventHandlers = [];
  }

  /**
   * Connect to SSE stream
   */
  connect() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource('/api/cognitive/stream');

    this.eventSource.onopen = () => {
      this.connected = true;
      this.updateConnectionStatus('connected');
      console.log('SSE connected to cognitive stream');
    };

    this.eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'connected') {
        console.log('SSE connection established:', data.message);
        return;
      }

      // Update event counts
      if (this.eventCounts.hasOwnProperty(data.type)) {
        this.eventCounts[data.type]++;
      }

      // Notify all handlers
      this.eventHandlers.forEach(handler => handler(data));
    };

    this.eventSource.onerror = () => {
      this.connected = false;
      this.updateConnectionStatus('error');
      console.error('SSE connection error. Reconnecting in 5s...');
      
      setTimeout(() => {
        this.connect();
      }, 5000);
    };
  }

  /**
   * Add event handler
   */
  onEvent(handler) {
    this.eventHandlers.push(handler);
  }

  /**
   * Update connection status UI
   */
  updateConnectionStatus(status) {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    if (!indicator || !statusText) return;

    if (status === 'connected') {
      indicator.className = 'h-2 w-2 rounded-full bg-emerald-500';
      statusText.textContent = '🟢 Connected to real-time stream';
    } else if (status === 'error') {
      indicator.className = 'h-2 w-2 rounded-full bg-rose-500 animate-pulse';
      statusText.textContent = '🔴 Connection lost. Reconnecting...';
    } else {
      indicator.className = 'h-2 w-2 rounded-full bg-slate-500 animate-pulse';
      statusText.textContent = '⚪ Connecting to real-time stream...';
    }
  }

  /**
   * Disconnect SSE stream
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.connected = false;
      this.updateConnectionStatus('disconnected');
    }
  }

  /**
   * Get event counts
   */
  getEventCounts() {
    return { ...this.eventCounts };
  }
}

/**
 * Cognitive Activity Feed Manager
 */
class CognitiveActivityFeed {
  constructor(containerId, maxItems = 8) {
    this.container = document.getElementById(containerId);
    this.maxItems = maxItems;
  }

  /**
   * Add real-time event to feed
   */
  addEvent(data) {
    if (!this.container) return;

    const eventConfig = this.getEventConfig(data);
    if (!eventConfig) return;

    const newItem = document.createElement('div');
    newItem.className = 'flex items-start gap-3 p-2 rounded-md hover:bg-slate-800/30 transition-colors group animate-fade-in';
    newItem.innerHTML = `
      <div class="h-6 w-6 rounded-lg bg-${eventConfig.color}-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-${eventConfig.color}-500/30 transition-colors">
        <i data-lucide="${eventConfig.icon}" class="w-3 h-3 text-${eventConfig.color}-400"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-slate-300">${eventConfig.message}</p>
        <p class="text-xs text-slate-500 mt-0.5">just now</p>
      </div>
    `;

    this.container.insertBefore(newItem, this.container.firstChild);
    
    // Re-init Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Keep only last N items
    const items = this.container.querySelectorAll('.flex');
    if (items.length > this.maxItems) {
      items[items.length - 1].remove();
    }
  }

  /**
   * Get event configuration for display
   */
  getEventConfig(data) {
    const configs = {
      cache_hit: { 
        color: 'emerald', 
        icon: 'check-circle', 
        message: `${data.sector}: ${data.layer} cache hit (${data.responseTime}ms, $${data.costSaved} saved)` 
      },
      latent_manipulation: { 
        color: 'purple', 
        icon: 'zap', 
        message: `${data.sector}: Latent match (${data.executionTime}ms, ${data.confidence}% confidence, ${data.timeSaved}ms saved)` 
      },
      hallucination_prevented: { 
        color: 'amber', 
        icon: 'shield-check', 
        message: `${data.sector}: Hallucination prevented - ${data.reason} (${data.severity})` 
      },
      security_block: { 
        color: 'rose', 
        icon: 'shield-alert', 
        message: `${data.sector}: ${data.threat} blocked from ${data.sourceIP} (${data.severity})` 
      },
      validation_passed: { 
        color: 'sky', 
        icon: 'check', 
        message: `${data.sector}: ${data.validationType} passed (${data.sources} sources, ${data.confidence}% confidence)` 
      },
      cross_sector_intelligence: { 
        color: 'cyan', 
        icon: 'arrow-right-left', 
        message: `${data.sourceSector} → ${data.targetSector}: ${data.pattern} (${data.applicationsToday} today)` 
      },
      memory_optimization: { 
        color: 'blue', 
        icon: 'database', 
        message: `${data.sector}: ${data.operation} (${data.entriesProcessed} entries, ${data.spaceSaved} saved)` 
      },
      anomaly_detected: { 
        color: 'orange', 
        icon: 'alert-triangle', 
        message: `${data.sector}: ${data.metric} anomaly detected (${data.deviation}σ deviation, ${data.severity})` 
      }
    };

    return configs[data.type] || null;
  }
}

/**
 * Predictive Analytics Manager
 */
class PredictiveAnalytics {
  constructor() {
    this.predictions = null;
    this.anomalies = [];
    this.recommendations = [];
  }

  /**
   * Fetch predictions from API
   */
  async fetch() {
    try {
      const response = await fetch('/api/cognitive/predictions');
      const data = await response.json();

      this.predictions = data.predictions || [];
      this.anomalies = data.anomalies || [];
      this.recommendations = data.recommendations || [];

      this.updateUI();
    } catch (error) {
      console.error('Failed to fetch predictions:', error);
    }
  }

  /**
   * Update UI with predictions
   */
  updateUI() {
    // Update 1-hour predictions
    const pred1h = this.predictions.find(p => p.timeframe === '1h');
    if (pred1h) {
      this.updatePredictionCard('1h', pred1h);
    }

    // Update 6-hour predictions
    const pred6h = this.predictions.find(p => p.timeframe === '6h');
    if (pred6h) {
      this.updatePredictionCard('6h', pred6h);
    }

    // Update 24-hour predictions
    const pred24h = this.predictions.find(p => p.timeframe === '24h');
    if (pred24h) {
      this.updatePredictionCard('24h', pred24h);
    }

    // Update anomalies
    this.updateAnomalies();

    // Update recommendations
    this.updateRecommendations();
  }

  /**
   * Update prediction card
   */
  updatePredictionCard(timeframe, prediction) {
    const prefix = `pred${timeframe}`;
    
    const elements = {
      confidence: document.getElementById(`${prefix}Confidence`),
      hitRate: document.getElementById(`${prefix}HitRate`),
      latency: document.getElementById(`${prefix}Latency`),
      requests: document.getElementById(`${prefix}Requests`)
    };

    if (elements.confidence) {
      elements.confidence.textContent = `${prediction.confidence}% confidence`;
    }
    if (elements.hitRate) {
      elements.hitRate.textContent = `${prediction.metrics.hitRate}%`;
    }
    if (elements.latency) {
      elements.latency.textContent = `${prediction.metrics.latency}ms`;
    }
    if (elements.requests) {
      elements.requests.textContent = prediction.metrics.requests.toLocaleString();
    }
  }

  /**
   * Update anomalies display
   */
  updateAnomalies() {
    const countEl = document.getElementById('anomalyCount');
    const listEl = document.getElementById('anomaliesList');

    if (!countEl || !listEl) return;

    countEl.textContent = this.anomalies.length;

    if (this.anomalies.length === 0) {
      listEl.innerHTML = '<div class="text-slate-500">No anomalies detected</div>';
      return;
    }

    listEl.innerHTML = this.anomalies.map(a => `
      <div class="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
        <i data-lucide="alert-circle" class="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0"></i>
        <div>
          <div class="font-medium text-amber-400">${a.metric}</div>
          <div class="text-slate-400">${a.description} (${a.severity})</div>
        </div>
      </div>
    `).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  /**
   * Update recommendations display
   */
  updateRecommendations() {
    const listEl = document.getElementById('recommendationsList');
    if (!listEl) return;

    if (this.recommendations.length === 0) {
      listEl.innerHTML = '<div class="text-slate-500">All systems optimal</div>';
      return;
    }

    listEl.innerHTML = this.recommendations.slice(0, 3).map(r => `
      <div class="flex items-start gap-2 p-2 rounded bg-purple-500/10 border border-purple-500/20">
        <i data-lucide="check-circle" class="w-3 h-3 text-purple-400 mt-0.5 flex-shrink-0"></i>
        <div class="text-slate-300">${r}</div>
      </div>
    `).join('');

    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }
}

/**
 * Metrics Updater - Updates dashboard metrics from SSE events
 */
class MetricsUpdater {
  constructor() {
    this.metrics = {
      totalHits: 0,
      hallucinationsPrevented: 0,
      securityBlocks: 0,
      crossSectorInsights: 0
    };
  }

  /**
   * Update metrics from event
   */
  updateFromEvent(data) {
    switch (data.type) {
      case 'cache_hit':
        this.incrementMetric('totalHits');
        break;
      case 'hallucination_prevented':
        this.incrementMetric('hallucinationsPrevented');
        break;
      case 'security_block':
        this.incrementMetric('securityBlocks');
        break;
      case 'cross_sector_intelligence':
        this.incrementMetric('crossSectorInsights');
        break;
    }
  }

  /**
   * Increment metric in UI
   */
  incrementMetric(metricName) {
    const el = document.getElementById(metricName);
    if (!el) return;

    const current = parseInt(el.textContent.replace(/,/g, '')) || 0;
    el.textContent = (current + 1).toLocaleString();

    // Add pulse animation
    el.classList.add('animate-pulse');
    setTimeout(() => el.classList.remove('animate-pulse'), 500);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CognitiveSSEClient, CognitiveActivityFeed, PredictiveAnalytics, MetricsUpdater };
}
