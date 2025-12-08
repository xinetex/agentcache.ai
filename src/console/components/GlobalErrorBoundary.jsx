
import React from 'react';

export default class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-red-500 font-mono p-8 flex flex-col items-center justify-center">
                    <h1 className="text-4xl font-bold mb-4">SYSTEM CRITICAL FAILURE</h1>
                    <div className="bg-red-900/20 border border-red-500 rounded p-6 max-w-4xl w-full overflow-auto">
                        <h2 className="text-xl mb-2">{this.state.error && this.state.error.toString()}</h2>
                        <pre className="text-xs text-red-300 whitespace-pre-wrap">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="mt-8 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-500"
                    >
                        REBOOT SYSTEM
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
