
import 'dotenv/config';
import { MotionService } from '../src/services/sectors/robotics/MotionService.js';

async function main() {
    console.log("🤖 Initializing MotionCache Verification...");
    const service = new MotionService();

    const obstaclesX = [];
    const obstaclesY = [];
    // Create a simple wall
    for (let i = 20; i < 40; i++) {
        obstaclesX.push(i);
        obstaclesY.push(30);
    }

    const request = {
        sx: 10, sy: 10,
        gx: 50, gy: 50,
        grid_size: 1.0,
        robot_radius: 1.0,
        ox: obstaclesX,
        oy: obstaclesY
    };

    console.log("\n1️⃣  Running First Pass (Compute Heavy)...");
    const t1 = Date.now();
    const result1 = await service.planPath(request);
    const d1 = Date.now() - t1;

    console.log(`   Internal Latency: ${result1.latency}ms`);
    console.log(`   Path Length: ${result1.path_x?.length || 0} steps`);
    console.log(`   From Cache: ${result1.from_cache}`);

    console.log("\n2️⃣  Running Second Pass (Cache Hit)...");
    const t2 = Date.now();
    const result2 = await service.planPath(request);
    const d2 = Date.now() - t2;

    console.log(`   Internal Latency: ${result2.latency}ms`);
    console.log(`   From Cache: ${result2.from_cache}`);

    if (result2.from_cache && result2.latency! < result1.latency!) {
        console.log("\n✅ FLYWHEEL ACTIVE: Cache is faster than Compute.");
        console.log(`   Saved: ${(result1.latency! - result2.latency!).toFixed(2)}ms`);
    } else {
        console.warn("\n⚠️  Flywheel Warning: Cache not effectively faster or not hit.");
    }
}

main().catch(console.error);
