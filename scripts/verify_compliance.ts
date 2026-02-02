
import { MotionService } from '../src/services/sectors/robotics/MotionService.js';

async function main() {
    console.log("🛡️  Verifying Compliance Engine...");

    const service = new MotionService();

    // 1. Send Request with Sensitive Data (MRN) embedded in a field
    // We abuse the 'robot_radius' or add a custom field to test the JSON stringify check
    const riskReq = {
        sx: 0, sy: 0, gx: 10, gy: 10,
        // @ts-ignore
        description: "Transporting patient MRN-99999 to sector 7"
    };

    console.log("📤 Sending Payload:", riskReq);

    const result = await service.planPath(riskReq as any);

    console.log("\n📥 Result:", result);

    if (result.success) {
        console.log("✅ Service executed successfully.");
        // In a real unit test we'd inspect the internal request used, 
        // but here we rely on the console logs printed by MotionService saying "Compliance Actions".
    } else {
        console.log("❌ Service failed:", result);
    }
}

main().catch(console.error);
