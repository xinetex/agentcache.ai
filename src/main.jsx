import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { SectorProvider } from './context/SectorContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SectorProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SectorProvider>
  </React.StrictMode>
);
