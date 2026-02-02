
// Verification script for Lidar MCP integration
import { LidarTools } from './src/mcp/tools/lidar.ts';
import { LidarCacheService } from './src/services/LidarCacheService.ts';

async function verifyLidarIntegration() {
    console.log('--- Starting Lidar Integration Verification ---');

    // Test Context
    const context = { apiKey: 'test-key', auditLogger: { log: () => { } }, rateLimiter: {}, request: {} };

    // 1. Test Search AOI
    console.log('\n[1] Testing lidar_search_aoi...');
    const searchHandler = LidarTools.handlers['lidar_search_aoi'];

    // First call (Should hit Service)
    const result1 = await searchHandler({ bbox: [-84.0, 43.0, -83.5, 43.5] }, context as any);
    const content1 = JSON.parse(result1.content[0].text);
    console.log(`Call 1 Source: ${content1.source} (Expected: usgs_api)`);
    console.log(`Items found: ${content1.results.length}`);

    if (content1.source !== 'usgs_api' || content1.results.length === 0) {
        throw new Error('Search AOI verification failed');
    }

    // Second call (Should hit Cache)
    console.log('\n[2] Testing caching for search...');
    const result2 = await searchHandler({ bbox: [-84.0, 43.0, -83.5, 43.5] }, context as any);
    const content2 = JSON.parse(result2.content[0].text);
    console.log(`Call 2 Source: ${content2.source} (Expected: cache)`);

    if (content2.source !== 'cache') {
        throw new Error('Caching verification failed');
    }

    // 3. Test Get Project
    console.log('\n[3] Testing lidar_get_project...');
    const projectHandler = LidarTools.handlers['lidar_get_project'];
    const projectResult = await projectHandler({ projectId: 'USGS_LPC_MI_Saginaw_2019' }, context as any);
    const projectContent = JSON.parse(projectResult.content[0].text);
    console.log(`Project Name: ${projectContent.metadata.name}`);

    // 4. Test Get Workflow
    console.log('\n[4] Testing lidar_get_workflow...');
    const workflowHandler = LidarTools.handlers['lidar_get_workflow'];
    const workflowResult = await workflowHandler({ taskType: 'hillshade' }, context as any);
    const workflowContent = JSON.parse(workflowResult.content[0].text);
    console.log(`Workflow Steps: ${workflowContent.recipe.steps.length}`);

    console.log('\n--- Verification SUCCESS! ---');
}

verifyLidarIntegration().catch(console.error);
