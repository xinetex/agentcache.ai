/**
 * Data Stream Visualizer
 * Visual metaphor: Cache as a magnetic capture field
 * Particles flowing left→right, cache field captures 92% in real-time
 */

class DataStreamVisualizer {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) {
      console.error(`Canvas ${canvasId} not found`);
      return;
    }
    
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.captureEffects = [];
    this.missEffects = [];
    
    // Configuration
    this.config = {
      hitRate: options.hitRate || 0.92,
      spawnRate: options.spawnRate || 60, // particles per second
      particleSpeed: options.particleSpeed || 2,
      cacheZone: {
        x: options.cacheX || 200,
        y: options.cacheY || 100,
        width: options.cacheWidth || 400,
        height: options.cacheHeight || 300
      },
      colors: {
        hit: '#10b981',
        miss: '#ef4444',
        particle: '#0ea5e9',
        cacheGlow: '#10b981'
      }
    };
    
    // Metrics tracking
    this.metrics = {
      totalParticles: 0,
      captured: 0,
      missed: 0,
      hitRate: 0
    };
    
    // Animation state
    this.running = false;
    this.lastSpawn = 0;
    this.animationFrame = null;
    
    // Setup
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  
  resize() {
    const parent = this.canvas.parentElement;
    this.canvas.width = parent.clientWidth;
    this.canvas.height = parent.clientHeight;
    
    // Recenter cache zone
    this.config.cacheZone.x = this.canvas.width * 0.25;
    this.config.cacheZone.y = (this.canvas.height - this.config.cacheZone.height) / 2;
  }
  
  start() {
    if (this.running) return;
    this.running = true;
    this.lastSpawn = performance.now();
    this.animate();
  }
  
  stop() {
    this.running = false;
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
  
  reset() {
    this.particles = [];
    this.captureEffects = [];
    this.missEffects = [];
    this.metrics = {
      totalParticles: 0,
      captured: 0,
      missed: 0,
      hitRate: 0
    };
  }
  
  spawnParticle() {
    const willCapture = Math.random() < this.config.hitRate;
    
    this.particles.push({
      x: -10,
      y: Math.random() * this.canvas.height,
      vx: this.config.particleSpeed + Math.random() * 2,
      vy: (Math.random() - 0.5) * 1,
      size: 3 + Math.random() * 2,
      alpha: 1,
      willCapture: willCapture,
      captured: false,
      phase: 0,
      trail: []
    });
    
    this.metrics.totalParticles++;
  }
  
  inCacheZone(particle) {
    const zone = this.config.cacheZone;
    return particle.x >= zone.x && 
           particle.x <= zone.x + zone.width &&
           particle.y >= zone.y && 
           particle.y <= zone.y + zone.height;
  }
  
  captureParticle(particle) {
    // Create capture effect
    this.captureEffects.push({
      x: particle.x,
      y: particle.y,
      radius: 0,
      maxRadius: 40,
      alpha: 0.8,
      color: this.config.colors.hit
    });
    
    // Particle gets pulled to center of cache
    const centerX = this.config.cacheZone.x + this.config.cacheZone.width / 2;
    const centerY = this.config.cacheZone.y + this.config.cacheZone.height / 2;
    
    particle.captured = true;
    particle.targetX = centerX;
    particle.targetY = centerY;
    particle.capturePhase = 0;
    
    this.metrics.captured++;
    this.updateHitRate();
  }
  
  missParticle(particle) {
    // Create miss effect (fade out)
    this.missEffects.push({
      x: particle.x,
      y: particle.y,
      vx: particle.vx,
      vy: particle.vy,
      size: particle.size,
      alpha: 0.6,
      color: this.config.colors.miss
    });
    
    this.metrics.missed++;
    this.updateHitRate();
  }
  
  updateHitRate() {
    const total = this.metrics.captured + this.metrics.missed;
    if (total > 0) {
      this.metrics.hitRate = (this.metrics.captured / total) * 100;
    }
  }
  
  updateParticles(deltaTime) {
    // Spawn new particles
    const spawnInterval = 1000 / this.config.spawnRate;
    if (performance.now() - this.lastSpawn > spawnInterval) {
      this.spawnParticle();
      this.lastSpawn = performance.now();
    }
    
    // Update existing particles
    this.particles = this.particles.filter(p => {
      if (p.captured) {
        // Spiral into cache center
        p.capturePhase += deltaTime * 0.003;
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        p.x += dx * 0.1;
        p.y += dy * 0.1;
        p.alpha -= deltaTime * 0.002;
        p.size *= 0.99;
        
        return p.alpha > 0.1 && p.size > 0.5;
      } else {
        // Normal flow
        p.x += p.vx;
        p.y += p.vy;
        
        // Add to trail
        p.trail.push({ x: p.x, y: p.y, alpha: p.alpha });
        if (p.trail.length > 10) p.trail.shift();
        
        // Check if entering cache zone
        if (this.inCacheZone(p) && p.willCapture && !p.captured) {
          this.captureParticle(p);
          return true;
        }
        
        // Check if exiting canvas
        if (p.x > this.canvas.width + 50) {
          if (!p.willCapture && !p.captured) {
            this.missParticle(p);
          }
          return false;
        }
        
        // Fade missed particles
        if (!p.willCapture && p.x > this.config.cacheZone.x) {
          p.alpha *= 0.98;
        }
        
        return p.x < this.canvas.width + 50 && p.alpha > 0.01;
      }
    });
    
    // Update capture effects
    this.captureEffects = this.captureEffects.filter(e => {
      e.radius += deltaTime * 0.15;
      e.alpha -= deltaTime * 0.002;
      return e.alpha > 0;
    });
    
    // Update miss effects
    this.missEffects = this.missEffects.filter(e => {
      e.x += e.vx;
      e.y += e.vy;
      e.alpha -= deltaTime * 0.001;
      return e.alpha > 0 && e.x < this.canvas.width + 50;
    });
  }
  
  drawCacheZone() {
    const zone = this.config.cacheZone;
    
    // Outer glow
    this.ctx.shadowBlur = 30;
    this.ctx.shadowColor = this.config.colors.cacheGlow;
    
    // Gradient fill
    const gradient = this.ctx.createRadialGradient(
      zone.x + zone.width / 2,
      zone.y + zone.height / 2,
      0,
      zone.x + zone.width / 2,
      zone.y + zone.height / 2,
      zone.width / 2
    );
    gradient.addColorStop(0, 'rgba(16,185,129,0.15)');
    gradient.addColorStop(1, 'rgba(16,185,129,0.02)');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
    
    // Border with animated dashes
    this.ctx.strokeStyle = 'rgba(16,185,129,0.6)';
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([10, 5]);
    this.ctx.lineDashOffset = -(performance.now() * 0.05) % 15;
    this.ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);
    this.ctx.setLineDash([]);
    
    // Reset shadow
    this.ctx.shadowBlur = 0;
    
    // Label
    this.ctx.fillStyle = 'rgba(16,185,129,0.8)';
    this.ctx.font = 'bold 14px JetBrains Mono, monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `CACHE FIELD`,
      zone.x + zone.width / 2,
      zone.y + 20
    );
    
    // Hit rate
    this.ctx.font = 'bold 32px JetBrains Mono, monospace';
    this.ctx.fillStyle = '#10b981';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      `${this.metrics.hitRate.toFixed(1)}%`,
      zone.x + zone.width / 2,
      zone.y + zone.height / 2
    );
    
    // Stats
    this.ctx.font = '12px JetBrains Mono, monospace';
    this.ctx.fillStyle = 'rgba(226,232,240,0.6)';
    this.ctx.fillText(
      `${this.metrics.captured} captured • ${this.metrics.missed} missed`,
      zone.x + zone.width / 2,
      zone.y + zone.height / 2 + 30
    );
  }
  
  drawParticles() {
    this.particles.forEach(p => {
      // Draw trail
      p.trail.forEach((t, i) => {
        const trailAlpha = (i / p.trail.length) * p.alpha * 0.3;
        this.ctx.fillStyle = `rgba(14,165,233,${trailAlpha})`;
        this.ctx.beginPath();
        this.ctx.arc(t.x, t.y, p.size * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      });
      
      // Determine color
      let color = this.config.colors.particle;
      if (p.captured) {
        color = this.config.colors.hit;
      } else if (!p.willCapture && p.x > this.config.cacheZone.x) {
        color = this.config.colors.miss;
      }
      
      // Draw particle
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = color;
      this.ctx.fillStyle = color;
      this.ctx.globalAlpha = p.alpha;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.shadowBlur = 0;
      this.ctx.globalAlpha = 1;
    });
  }
  
  drawCaptureEffects() {
    this.captureEffects.forEach(e => {
      this.ctx.strokeStyle = e.color;
      this.ctx.lineWidth = 2;
      this.ctx.globalAlpha = e.alpha;
      this.ctx.beginPath();
      this.ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.globalAlpha = 1;
    });
  }
  
  drawMissEffects() {
    this.missEffects.forEach(e => {
      this.ctx.fillStyle = e.color;
      this.ctx.globalAlpha = e.alpha;
      this.ctx.beginPath();
      this.ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    });
  }
  
  drawMetrics() {
    // Top-left metrics display
    this.ctx.font = '12px JetBrains Mono, monospace';
    this.ctx.fillStyle = 'rgba(226,232,240,0.6)';
    this.ctx.textAlign = 'left';
    
    const metrics = [
      `Total: ${this.metrics.totalParticles}`,
      `Captured: ${this.metrics.captured}`,
      `Missed: ${this.metrics.missed}`,
      `Hit Rate: ${this.metrics.hitRate.toFixed(1)}%`
    ];
    
    metrics.forEach((text, i) => {
      this.ctx.fillText(text, 20, 30 + i * 20);
    });
  }
  
  render() {
    // Clear canvas with fade effect
    this.ctx.fillStyle = 'rgba(10,14,20,0.2)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw components
    this.drawCacheZone();
    this.drawMissEffects();
    this.drawCaptureEffects();
    this.drawParticles();
    this.drawMetrics();
  }
  
  animate(timestamp = 0) {
    if (!this.running) return;
    
    const deltaTime = timestamp - (this.lastTimestamp || timestamp);
    this.lastTimestamp = timestamp;
    
    this.updateParticles(deltaTime);
    this.render();
    
    this.animationFrame = requestAnimationFrame((t) => this.animate(t));
  }
  
  // Public API for external control
  setHitRate(rate) {
    this.config.hitRate = Math.max(0, Math.min(1, rate));
  }
  
  setSpawnRate(rate) {
    this.config.spawnRate = rate;
  }
  
  getMetrics() {
    return { ...this.metrics };
  }
}

// Export for use in studio-v2.html
if (typeof window !== 'undefined') {
  window.DataStreamVisualizer = DataStreamVisualizer;
}
