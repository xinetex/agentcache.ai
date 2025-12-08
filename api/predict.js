
import { PredictiveSynapse } from '../src/infrastructure/PredictiveSynapse.js';

// Singleton instance for the serverless container (Note: In strict serverless this resets, 
// but for Vercel/Node keep-warm it simulates persistence)
const synapse = new PredictiveSynapse();

// Seed some initial data for demo purposes
synapse.observe("What is AgentCache?", "How do I get an API key?");
synapse.observe("How do I get an API key?", "Where is the documentation?");
synapse.observe("Where is the documentation?", "Explain CLaRa-7B compression");

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const { query, previous_query } = await req.json();

        if (!query) {
            return new Response(JSON.stringify({ error: 'Query is required' }), { status: 400 });
        }

        // Learn from the sequence if provided
        if (previous_query) {
            synapse.observe(previous_query, query);
        }

        // Predict next steps
        const predictions = await synapse.predict(query);

        return new Response(JSON.stringify({
            input: query,
            predictions: predictions,
            synapse_version: "v1.0.0-markov"
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error("Prediction Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
