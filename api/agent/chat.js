export default async function handler(req) {
    const { message, sessionId } = await req.json();

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 100));

    // Randomly select context source for demo purposes
    const sources = ['L1', 'L2', 'L3', 'HYBRID'];
    const source = sources[Math.floor(Math.random() * sources.length)];

    // Mock response based on source
    let responseText = `Echo: ${message}`;
    if (source === 'L1') responseText += " (Immediate recall)";
    if (source === 'L2') responseText += " (Cached recently)";
    if (source === 'L3') responseText += " (Retrieved from archive)";
    if (source === 'HYBRID') responseText += " (Synthesized memory)";

    return new Response(JSON.stringify({
        message: responseText,
        contextSource: source,
        latency: Math.floor(Math.random() * 100),
        cached: source !== 'L3'
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
