
import { StorageService } from './storageService.js';
import { LidarProduct, ProjectMetadata } from './LidarService.js';
import { VectorClient } from '../infrastructure/VectorClient.js';

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

    // --- SEMANTIC CACHE LAYER (Phase 4) ---

    // Lazy load Vector Client to avoid circular deps or init issues
    private static _vectorClient: VectorClient;
    private static get vectorClient() {
        if (!this._vectorClient) {
            this._vectorClient = new VectorClient();
        }
        return this._vectorClient;
    }

    /**
     * Store a result with semantic indexing
     * Use Case: Help Center, FAQ, Support Bot
     */
    static async cacheSemantic(query: string, content: string): Promise<void> {
        // 1. Generate ID (simple hash for now, or random)
        // Using timestamp + random to ensure uniqueness for vector store
        const id = Date.now() + Math.floor(Math.random() * 1000);

        // 2. Embed
        // Note: vectorClient.embed is async
        const embedding = await this.vectorClient.embed(query);

        // 3. Store Vector
        await this.vectorClient.addVectors([id], embedding);

        // 4. Store Content
        const key = `lidar_semantic_${id}`;
        StorageService.save(key, {
            timestamp: Date.now(),
            query, // Store original query for debug/analysis
            content
        });

        console.log(`[LidarCache] Semantically Cached ID: ${id}`);
    }

    /**
     * Retrieve a result using semantic similarity
     */
    static async getSemantic(query: string, threshold: number = 0.1): Promise<string | null> {
        // 1. Embed Query
        const embedding = await this.vectorClient.embed(query);

        // 2. Search (k=1 for best match)
        const matches = await this.vectorClient.search(embedding, 1);

        if (matches.length === 0) return null;

        const best = matches[0];
        console.log(`[LidarCache] Best Semantic Match: ID ${best.id} (Dist: ${best.distance.toFixed(4)})`);

        // 3. Threshold Check (Distance 0 = Exact, 1 = Opposite)
        // Threshold 0.1 means "Very Close"
        if (best.distance > threshold) {
            return null; // Too different
        }

        // 4. Retrieve Content
        const key = `lidar_semantic_${best.id}`;
        const cached = StorageService.load(key);

        return cached ? cached.content : null;
    }
}
