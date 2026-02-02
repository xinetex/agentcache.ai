
import React, { useState, useEffect } from 'react';
import './WorkspaceDashboard.css';

const ExchangeDashboard = ({ onBack, agentId }) => {
    const [listings, setListings] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);

    // Mock ID if none provided (for demo)
    const activeAgentId = agentId || "8051927e-d980-44b3-a7d5-b6a139a5db6a";

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 5000); // Live ticker updates
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [listRes, suggRes, balRes] = await Promise.all([
                fetch('/api/marketplace/listings'),
                fetch('/api/marketplace/suggestions'),
                fetch(`/api/marketplace/me?agentId=${activeAgentId}`)
            ]);

            const listJson = await listRes.json();
            const suggJson = await suggRes.json();
            const balJson = await balRes.json();

            setListings(listJson.listings || []);
            setSuggestions(suggJson.suggestions || []);
            setBalance(balJson.account?.balance || 0);
            setLoading(false);
        } catch (err) {
            console.error("Exchange fetch error:", err);
        }
    };

    const buyListing = async (listingId, price) => {
        if (balance < price) {
            alert("INSUFFICIENT FUNDS. PLEASE TOP OFF.");
            return;
        }
        try {
            const res = await fetch('/api/marketplace/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ buyerId: activeAgentId, listingId, units: 1 })
            });
            if (res.ok) {
                alert("ORDER EXECUTED");
                fetchData(); // Refresh balance
            } else {
                alert("TRANSACTION FAILED");
            }
        } catch (err) {
            alert("NETWORK ERROR");
        }
    };

    const topOff = async () => {
        await fetch('/api/marketplace/topoff', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId: activeAgentId })
        });
        alert("FUNDS DEPOSITED");
        fetchData();
    };

    return (
        <div className="exchange-dashboard" style={{
            width: '100vw',
            height: '100vh',
            background: '#050510',
            color: 'cyan',
            fontFamily: 'monospace',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={onBack} style={{ background: 'transparent', border: '1px solid cyan', color: 'cyan', padding: '5px 15px', cursor: 'pointer' }}>⬅ EXIT TERMINAL</button>
                    <h1 style={{ margin: 0, textShadow: '0 0 10px cyan' }}>AGENT EXCHANGE // L2</h1>
                </div>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: '#666' }}>WALLET BALANCE</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>${balance.toFixed(2)} USDC</div>
                    </div>
                    <button onClick={topOff} style={{ background: 'cyan', border: 'none', color: 'black', padding: '10px 20px', fontWeight: 'bold', cursor: 'pointer' }}>TOP OFF</button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ display: 'flex', flex: 1 }}>

                {/* Listings Column */}
                <div style={{ flex: 2, padding: '20px', overflowY: 'auto', borderRight: '1px solid #333' }}>
                    <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '10px' }}>MARKET LISTINGS</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
                        {listings.map(l => (
                            <div key={l.id} style={{ border: '1px solid #333', padding: '20px', background: 'rgba(0,0,0,0.3)' }}>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>{l.title}</div>
                                <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '20px', height: '40px' }}>{l.description}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ background: '#002200', color: '#00ff00', padding: '5px 10px', borderRadius: '4px' }}>${l.pricePerUnit}/{l.unitType}</div>
                                    <button
                                        onClick={() => buyListing(l.id, l.pricePerUnit)}
                                        style={{ background: 'transparent', border: '1px solid cyan', color: 'cyan', padding: '5px 15px', cursor: 'pointer', transition: 'all 0.2s' }}
                                        onMouseEnter={e => e.target.style.background = 'cyan', e.target.style.color = 'black'}
                                        onMouseLeave={e => e.target.style.background = 'transparent', e.target.style.color = 'cyan'}
                                    >BUY</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Sidebar (Governance) */}
                <div style={{ flex: 1, padding: '20px', background: '#020205' }}>
                    <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '10px' }}>AGENT VOICE (DAO)</h2>
                    <div style={{ marginTop: '20px' }}>
                        {suggestions.map(s => (
                            <div key={s.id} style={{ marginBottom: '15px', padding: '10px', borderLeft: '2px solid cyan' }}>
                                <div style={{ fontWeight: 'bold' }}>{s.title}</div>
                                <div style={{ fontSize: '10px', color: '#666' }}>Votes: {s.votes}</div>
                            </div>
                        ))}
                        {suggestions.length === 0 && <div style={{ color: '#444' }}>No active proposals.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExchangeDashboard;
