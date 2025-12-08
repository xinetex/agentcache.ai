
/**
 * Universal Request Body Parser
 * Handles both Node.js (NextApiRequest) and Edge (Request) runtimes.
 * Robustly parses JSON from req.body or req.json().
 */
export async function parseBody(req) {
    try {
        // 1. Edge Runtime / Web Standard Request
        if (typeof req.json === 'function') {
            return await req.json();
        }

        // 2. Node.js Runtime (NextApiRequest)
        if (req.body) {
            // Already parsed by middleware
            if (typeof req.body === 'object') {
                return req.body;
            }
            // Stringified body (if bodyParser is disabled or failed)
            if (typeof req.body === 'string') {
                return JSON.parse(req.body);
            }
        }

        // 3. Fallback: Parse from ReadableStream (if needed)
        // This is rare in Vercel Node runtime/Next.js default, but harmless to check if we really need to.
        // Usually req.body covers it.

        return {}; // Return empty object if no body found to prevent destructuring crashes
    } catch (e) {
        console.error("Body Parsing Failed:", e);
        throw new Error("Invalid Request Body: " + e.message);
    }
}
