
import { StorageService } from './storageService.js';
import { LidarProduct, ProjectMetadata } from './LidarService.js';

export class LidarCacheService {
    private static CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

    /**
     * Cache results of an AOI search.
     * Use Case 1: AOI query and download caching
     */
    static cacheAOISearch(bbox: number[], results: LidarProduct[]): void {
        const key = `lidar_aoi_${bbox.join('_')}`;
        const cacheEntry = {
            timestamp: Date.now(),
            bbox,
            results
        };
        StorageService.save(key, cacheEntry);
        console.log(`[LidarCache] Cached ${results.length} products for AOI: ${bbox.join(',')}`);
    }

    /**
     * Retrieve cached AOI search results if valid.
     */
    static getCachedAOISearch(bbox: number[]): LidarProduct[] | null {
        const key = `lidar_aoi_${bbox.join('_')}`;
        const cached = StorageService.load(key);

        if (!cached) return null;

        if (Date.now() - cached.timestamp > this.CACHE_TTL) {
            StorageService.remove(key);
            return null;
        }

        return cached.results;
    }

    /**
     * Cache a normalized Project Profile.
     * Use Case 2: Project metadata and 3DEP catalog memory
     */
    static cacheProjectProfile(profile: ProjectMetadata): void {
        const key = `lidar_project_${profile.id}`;
        StorageService.save(key, { timestamp: Date.now(), profile });
    }

    static getCachedProjectProfile(projectId: string): ProjectMetadata | null {
        const key = `lidar_project_${projectId}`;
        const cached = StorageService.load(key);
        return cached ? cached.profile : null;
    }

    /**
     * Cache an intermediate reasoning step or workflow result.
     * Use Case 6: Multi-step reasoning cache
     */
    static cacheWorkflowStep(stepId: string, data: any): void {
        const key = `lidar_workflow_${stepId}`;
        StorageService.save(key, { timestamp: Date.now(), data });
    }

    static getCachedWorkflowStep(stepId: string): any | null {
        const key = `lidar_workflow_${stepId}`;
        const cached = StorageService.load(key);
        return cached ? cached.data : null;
    }

    /**
     * Cache an organizational preference/recipe.
     * Use Case 7: Personalized lidar “playbook”
     */
    static cacheOrgPlaybook(orgId: string, playbook: any): void {
        const key = `lidar_playbook_${orgId}`;
        StorageService.save(key, { timestamp: Date.now(), playbook });
    }
}
