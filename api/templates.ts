
import { getTemplates, getTemplateById, validateTemplateConfig } from '../../src/config/templates.js';

export const config = {
    runtime: 'nodejs',
};

/**
 * API: Get available agent templates
 * GET /api/templates - List all templates
 * GET /api/templates?id=code-auditor - Get specific template
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = req.query;

    try {
        if (id) {
            // Get specific template
            const template = getTemplateById(id as string);

            if (!template) {
                return res.status(404).json({ error: `Template '${id}' not found` });
            }

            // Check if env vars are configured
            const validation = validateTemplateConfig(template);

            return res.status(200).json({
                template,
                configured: validation.valid,
                missingEnvVars: validation.missing
            });
        }

        // List all templates
        const templates = getTemplates();

        return res.status(200).json({
            templates: templates.map(t => ({
                id: t.id,
                name: t.name,
                description: t.description,
                vertical: t.vertical,
                icon: t.icon,
                version: t.version
            })),
            count: templates.length
        });

    } catch (err: any) {
        console.error('[Templates API] Error:', err);
        return res.status(500).json({ error: err.message });
    }
}
