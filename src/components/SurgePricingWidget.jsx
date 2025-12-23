import React, { useState, useEffect } from 'react';
import './SurgePricingWidget.css';

const INITIAL_PRODUCTS = [
    { id: 1, name: 'Uber Ride (Downtown)', basePrice: 25.00, price: 25.00, surge: 1.0, history: [25] },
    { id: 2, name: 'Instacart Delivery', basePrice: 9.99, price: 9.99, surge: 1.0, history: [9.99] },
    { id: 3, name: 'Concert Tickets (VIP)', basePrice: 150.00, price: 150.00, surge: 1.0, history: [150] },
    { id: 4, name: 'Flight (NYC -> LAX)', basePrice: 350.00, price: 350.00, surge: 1.0, history: [350] },
];

export default function SurgePricingWidget() {
    const [products, setProducts] = useState(INITIAL_PRODUCTS);

    useEffect(() => {
        const interval = setInterval(() => {
            setProducts(currentProducts =>
                currentProducts.map(product => {
                    // Simulate market volatility
                    const volatility = 0.15; // 15% Swing
                    const change = (Math.random() - 0.45) * volatility;
                    let newSurge = Math.max(0.8, Math.min(3.0, product.surge + change));

                    // Randomly trigger major events
                    if (Math.random() > 0.95) newSurge = 2.5; // Flash Surge
                    if (Math.random() < 0.05) newSurge = 0.9; // Flash Deal

                    const newPrice = product.basePrice * newSurge;
                    const newHistory = [...product.history.slice(-15), newPrice]; // Keep last 15 points

                    return {
                        ...product,
                        price: newPrice,
                        surge: newSurge,
                        history: newHistory
                    };
                })
            );
        }, 2000); // Update every 2 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="control-panel surge-panel">
            <div className="panel-header">
                <h3>Live Surge Monitor</h3>
                <div className="panel-indicator pulsing"></div>
            </div>

            <div className="surge-list">
                {products.map(product => {
                    const isSurge = product.surge > 1.2;
                    const isDeal = product.surge < 0.95;
                    const statusClass = isSurge ? 'danger' : isDeal ? 'success' : 'neutral';

                    return (
                        <div key={product.id} className={`surge-item ${statusClass}`}>
                            <div className="item-info">
                                <span className="item-name">{product.name}</span>
                                <div className="item-meta">
                                    <span className={`surge-badge ${statusClass}`}>
                                        {product.surge.toFixed(1)}x
                                    </span>
                                    {isSurge && <span className="status-label">SURGE ACTIVE</span>}
                                    {isDeal && <span className="status-label">DEAL ALERT</span>}
                                </div>
                            </div>

                            <div className="item-price">
                                <span className="current-price">${product.price.toFixed(2)}</span>
                                <span className="base-price">Base: ${product.basePrice}</span>
                            </div>

                            {/* Simple Sparkline Visualization */}
                            <div className="sparkline">
                                {product.history.map((val, idx) => {
                                    const max = Math.max(...product.history, product.basePrice * 3);
                                    const min = Math.min(...product.history, product.basePrice * 0.5);
                                    const height = ((val - min) / (max - min)) * 100;
                                    return (
                                        <div
                                            key={idx}
                                            className="spark-bar"
                                            style={{ height: `${height}%`, backgroundColor: isSurge ? '#ef4444' : isDeal ? '#10b981' : '#cbd5e1' }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
