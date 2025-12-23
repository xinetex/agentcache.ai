import React, { useState, useEffect } from 'react';
import './ShopperSegmentationWidget.css';

const SEGMENTS = [
    { id: 'S1', label: 'High Spender', color: '#10b981', probability: 0.15 },
    { id: 'S2', label: 'Window Shopper', color: '#64748b', probability: 0.45 },
    { id: 'S3', label: 'Cart Abandoner', color: '#f59e0b', probability: 0.25 },
    { id: 'S4', label: 'Discount Hunter', color: '#8b5cf6', probability: 0.15 },
];

export default function ShopperSegmentationWidget() {
    const [events, setEvents] = useState([]);
    const [stats, setStats] = useState({
        totalProcessed: 1240,
        segmentCounts: { 'High Spender': 0, 'Window Shopper': 0, 'Cart Abandoner': 0, 'Discount Hunter': 0 }
    });

    useEffect(() => {
        // Generate initial events
        const initial = Array.from({ length: 5 }).map((_, i) => generateEvent(i));
        setEvents(initial);

        const interval = setInterval(() => {
            setEvents(prev => {
                const newEvent = generateEvent(Date.now());
                const updated = [newEvent, ...prev.slice(0, 6)]; // Keep last 7 events
                return updated;
            });

            setStats(prev => ({
                ...prev,
                totalProcessed: prev.totalProcessed + 1
            }));
        }, 1200); // New shopper every 1.2s

        return () => clearInterval(interval);
    }, []);

    const generateEvent = (id) => {
        // Pick random segment based on probability
        const rand = Math.random();
        let cumulative = 0;
        let segment = SEGMENTS[0];

        for (const s of SEGMENTS) {
            cumulative += s.probability;
            if (rand < cumulative) {
                segment = s;
                break;
            }
        }

        const isCacheHit = Math.random() > 0.3; // 70% cache hit rate for segments

        return {
            id: `usr_${Math.floor(Math.random() * 9000) + 1000}`,
            segment,
            isCacheHit,
            latency: isCacheHit ? Math.floor(Math.random() * 5 + 2) : Math.floor(Math.random() * 50 + 100),
            timestamp: new Date()
        };
    };

    return (
        <div className="control-panel segmentation-panel">
            <div className="panel-header">
                <h3>Shopper DNA Stream</h3>
                <div className="panel-indicator pulsing"></div>
            </div>

            <div className="segmentation-grid">
                <div className="live-stream">
                    <div className="stream-header">
                        <span>USER ID</span>
                        <span>SEGMENT</span>
                        <span>SOURCE</span>
                        <span>LATENCY</span>
                    </div>

                    <div className="stream-list">
                        {events.map((event) => (
                            <div key={event.id} className="stream-row animate-slide-in">
                                <span className="user-id">{event.id}</span>
                                <span className="segment-badge" style={{ borderColor: event.segment.color, color: event.segment.color }}>
                                    {event.segment.label}
                                </span>
                                <span className={`source-badge ${event.isCacheHit ? 'hit' : 'miss'}`}>
                                    {event.isCacheHit ? 'CACHE L1' : 'INFERENCE'}
                                </span>
                                <span className="latency">{event.latency}ms</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="mini-stats">
                    <div className="stat-box">
                        <span className="stat-label">Processed</span>
                        <span className="stat-val">{stats.totalProcessed.toLocaleString()}</span>
                    </div>
                    <div className="stat-box">
                        <span className="stat-label">Cache Ratio</span>
                        <span className="stat-val success">72%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
