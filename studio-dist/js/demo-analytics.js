/**
 * Demo Analytics Tracker - Dogfooding AgentCache
 * 
 * Caches public user interactions to investigate:
 * - Which pipelines users click most
 * - What data sources they test
 * - Where they get confused (long pauses, back-clicks)
 * - What scenarios they complete
 * - Drop-off points in the demo
 * 
 * All data is public (no PII) and cached using our own platform.
 */

class DemoAnalytics {
  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.events = [];
    this.startTime = Date.now();
    this.lastActivity = Date.now();
    
    // Track engagement patterns
    this.interactions = {
      pipelineViews: new Set(),
      pipelineTests: new Set(),
      dataSourcesFetched: new Set(),
      scenariosRun: new Set(),
      tabSwitches: [],
      themeSwitches: [],
      errors: []
    };
    
    this.setupTracking();
  }
  
  getOrCreateSessionId() {
    let sessionId = sessionStorage.getItem('demo_session_id');
    if (!sessionId) {
      sessionId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('demo_session_id', sessionId);
    }
    return sessionId;
  }
  
  setupTracking() {
    // Track time on page
    setInterval(() => {
      const idleTime = Date.now() - this.lastActivity;
      if (idleTime > 30000) { // 30s idle
        this.trackEvent('idle_detected', { idleSeconds: Math.round(idleTime / 1000) });
      }
    }, 10000);
    
    // Track visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.trackEvent('tab_hidden');
      } else {
        this.trackEvent('tab_visible');
      }
    });
    
    // Track unload (leaving demo)
    window.addEventListener('beforeunload', () => {
      this.sendAnalytics();
    });
    
    // Periodic analytics send (every 30s)
    setInterval(() => {
      if (this.events.length > 0) {
        this.sendAnalytics();
      }
    }, 30000);
  }
  
  trackEvent(eventType, data = {}) {
    this.lastActivity = Date.now();
    
    const event = {
      type: eventType,
      timestamp: Date.now(),
      sessionTime: Date.now() - this.startTime,
      data
    };
    
    this.events.push(event);
    
    // Update interaction tracking
    switch (eventType) {
      case 'pipeline_view':
        this.interactions.pipelineViews.add(data.pipelineId);
        break;
      case 'pipeline_test':
        this.interactions.pipelineTests.add(data.pipelineId);
        break;
      case 'data_fetch':
        this.interactions.dataSourcesFetched.add(data.sourceId);
        break;
      case 'scenario_complete':
        this.interactions.scenariosRun.add(data.scenarioId);
        break;
      case 'tab_switch':
        this.interactions.tabSwitches.push(data.tab);
        break;
      case 'theme_switch':
        this.interactions.themeSwitches.push(data.theme);
        break;
      case 'error':
        this.interactions.errors.push(data);
        break;
    }
    
    console.log('[Demo Analytics]', eventType, data);
  }
  
  async sendAnalytics() {
    if (this.events.length === 0) return;
    
    const payload = {
      sessionId: this.sessionId,
      startTime: this.startTime,
      duration: Date.now() - this.startTime,
      events: this.events,
      summary: {
        pipelineViews: Array.from(this.interactions.pipelineViews),
        pipelineTests: Array.from(this.interactions.pipelineTests),
        dataSourcesFetched: Array.from(this.interactions.dataSourcesFetched),
        scenariosRun: Array.from(this.interactions.scenariosRun),
        tabSwitches: this.interactions.tabSwitches,
        themeSwitches: this.interactions.themeSwitches,
        errors: this.interactions.errors,
        engagement: this.calculateEngagement()
      },
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      referrer: document.referrer
    };
    
    try {
      // Send to our own API endpoint (which uses AgentCache to store/analyze)
      await fetch('/api/demo/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true // Ensure it sends even during page unload
      });
      
      // Clear sent events
      this.events = [];
      
      console.log('[Demo Analytics] Sent:', payload.summary);
    } catch (error) {
      console.warn('[Demo Analytics] Failed to send:', error);
    }
  }
  
  calculateEngagement() {
    const duration = Date.now() - this.startTime;
    const minutes = duration / 60000;
    
    return {
      durationMinutes: Math.round(minutes * 10) / 10,
      pipelinesExplored: this.interactions.pipelineViews.size,
      pipelinesTested: this.interactions.pipelineTests.size,
      dataSourcesUsed: this.interactions.dataSourcesFetched.size,
      scenariosCompleted: this.interactions.scenariosRun.size,
      tabSwitchCount: this.interactions.tabSwitches.length,
      errorCount: this.interactions.errors.length,
      engagementScore: this.calculateScore()
    };
  }
  
  calculateScore() {
    // Engagement scoring algorithm
    let score = 0;
    
    // Base points for duration (max 30 points)
    const duration = (Date.now() - this.startTime) / 60000;
    score += Math.min(duration * 3, 30);
    
    // Points for interactions
    score += this.interactions.pipelineViews.size * 5; // 5 pts per pipeline viewed
    score += this.interactions.pipelineTests.size * 10; // 10 pts per test run
    score += this.interactions.dataSourcesFetched.size * 8; // 8 pts per data fetch
    score += this.interactions.scenariosRun.size * 15; // 15 pts per scenario
    score += Math.min(this.interactions.tabSwitches.length * 2, 20); // 2 pts per tab switch (max 20)
    
    // Penalties
    score -= this.interactions.errors.length * 5; // -5 pts per error
    
    return Math.max(0, Math.round(score));
  }
  
  // Investigate features (for internal analysis)
  getInsights() {
    return {
      mostViewedPipelines: this.getMostViewed(),
      mostTestedPipelines: this.getMostTested(),
      preferredDataSources: this.getPreferredSources(),
      userJourney: this.getUserJourney(),
      conversionPath: this.getConversionPath(),
      dropOffPoints: this.getDropOffPoints()
    };
  }
  
  getMostViewed() {
    // Count pipeline views from events
    const viewCounts = {};
    this.events
      .filter(e => e.type === 'pipeline_view')
      .forEach(e => {
        viewCounts[e.data.pipelineId] = (viewCounts[e.data.pipelineId] || 0) + 1;
      });
    return Object.entries(viewCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }
  
  getMostTested() {
    const testCounts = {};
    this.events
      .filter(e => e.type === 'pipeline_test')
      .forEach(e => {
        testCounts[e.data.pipelineId] = (testCounts[e.data.pipelineId] || 0) + 1;
      });
    return Object.entries(testCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }
  
  getPreferredSources() {
    const sourceCounts = {};
    this.events
      .filter(e => e.type === 'data_fetch')
      .forEach(e => {
        sourceCounts[e.data.sourceId] = (sourceCounts[e.data.sourceId] || 0) + 1;
      });
    return Object.entries(sourceCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }
  
  getUserJourney() {
    // Sequence of major actions
    return this.events
      .filter(e => ['pipeline_view', 'pipeline_test', 'tab_switch', 'scenario_complete'].includes(e.type))
      .map(e => ({
        action: e.type,
        time: Math.round((e.timestamp - this.startTime) / 1000),
        data: e.data
      }));
  }
  
  getConversionPath() {
    // Did they progress through funnel?
    const funnel = {
      landedOnWorkspace: this.events.some(e => e.type === 'tab_switch' && e.data.tab === 'pipeline'),
      viewedPipeline: this.interactions.pipelineViews.size > 0,
      testedPipeline: this.interactions.pipelineTests.size > 0,
      usedLiveDemo: this.interactions.dataSourcesFetched.size > 0,
      ranScenario: this.interactions.scenariosRun.size > 0,
      switchedThemes: this.interactions.themeSwitches.length > 0,
      viewedReport: this.events.some(e => e.type === 'view_report')
    };
    
    return funnel;
  }
  
  getDropOffPoints() {
    // Identify where users stopped engaging
    const lastEvent = this.events[this.events.length - 1];
    const timeSinceLastEvent = Date.now() - (lastEvent?.timestamp || this.startTime);
    
    if (timeSinceLastEvent > 60000) { // 1 min idle
      return {
        lastAction: lastEvent?.type,
        idleTimeSeconds: Math.round(timeSinceLastEvent / 1000),
        possibleConfusion: this.identifyConfusion()
      };
    }
    
    return null;
  }
  
  identifyConfusion() {
    // Detect confusion patterns
    const patterns = [];
    
    // Rapid tab switching (indecision)
    const recentSwitches = this.interactions.tabSwitches.slice(-5);
    const uniqueTabs = new Set(recentSwitches);
    if (recentSwitches.length >= 5 && uniqueTabs.size <= 2) {
      patterns.push('rapid_tab_switching');
    }
    
    // Clicked same pipeline multiple times without testing
    const recentViews = this.events
      .filter(e => e.type === 'pipeline_view')
      .slice(-5)
      .map(e => e.data.pipelineId);
    const uniqueViews = new Set(recentViews);
    if (recentViews.length >= 3 && uniqueViews.size === 1) {
      patterns.push('repeated_views_no_action');
    }
    
    // Multiple errors
    if (this.interactions.errors.length >= 2) {
      patterns.push('multiple_errors');
    }
    
    return patterns;
  }
}

// Global instance
window.demoAnalytics = new DemoAnalytics();

// Helper functions for easy tracking
window.trackPipelineView = (pipelineId) => {
  window.demoAnalytics.trackEvent('pipeline_view', { pipelineId });
};

window.trackPipelineTest = (pipelineId, result) => {
  window.demoAnalytics.trackEvent('pipeline_test', { pipelineId, success: !result.error });
};

window.trackDataFetch = (sourceId, cached, latency) => {
  window.demoAnalytics.trackEvent('data_fetch', { sourceId, cached, latency });
};

window.trackScenarioComplete = (scenarioId, stats) => {
  window.demoAnalytics.trackEvent('scenario_complete', { scenarioId, ...stats });
};

window.trackError = (error, context) => {
  window.demoAnalytics.trackEvent('error', { error: error.message, context });
};

console.log('[Demo Analytics] Initialized - Dogfooding AgentCache! 🐕🍔');
