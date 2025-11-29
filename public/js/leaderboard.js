/**
 * AgentCache Leaderboard Component
 * Displays agent rankings, discovered patterns, and intelligence flow
 */

class Leaderboard {
  constructor() {
    this.data = null;
    this.selectedSector = null;
  }

  async load() {
    try {
      const response = await fetch('/api/game/leaderboard');
      if (!response.ok) throw new Error('Failed to load leaderboard');
      
      this.data = await response.json();
      return this.data;
    } catch (error) {
      console.error('[Leaderboard] Load error:', error);
      return null;
    }
  }

  render(containerId = 'leaderboardContainer') {
    if (!this.data) {
      return '<div class="text-slate-400">Loading leaderboard...</div>';
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="leaderboard-section">
        <!-- Stats Overview -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Active Agents</div>
            <div class="stat-value">${this.data.stats.totalAgents}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Patterns Discovered</div>
            <div class="stat-value">${this.data.stats.totalPatterns}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Cross-Sector Transfers</div>
            <div class="stat-value">${this.data.stats.totalTransfers}</div>
          </div>
        </div>

        <!-- Agent Rankings -->
        <div class="leaderboard-table">
          <h3>🏆 Agent Rankings</h3>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Agent</th>
                <th>Sector</th>
                <th>Score</th>
                <th>Sessions</th>
                <th>Patterns</th>
                <th>Achievements</th>
              </tr>
            </thead>
            <tbody>
              ${this.renderLeaderboardRows()}
            </tbody>
          </table>
        </div>

        <!-- Top Patterns -->
        <div class="patterns-grid">
          <h3>💡 Top Discovered Patterns</h3>
          ${this.renderTopPatterns()}
        </div>

        <!-- Intelligence Flow -->
        <div class="intelligence-flow">
          <h3>🔄 Cross-Sector Intelligence</h3>
          ${this.renderIntelligenceFlow()}
        </div>
      </div>
    `;
  }

  renderLeaderboardRows() {
    if (!this.data.leaderboard || this.data.leaderboard.length === 0) {
      return '<tr><td colspan="7" class="text-center text-slate-500">No agents yet</td></tr>';
    }

    return this.data.leaderboard.slice(0, 10).map((agent, index) => `
      <tr>
        <td class="rank-cell">${this.getRankBadge(index + 1)}</td>
        <td class="agent-cell">${this.truncateEmail(agent.agent_email)}</td>
        <td class="sector-cell">${this.getSectorEmoji(agent.sector)} ${agent.sector || 'All'}</td>
        <td class="score-cell">${agent.total_score.toFixed(0)}</td>
        <td>${agent.total_sessions}</td>
        <td>${agent.patterns_discovered}</td>
        <td>${this.renderAchievements(agent)}</td>
      </tr>
    `).join('');
  }

  renderTopPatterns() {
    if (!this.data.topPatterns || this.data.topPatterns.length === 0) {
      return '<p class="text-slate-500">No patterns discovered yet</p>';
    }

    return this.data.topPatterns.map(pattern => `
      <div class="pattern-card">
        <div class="pattern-header">
          <span class="pattern-sector">${this.getSectorEmoji(pattern.sector)} ${pattern.sector}</span>
          <span class="pattern-score">${pattern.validation_score}/100</span>
        </div>
        <div class="pattern-name">${pattern.pattern_name}</div>
        <div class="pattern-stats">
          <span>✅ ${pattern.total_validations} validations</span>
          <span>🔄 ${pattern.total_adoptions} adoptions</span>
        </div>
      </div>
    `).join('');
  }

  renderIntelligenceFlow() {
    if (!this.data.intelligenceFlow || this.data.intelligenceFlow.length === 0) {
      return '<p class="text-slate-500">No cross-sector transfers yet</p>';
    }

    return `
      <div class="flow-list">
        ${this.data.intelligenceFlow.map(flow => `
          <div class="flow-item">
            <div class="flow-path">
              <span class="flow-sector from">${this.getSectorEmoji(flow.source_sector)} ${flow.source_sector}</span>
              <span class="flow-arrow">→</span>
              <span class="flow-sector to">${this.getSectorEmoji(flow.target_sector)} ${flow.target_sector}</span>
            </div>
            <div class="flow-stats">
              <span class="transfer-count">${flow.transfer_count} transfers</span>
              <span class="similarity">${flow.avg_similarity.toFixed(0)}% similarity</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  getRankBadge(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  getSectorEmoji(sector) {
    const emojis = {
      healthcare: '🏥',
      finance: '💰',
      ecommerce: '🛍️',
      filestorage: '📁',
      aiml: '🤖',
      saas: '☁️'
    };
    return emojis[sector] || '📊';
  }

  truncateEmail(email) {
    if (!email) return 'Anonymous';
    const [name, domain] = email.split('@');
    return name.length > 12 ? name.substring(0, 12) + '...' : name;
  }

  renderAchievements(agent) {
    const achievements = [];
    
    if (agent.total_score >= 900) achievements.push('🏆 Legend');
    else if (agent.total_score >= 500) achievements.push('⭐ Expert');
    else if (agent.total_score >= 200) achievements.push('✨ Rising Star');
    
    if (agent.patterns_discovered >= 5) achievements.push('🔬 Researcher');
    if (agent.total_sessions >= 20) achievements.push('🎮 Veteran');
    
    return achievements.length > 0 
      ? `<span class="achievements">${achievements.join(' ')}</span>`
      : '<span class="text-slate-600">-</span>';
  }
}

// Initialize
const leaderboard = new Leaderboard();

// Expose globally
window.loadLeaderboard = async () => {
  await leaderboard.load();
  leaderboard.render();
};
