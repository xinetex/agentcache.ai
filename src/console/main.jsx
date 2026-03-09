import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import GlobalErrorBoundary from './components/GlobalErrorBoundary.jsx';
import '../index.css'; // Use global styles (Tailwind)

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <GlobalErrorBoundary>
            <App />
        </GlobalErrorBoundary>
    </React.StrictMode>
);
