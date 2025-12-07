
export const config = { runtime: 'edge' };

import { EvalRunner } from '../../src/lib/eval/eval.js';

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

export default async function handler(req) {
    // Security check: Only allow admin or localhost
    // For demo: weak check or skip
    const auth = req.headers.get('x-api-key');
    // if (auth !== process.env.ADMIN_KEY) ...

    if (req.method === 'GET') {
        return json({
            status: 'ready',
            message: 'POST to /api/eval/run to start a regression suite'
        });
    }

    if (req.method === 'POST') {
        try {
            const body = await req.json().catch(() => ({}));
            const { suite } = body;

            const runner = new EvalRunner({ apiKey: 'ac_demo_eval_runner' });

            const defaultSuite = {
                name: 'Basic Regression',
                tasks: [
                    {
                        name: 'Check Health',
                        type: 'check', // implies GET /check potentially, or we just test GET with a known key
                        input: { key: 'test-health-key' },
                        expected: { error: 'Not found' } // Should be 404
                    },
                    {
                        name: 'Set Value',
                        type: 'set',
                        input: {
                            key: 'eval-test-1',
                            value: 'test-value',
                            ttl: 60
                        },
                        expected: { hit: false } // Set returns success
                        // Actually 'hit' isn't returned on SET usually, we check status 200
                    },
                    {
                        name: 'Get Value',
                        type: 'get',
                        input: {
                            key: 'eval-test-1'
                        },
                        expected: { hit: true, response: 'test-value' }
                    }
                ]
            };

            const results = await runner.runSuite(suite || defaultSuite);

            return json(results);

        } catch (err) {
            return json({ error: err.message }, 500);
        }
    }

    return json({ error: 'Method not allowed' }, 405);
}
