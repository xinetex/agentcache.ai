import React, { useState } from 'react';

export default function DataExplorer() {
    const [input, setInput] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (!input.trim()) return;
        setLoading(true);
        setResult(null);

        try {
            const apiKey = localStorage.getItem('ac_api_key');
            const res = await fetch('/api/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': apiKey || ''
                },
                body: JSON.stringify({ text: input })
            });

            const data = await res.json();
            setResult(data);
        } catch (err) {
            console.error(err);
            setResult({ error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <header className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Data Explorer</h2>
                <p className="text-slate-400">Inspect L3 Cache and test Embeddings</p>
            </header>

            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 mb-8">
                <h3 className="text-lg font-bold mb-4">Embedding Generator</h3>
                <div className="flex gap-4 mb-4">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Enter text to vectorize..."
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-green-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg disabled:opacity-50"
                    >
                        {loading ? 'Generating...' : 'Generate'}
                    </button>
                </div>

                {result && (
                    <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 overflow-hidden">
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-xs font-bold px-2 py-1 rounded ${result.cached ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {result.cached ? 'CACHE HIT' : 'CACHE MISS'}
                            </span>
                            <span className="text-xs text-slate-500">{result.model}</span>
                        </div>

                        {result.embedding ? (
                            <div>
                                <div className="text-xs text-slate-400 mb-2">Vector (first 5 dims):</div>
                                <code className="text-cyan-400 text-sm">
                                    [{result.embedding.slice(0, 5).map(n => n.toFixed(4)).join(', ')}, ...]
                                </code>
                                <div className="text-xs text-slate-500 mt-2">Total dimensions: {result.embedding.length}</div>
                            </div>
                        ) : (
                            <div className="text-red-400">{result.error}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
