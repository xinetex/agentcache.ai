
class WirelessMap {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.signals = [];
        this.agents = [];
        this.gridSize = 50;
        this.isAnimating = false;
        this.scale = 1;

        // Resize Listener
        window.addEventListener('resize', () => this.resize());
        this.resize();

        // Start Animation Loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.draw();
    }

    async fetchData() {
        try {
            // Fetch Signals
            const sRes = await fetch('/api/scanner/signals');
            const sData = await sRes.json();
            this.signals = sData.signals || [];

            // Fetch Agents (Fleet)
            const fRes = await fetch('/api/admin/fleet');
            const fData = await fRes.json();
            this.agents = fData.fleet || [];

            this.draw();
        } catch (e) { console.error("Map Fetch Error:", e); }
    }

    loop() {
        if (this.isAnimating) {
            this.draw();
            // animate agents or scanlines here
        }
        requestAnimationFrame(this.loop);
    }

    start() { this.isAnimating = true; this.fetchData(); setInterval(() => this.fetchData(), 5000); }
    stop() { this.isAnimating = false; }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        // Clear - Deep Dark Blue/Black
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, w, h);

        // 1. Draw Grid
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.1)'; // Emerald-ish
        ctx.lineWidth = 1;

        for (let x = 0; x < w; x += this.gridSize) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }
        for (let y = 0; y < h; y += this.gridSize) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        // 2. Draw Sectors (Quadrants)
        this.drawLabel("ROBOTICS / LOGISTICS", 20, 30, "left");
        this.drawLabel("BIOLOGICS / FOLDING", w - 20, 30, "right");
        this.drawLabel("FINANCE / RISK", w - 20, h - 30, "right");
        this.drawLabel("SECURITY / INTEL", 20, h - 30, "left");

        // 3. Draw Signals (Heatmap)
        this.signals.forEach(sig => {
            // Map 0-100 virtual coords to canvas
            const x = (sig.lat / 100) * w;
            const y = (sig.lon / 100) * h;

            // Gradient
            const radius = 50 + (Math.abs(sig.strength) * 0.5); // weak signals are small? or strong signals big? 
            // Strength is usually negative dBm (-30 strong, -90 weak) OR 0.0-1.0 pos in our schema
            // Schema default is 0. Let's assume 0-10 normalized for now or use the db value.

            const g = ctx.createRadialGradient(x, y, 0, x, y, radius);

            let color = 'rgba(16, 185, 129, ';
            if (sig.type === 'anomaly') color = 'rgba(244, 63, 94, '; // Rose
            if (sig.type === 'bluetooth') color = 'rgba(59, 130, 246, '; // Blue

            // Opacity based on recency or strength
            const alpha = 0.4;

            g.addColorStop(0, color + alpha + ')');
            g.addColorStop(1, color + '0)');

            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // 4. Draw Agents
        ctx.fillStyle = '#fff';
        this.agents.forEach((agent, i) => {
            // Mock position if not in DB, use hash of ID to place randomly but consistently
            const mockX = (parseInt(agent.id.substr(0, 2), 16) / 255) * w;
            const mockY = (parseInt(agent.id.substr(2, 2), 16) / 255) * h;

            // Pulse
            const pulse = Math.sin(Date.now() / 200) * 3;

            ctx.beginPath();
            ctx.arc(mockX, mockY, 4 + pulse, 0, Math.PI * 2);
            ctx.fill();

            // Label
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '10px monospace';
            ctx.fillText(agent.name, mockX + 10, mockY);
            ctx.fillStyle = '#fff';
        });
    }

    drawLabel(text, x, y, align) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.font = '14px monospace';
        this.ctx.textAlign = align;
        this.ctx.fillText(text, x, y);
    }
}

// Attach to window
window.WirelessMap = WirelessMap;
