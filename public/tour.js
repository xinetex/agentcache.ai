/**
 * THE HIVE MIND TOUR
 * Demonstrates Maynard-Cross Learning via API orchestration.
 */

async function startHiveMindTour() {
    console.log("🐝 Starting Hive Mind Tour...");
    const status = document.createElement('div');
    status.style.position = 'absolute';
    status.style.bottom = '20px';
    status.style.left = '50%';
    status.style.transform = 'translateX(-50%)';
    status.style.background = 'rgba(0,0,0,0.8)';
    status.style.color = '#fff';
    status.style.padding = '10px 20px';
    status.style.borderRadius = '20px';
    status.style.zIndex = '1000';
    status.style.fontFamily = 'monospace';
    document.body.appendChild(status);

    const log = (msg) => status.innerText = msg;

    try {
        // 1. CLEAR THE FIELD
        log("💥 Step 1: Clearing the Medium...");
        // This is a rough way to clear, ideally we'd have a /purge endpoint
        // For now we just proceed, assuming the randomness will separate them

        // 2. SPAWN THE ALPHA (High Energy)
        log("👑 Step 2: Injecting High-Reward Strategy (Traffic Sensing)...");
        await fetch('/api/patterns/invoke', {
            method: 'POST',
            body: JSON.stringify({
                name: "Alpha Prime",
                intent: "Monitor Grid (Optimal Strategy)",
                triggerCondition: { type: 'cron', value: '*/5 * * * * *' }, // Fast pulse
                actionSequence: [{ type: 'sense_traffic' }] // This action generates Energy
            })
        });

        // 3. SPAWN THE LEARNERS (Low Energy)
        log("🌱 Step 3: Seeding 20 Naive Learners (Dreamers)...");
        for (let i = 0; i < 20; i++) {
            await fetch('/api/patterns/invoke', {
                method: 'POST',
                body: JSON.stringify({
                    name: `Learner ${i}`,
                    intent: "Dreaming (Sub-optimal)",
                    triggerCondition: { type: 'cron', value: '*/10 * * * * *' },
                    actionSequence: [{ type: 'generate_thought' }] // Low energy action
                })
            });
            await new Promise(r => setTimeout(r, 100)); // Stagger
        }

        log("👀 Step 4: Observation Phase. Watch the swarm imitate the Alpha.");

        // After 10 seconds, remove the status
        setTimeout(() => {
            status.innerText = "🐝 Hive Mind Active: Watch for White/Red propagation.";
            setTimeout(() => status.remove(), 5000);
        }, 10000);

    } catch (e) {
        console.error(e);
        log("❌ Tour failed. Check console.");
    }
}

// Global hook
window.startHiveMindTour = startHiveMindTour;
