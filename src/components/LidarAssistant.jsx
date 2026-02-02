
import React, { useState } from 'react';
import './LidarAssistant.css'; // We'll create this next

const LidarAssistant = ({ onClose }) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Ready to scan. Enter a bbox or location to search USGS 3DEP Lidar data.' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // parser: Extract simplistic bbox from text for demo "minx,miny,maxx,maxy"
            // In a real app, an LLM would parse this intent
            const bboxMatch = input.match(/-?\d+\.?\d*,\s*-?\d+\.?\d*,\s*-?\d+\.?\d*,\s*-?\d+\.?\d*/);

            if (bboxMatch) {
                const bbox = bboxMatch[0].split(',').map(n => parseFloat(n.trim()));
                await executeSearch(bbox, "Raw Coordinates");
            } else {
                // Natural Language Intent Parsing
                setMessages(prev => [...prev, { role: 'assistant', content: "Parsing location..." }]);

                const intentRes = await fetch('/api/lidar/intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: input })
                });

                const intentData = await intentRes.json();

                if (intentData.bbox) {
                    await executeSearch(intentData.bbox, intentData.name);
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: `Could not understand location: "${input}". Try format "minX, minY, maxX, maxY".` }]);
                }
            }

        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, { role: 'assistant', content: "System communication failure." }]);
        } finally {
            setLoading(false);
        }
    };

    const executeSearch = async (bbox, sourceName) => {
        // Call MCP Tool via Bridge
        const response = await fetch('/api/mcp/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                request: {
                    jsonrpc: "2.0",
                    method: "tools/call",
                    params: {
                        name: "lidar_search_aoi",
                        arguments: { bbox }
                    },
                    id: Date.now()
                }
            })
        });

        const json = await response.json();

        if (json.result && !json.error) {
            // Extract inner content text
            const toolResult = JSON.parse(json.result.content[0].text);
            const count = toolResult.results.length;

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Found ${count} datasets for ${sourceName}. Source: ${toolResult.source}.`,
                data: toolResult.results
            }]);
        } else {
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${json.error?.message || 'Unknown error'}` }]);
        }
    };

    return (
        <div className="lidar-assistant-panel">
            <div className="lidar-header">
                <h3>🛰️ Lidar Explorer</h3>
                <button onClick={onClose} className="close-btn">×</button>
            </div>

            <div className="chat-window">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.role}`}>
                        <div className="msg-content">{msg.content}</div>
                        {msg.data && (
                            <div className="lidar-results">
                                {msg.data.slice(0, 3).map(item => (
                                    <div key={item.id} className="lidar-card">
                                        {item.previewUrl && (
                                            <div className="lidar-preview">
                                                <img src={item.previewUrl} alt="Coverage Map" />
                                            </div>
                                        )}
                                        <h4>{item.title}</h4>
                                        <div className="lidar-meta">
                                            <span>📅 {item.publicationDate}</span>
                                            <span>{item.qualityLevel} • {item.format}</span>
                                        </div>
                                    </div>
                                ))}
                                {msg.data.length > 3 && <div className="more-count">+{msg.data.length - 3} more...</div>}
                            </div>
                        )}
                    </div>
                ))}
                {loading && <div className="message assistant"><span className="scanning">Scanning USGS Uplink...</span></div>}
            </div>

            <div className="input-area">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Enter bbox (-84.0, 43.0, ...)"
                />
                <button onClick={handleSend}>SCAN</button>
            </div>
        </div>
    );
};

export default LidarAssistant;
