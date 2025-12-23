import React, { useState, useEffect } from 'react';

/**
 * Stream Interface (Prototype)
 * 
 * Represents the "Dynamic Frontend" concept from Integral AI.
 * Instead of static navigation, the user expresses intent, and the 
 * "Frontend Operator" generates/selects the appropriate interface.
 */

// --- Dynamic Components (Simulated "Generations") ---

const StatsWidget = ({ data }) => (
    <div className="stream-widget" style={{ padding: '20px', background: '#1e293b', borderRadius: '12px', border: '1px solid #334155' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa' }}>System Vitality</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Memory</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{data.memory || '42%'}</div>
            </div>
            <div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>CPU</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{data.cpu || '15%'}</div>
            </div>
            <div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Cache Hit</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{data.hits || '98.2%'}</div>
            </div>
        </div>
    </div>
);

const LogViewer = () => (
    <div className="stream-widget" style={{ padding: '20px', background: '#0f172a', borderRadius: '12px', fontFamily: 'monospace', border: '1px solid #334155' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#f59e0b' }}>Live Trace Stream</h3>
        <div style={{ color: '#94a3b8', fontSize: '14px' }}>
            <div>[INFO] 12:01:03 - Cache MISS (key: user_prof_88)</div>
            <div>[INFO] 12:01:04 - Simulating outcome for 'delete_db'...</div>
            <div style={{ color: '#ef4444' }}>[WARN] 12:01:05 - Action High Risk! Confidence: 95%</div>
        </div>
    </div>
);

const InputField = ({ onSubmit, isProcessing }) => {
    const [val, setVal] = useState('');
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(val); }} style={{ width: '100%', maxWidth: '600px' }}>
            <input
                type="text"
                value={val}
                onChange={e => setVal(e.target.value)}
                placeholder="Describe your intent (e.g., 'Check system health')..."
                disabled={isProcessing}
                style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: '24px',
                    border: 'none',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '16px',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}
            />
        </form>
    );
}

// Export logic for testing
export const decideStreamComponent = (intent) => {
    const lower = intent.toLowerCase();
    if (lower.includes('stats') || lower.includes('health') || lower.includes('memory')) {
        return { type: 'StatsWidget', response: "Visualizing system vitality metrics." };
    } else if (lower.includes('log') || lower.includes('trace') || lower.includes('error')) {
        return { type: 'LogViewer', response: "Streaming live logs and traces." };
    } else {
        return { type: 'None', response: "I'm essentially a blank canvas. Try asking for 'stats' or 'logs'." };
    }
};

export default function StreamInterface() {
    const [intent, setIntent] = useState('');
    const [activeComponent, setActiveComponent] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [history, setHistory] = useState([]);

    const processIntent = async (userIntent) => {
        setIsProcessing(true);
        setIntent(userIntent);

        // Simulate "Universal Operator" thinking time
        await new Promise(r => setTimeout(r, 800));

        const decision = decideStreamComponent(userIntent);
        let component = null;

        if (decision.type === 'StatsWidget') {
            component = <StatsWidget data={{ memory: '45%', cpu: '12%' }} />;
        } else if (decision.type === 'LogViewer') {
            component = <LogViewer />;
        }

        setActiveComponent(component);
        setHistory(prev => [...prev, { user: userIntent, system: decision.response }]);
        setIsProcessing(false);
    };

    return (
        <div style={{
            height: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Background Animation (Abstract) */}
            <div style={{
                position: 'absolute', top: '-20%', left: '-20%', width: '140%', height: '140%',
                background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, rgba(0,0,0,0) 70%)',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            <div style={{ zIndex: 1, width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>

                {/* Header */}
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '3rem', fontWeight: '200', letterSpacing: '-1px', marginBottom: '10px', background: 'linear-gradient(to right, #60a5fa, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Stream
                    </h1>
                    <p style={{ color: '#94a3b8' }}>Dynamic Reality Interface</p>
                </div>

                {/* Dynamic Canvas */}
                <div style={{ minHeight: '300px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    {activeComponent ? (
                        <div className="fade-in-up">
                            {activeComponent}
                        </div>
                    ) : (
                        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '1.5rem', fontStyle: 'italic' }}>
                            "What do you want to create?"
                        </div>
                    )}
                </div>

                {/* Interaction Zone */}
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <div style={{ minHeight: '20px', color: '#38bdf8', fontSize: '14px' }}>
                        {isProcessing ? "Generating interface..." : (history.length > 0 ? history[history.length - 1].system : "")}
                    </div>
                    <InputField onSubmit={processIntent} isProcessing={isProcessing} />
                </div>

            </div>
        </div>
    );
}

// Simple CSS animation injection
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
    .fade-in-up {
      animation: fadeInUp 0.5s ease-out forwards;
    }
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
    document.head.appendChild(style);
}
