import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SectorProvider } from './context/SectorContext';
import { AuthProvider } from './context/AuthContext';
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
