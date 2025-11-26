import { requireAuth } from '../../lib/auth-middleware.js';
import { query } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    // Verify authentication
    const user = await requireAuth(req, res);
    if (!user) return;

    const organizationId = user.organizationId;

    // GET - List all pipelines for organization
    if (req.method === 'GET') {
      // Fetch organization to get sector
      const orgResult = await query(
        'SELECT sector FROM organizations WHERE id = $1',
        [organizationId]
      );

      if (orgResult.rows.length === 0) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const sector = orgResult.rows[0].sector;

      // Return sector-specific pipeline templates
      // These are predefined pipelines based on sector
      let pipelines = [];

      if (sector === 'filestorage') {
        pipelines = [
          {
            id: 'filestorage-standard',
            name: 'Standard File Cache',
            description: 'Basic caching with deduplication',
            nodes: [
              { type: 'seagate_lyve_connector', config: {} },
              { type: 'file_dedup_cache', config: { ttl: 604800 } },
              { type: 'cdn_accelerator', config: {} }
            ]
          },
          {
            id: 'filestorage-media',
            name: 'Media Streaming Pipeline',
            description: 'Optimized for video/audio streaming with thumbnails',
            nodes: [
              { type: 'seagate_lyve_connector', config: {} },
              { type: 'file_dedup_cache', config: { ttl: 604800 } },
              { type: 'thumbnail_cache', config: { ttl: 86400 } },
              { type: 'cdn_accelerator', config: { streaming: true } }
            ]
          },
          {
            id: 'filestorage-compliance',
            name: 'Compliance & Audit Pipeline',
            description: 'Full audit logging with metadata tracking',
            nodes: [
              { type: 'seagate_lyve_connector', config: {} },
              { type: 'file_dedup_cache', config: { ttl: 604800 } },
              { type: 'audit_log_cache', config: { retention: 2592000 } },
              { type: 'metadata_cache', config: {} }
            ]
          }
        ];
      } else if (sector === 'healthcare') {
        pipelines = [
          {
            id: 'healthcare-phi',
            name: 'PHI Secure Cache',
            description: 'HIPAA-compliant caching with encryption',
            nodes: [
              { type: 'encryption_layer', config: { algorithm: 'AES-256' } },
              { type: 'redis_cache', config: { ttl: 3600 } },
              { type: 'audit_log', config: { retention: 7 * 365 * 86400 } }
            ]
          }
        ];
      } else if (sector === 'finance') {
        pipelines = [
          {
            id: 'finance-trading',
            name: 'Trading Data Cache',
            description: 'Low-latency caching for trading systems',
            nodes: [
              { type: 'redis_cache', config: { ttl: 60 } },
              { type: 'compliance_log', config: {} }
            ]
          }
        ];
      } else {
        // Generic pipelines
        pipelines = [
          {
            id: 'generic-standard',
            name: 'Standard Cache',
            description: 'Basic Redis caching',
            nodes: [
              { type: 'redis_cache', config: { ttl: 3600 } }
            ]
          }
        ];
      }

      return res.status(200).json({ pipelines });
    }

    // POST - Deploy/activate a pipeline (future implementation)
    if (req.method === 'POST') {
      const { pipelineId, namespaceId, config } = req.body;

      if (!pipelineId || !namespaceId) {
        return res.status(400).json({ error: 'Pipeline ID and namespace ID are required' });
      }

      // Verify namespace belongs to organization
      const namespaceResult = await query(
        'SELECT id FROM namespaces WHERE id = $1 AND organization_id = $2',
        [namespaceId, organizationId]
      );

      if (namespaceResult.rows.length === 0) {
        return res.status(404).json({ error: 'Namespace not found' });
      }

      // In a real implementation, this would deploy the pipeline configuration
      // For now, just acknowledge the request
      return res.status(200).json({ 
        message: 'Pipeline deployment initiated',
        pipelineId,
        namespaceId,
        status: 'deploying'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Pipelines API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
