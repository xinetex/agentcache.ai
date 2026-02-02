
import { z } from 'zod';
import { ToolModule } from '../registry.js';
import { LidarService } from '../../services/LidarService.js';
import { LidarCacheService } from '../../services/LidarCacheService.js';

// Schemas
const SearchAOISchema = z.object({
    bbox: z.array(z.number()).length(4).describe('Bounding box [minX, minY, maxX, maxY]'),
    useCache: z.boolean().optional().default(true).describe('Whether to use cached results if available'),
});

const GetProjectSchema = z.object({
    projectId: z.string().describe('The USGS Project ID'),
});

const GetWorkflowSchema = z.object({
    taskType: z.enum(['hillshade', 'contours', 'slope', 'flood']).describe('The type of derived product needed'),
});

// Services
const lidarService = new LidarService();

export const LidarTools: ToolModule = {
    tools: [
        {
            name: 'lidar_search_aoi',
            description: 'Search for USGS 3DEP Lidar products (Point Clouds, DEMs) within an Area of Interest. returns download links and metadata.',
            inputSchema: {
                type: 'object',
                properties: {
                    bbox: { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4, description: 'Bounding box [minX, minY, maxX, maxY]' },
                    useCache: { type: 'boolean', description: 'Whether to use cached results if available (default: true)' },
                },
                required: ['bbox'],
            },
        },
        {
            name: 'lidar_get_project',
            description: 'Get detailed metadata for a specific 3DEP Lidar project (acquisition date, vendor, datum).',
            inputSchema: {
                type: 'object',
                properties: {
                    projectId: { type: 'string', description: 'The USGS Project ID' },
                },
                required: ['projectId'],
            },
        },
        {
            name: 'lidar_get_workflow',
            description: 'Get a standard recipe/workflow for processing Lidar data (e.g. creating hillshades or contours).',
            inputSchema: {
                type: 'object',
                properties: {
                    taskType: { type: 'string', enum: ['hillshade', 'contours', 'slope', 'flood'], description: 'The type of derived product needed' },
                },
                required: ['taskType'],
            },
        },
    ],
    handlers: {
        lidar_search_aoi: async (args, context) => {
            const params = SearchAOISchema.parse(args);

            // 1. Check Cache
            if (params.useCache) {
                const cached = LidarCacheService.getCachedAOISearch(params.bbox);
                if (cached) {
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({ source: 'cache', results: cached }, null, 2)
                        }]
                    };
                }
            }

            // 2. Fetch from Service
            const results = await lidarService.searchByAOI(params.bbox);

            // 3. Cache Result
            LidarCacheService.cacheAOISearch(params.bbox, results);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ source: 'usgs_api', results }, null, 2)
                }]
            };
        },
        lidar_get_project: async (args, context) => {
            const params = GetProjectSchema.parse(args);

            // Check Cache
            const cached = LidarCacheService.getCachedProjectProfile(params.projectId);
            if (cached) {
                return { content: [{ type: 'text', text: JSON.stringify({ source: 'cache', metadata: cached }, null, 2) }] };
            }

            const metadata = await lidarService.getProjectMetadata(params.projectId);

            if (metadata) {
                LidarCacheService.cacheProjectProfile(metadata);
            }

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ source: 'usgs_api', metadata }, null, 2)
                }]
            };
        },
        lidar_get_workflow: async (args, context) => {
            const params = GetWorkflowSchema.parse(args);
            const recipe = lidarService.getDerivedProductRecipes(params.taskType);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({ recipe }, null, 2)
                }]
            };
        },
    }
};
