
/**
 * Lidar Intent Parser
 * Uses Moonshot AI to convert natural language queries into USGS Bounding Boxes.
 */
import fetch from 'node-fetch'; // Standard in Node 18+, but explicit if needed. server.js uses imports.

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'Missing query' });
    }

    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Moonshot API key not configured' });
    }

    try {
        const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'moonshot-v1-8k',
                messages: [
                    {
                        role: 'system',
                        content: `You are a GIS expert. Your task is to convert a location name into a precise bounding box for USGS Lidar searches.
Output ONLY a JSON object with this format: { "bbox": [minX, minY, maxX, maxY], "name": "Formal Location Name" }.
The bbox must be in EPSG:4326 (WGS84) format: [minLongitude, minLatitude, maxLongitude, maxLatitude].
Example: User "Detroit", Output: { "bbox": [-83.28, 42.25, -82.91, 42.45], "name": "Detroit, MI" }.
If the location is invalid, return { "error": "Location not found" }.`
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ],
                temperature: 0.1
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Moonshot API error: ${errText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // Robust JSON parsing (in case of markdown fences)
        const jsonStr = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(jsonStr);

        return res.json(result);

    } catch (error) {
        console.error('[LidarIntent] Error:', error);
        return res.status(500).json({ error: 'Failed to parse intent', details: error.message });
    }
}
