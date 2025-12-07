
/**
 * specific evaluation logic for Cache Evals
 */

import cacheHandler from '../../../api/cache.js';

// Mock Request object for internal calls
class MockRequest {
    constructor(method, url, body, headers = {}) {
        this.method = method;
        this.url = url;
        this.body = body;
        this.headers = new Map(Object.entries(headers));
        this.headers.get = (k) => headers[k] || headers[k.toLowerCase()] || null;
    }
    async json() { return this.body; }
}

// Mock Response object to capture results
class MockResponse {
    constructor() {
        this._status = 200;
        this._body = null;
        this._headers = {};
    }

    status(code) {
        this._status = code;
        return this;
    }

    json(data) {
        this._body = data;
        return this;
    }
}

// Since api/cache.js returns a standard Response object (Web API), not Express
// We need to handle that.
// api/cache.js export default async function handler(req, ctx) => Response
// So we can call it directly with a request.

export class EvalRunner {
    constructor(config = {}) {
        this.config = config;
    }

    async runTask(task) {
        // Task: { name, input: { key, provider... }, expected: { hit: boolean, ... } }

        const startTime = Date.now();
        const headers = {
            'x-api-key': this.config.apiKey || 'ac_demo_eval',
            'content-type': 'application/json'
        };

        // Construct Request
        const req = {
            method: 'POST',
            url: 'http://localhost/api/cache/get', // Default to testing GET
            headers: {
                get: (k) => headers[k] || null
            },
            json: async () => task.input
        };

        // If testing SET, verify logic
        if (task.type === 'set') {
            req.url = 'http://localhost/api/cache/set';
        }

        try {
            // Call handler directly
            const response = await cacheHandler(req, { waitUntil: (p) => p.catch(console.error) });
            const data = await response.json();

            const duration = Date.now() - startTime;

            const result = {
                taskName: task.name,
                passed: false,
                duration,
                details: {
                    status: response.status,
                    response: data
                }
            };

            // Verify expectations
            if (task.expected) {
                let pass = true;
                if (task.expected.hit !== undefined && data.hit !== task.expected.hit) pass = false;
                if (task.expected.error && !data.error) pass = false;
                result.passed = pass;
            }

            return result;

        } catch (err) {
            return {
                taskName: task.name,
                passed: false,
                error: err.message
            };
        }
    }

    async runSuite(suite) {
        const results = [];
        for (const task of suite.tasks) {
            results.push(await this.runTask(task));
        }
        return {
            suiteName: suite.name,
            tasks: results,
            totalPassed: results.filter(r => r.passed).length,
            totalTasks: results.length
        };
    }
}
