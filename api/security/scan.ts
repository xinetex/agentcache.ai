import { scanForPickle, verifyProvenance } from '../../src/lib/security';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { content, modelId } = req.body;

        // 1. Provenance Check
        if (modelId) {
            const isTrusted = verifyProvenance(modelId);
            if (!isTrusted) {
                return res.status(403).json({
                    safe: false,
                    reason: 'Untrusted Source. Model ID not in allowlist.',
                    check: 'provenance'
                });
            }
        }

        // 2. Content Scan
        if (content) {
            // Assume content is base64 encoded string
            const buffer = Buffer.from(content, 'base64');
            const scanResult = scanForPickle(buffer);

            if (!scanResult.safe) {
                return res.status(400).json({
                    safe: false,
                    reason: scanResult.reason,
                    check: 'scan'
                });
            }
        }

        return res.status(200).json({
            safe: true,
            message: 'Model passed security checks.',
            checks: ['provenance', 'scan']
        });

    } catch (error) {
        console.error('Security Scan Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
