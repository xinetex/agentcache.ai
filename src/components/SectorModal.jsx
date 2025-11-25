import { useState } from 'react';
import './SectorModal.css';

const sectors = [
  {
    id: 'healthcare',
    icon: '⚕️',
    title: 'Healthcare',
    description: 'HIPAA compliance, PHI protection, medical records',
    compliance: ['HIPAA', 'PHI Detection'],
    color: '#10b981'
  },
  {
    id: 'finance',
    icon: '💰',
    title: 'Finance',
    description: 'PCI-DSS, fraud detection, transaction security',
    compliance: ['PCI-DSS', 'SOX'],
    color: '#f59e0b'
  },
  {
    id: 'legal',
    icon: '⚖️',
    title: 'Legal',
    description: 'Data retention, compliance, confidentiality',
    compliance: ['Data Retention', 'Audit Logs'],
    color: '#8b5cf6'
  },
  {
    id: 'ecommerce',
    icon: '🛒',
    title: 'E-commerce',
    description: 'Product data, inventory, customer sessions',
    compliance: ['PCI-DSS', 'GDPR'],
    color: '#3b82f6'
  },
  {
    id: 'saas',
    icon: '☁️',
    title: 'SaaS',
    description: 'API caching, multi-tenant, rate limiting',
    compliance: ['SOC 2', 'Multi-tenant'],
    color: '#06b6d4'
  },
  {
    id: 'general',
    icon: '🌐',
    title: 'General',
    description: 'Standard caching, no special requirements',
    compliance: ['Standard'],
    color: '#64748b'
  }
];

function SectorModal({ onComplete, onSkip }) {
  const [selectedSector, setSelectedSector] = useState(null);

  const handleContinue = () => {
    if (selectedSector) {
      onComplete(selectedSector);
    }
  };

  return (
    <div className="wizard-overlay">
      <div className="wizard-modal sector-modal">
        <div className="wizard-header">
          <div>
            <h2>Welcome to AgentCache Studio</h2>
            <p className="subtitle">Choose your industry to customize your experience</p>
          </div>
        </div>

        <div className="wizard-body">
          <div className="sector-grid">
            {sectors.map((sector) => (
              <div
                key={sector.id}
                className={`sector-card ${selectedSector === sector.id ? 'selected' : ''}`}
                onClick={() => setSelectedSector(sector.id)}
                style={{ '--sector-color': sector.color }}
              >
                <div className="sector-icon">{sector.icon}</div>
                <h3>{sector.title}</h3>
                <p className="sector-description">{sector.description}</p>
                <div className="sector-compliance">
                  {sector.compliance.map((item) => (
                    <span key={item} className="compliance-badge">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="wizard-footer">
          <button className="btn btn-secondary" onClick={() => onSkip('general')}>
            Skip for now
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleContinue}
            disabled={!selectedSector}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default SectorModal;
