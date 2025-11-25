import { createContext, useContext, useState, useEffect } from 'react';
import { getSectorConfig } from '../config/sectors';

const SectorContext = createContext();

export function SectorProvider({ children }) {
  const [sector, setSector] = useState(null);
  const [config, setConfig] = useState(null);
  const [showSectorModal, setShowSectorModal] = useState(false);

  useEffect(() => {
    // Check localStorage for saved sector
    const saved = localStorage.getItem('agentcache_sector');
    if (saved) {
      setSector(saved);
      setConfig(getSectorConfig(saved));
    } else {
      // First time user - show sector selection
      setShowSectorModal(true);
    }
  }, []);

  const selectSector = (newSector) => {
    setSector(newSector);
    setConfig(getSectorConfig(newSector));
    localStorage.setItem('agentcache_sector', newSector);
    setShowSectorModal(false);
  };

  const changeSector = () => {
    setShowSectorModal(true);
  };

  return (
    <SectorContext.Provider value={{
      sector,
      config,
      selectSector,
      changeSector,
      showSectorModal,
      setShowSectorModal
    }}>
      {children}
    </SectorContext.Provider>
  );
}

export function useSector() {
  const context = useContext(SectorContext);
  if (!context) {
    throw new Error('useSector must be used within SectorProvider');
  }
  return context;
}
