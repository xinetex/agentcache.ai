/**
 * SwarmVisualizer: Canvas-based rendering for massive agent swarms.
 */
class SwarmVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.agents = [];
        this.isRunning = false;
        
        // Match canvas size to container
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.loop();
    }

    stop() {
        this.isRunning = false;
    }

    async fetchState() {
        try {
            const res = await fetch('/api/admin/swarm/boids');
            const data = await res.json();
            if (data.agents) {
                this.agents = data.agents;
            }
        } catch (e) {
            console.error('[SwarmVisualizer] Fetch failed:', e);
        }
    }

    async loop() {
        if (!this.isRunning) return;

        await this.fetchState();
        this.draw();

        requestAnimationFrame(() => this.loop());
    }

    draw() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Dark background with slight fade for trails
        ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
        ctx.fillRect(0, 0, width, height);

        // Map 1000x1000 coord space to canvas size
        const scaleX = width / 1000;
        const scaleY = height / 1000;

        for (const agent of this.agents) {
            const x = agent.posX * scaleX;
            const y = agent.posY * scaleY;
            
            // Color based on intent and velocity
            const speed = Math.sqrt(agent.velX**2 + agent.velY**2);
            const hue = 180 + (agent.intentScore * 100); // 180-280 (Cyan to Purple)
            const alpha = 0.5 + (agent.intentScore * 0.5);

            ctx.beginPath();
            ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${alpha})`;
            
            // Draw tiny triangles for direction
            const angle = Math.atan2(agent.velY, agent.velX);
            const size = 3 + (agent.intentScore * 2);

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.moveTo(size, 0);
            ctx.lineTo(-size, -size/2);
            ctx.lineTo(-size, size/2);
            ctx.fill();
            ctx.restore();
        }

        // Draw HUD
        ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillText(`SWARM INTENSITY: ${this.agents.length * 500} BIT-AGENTS (SAMPLE 2k)`, 20, 30);
        ctx.fillText(`COORDINATION: BAYESIAN-GUIDED BOIDS`, 20, 50);
    }
}

// Global instance for Mission Control
window.swarmVisualizer = null;

function initSwarmView() {
    if (!window.swarmVisualizer) {
        window.swarmVisualizer = new SwarmVisualizer('swarmCanvas');
        window.swarmVisualizer.start();
    }
}
