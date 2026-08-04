import React, { useState, useEffect } from 'react';
import { X, Zap } from 'lucide-react';
import Sunburst from './Sunburst';

export default function TemplateGallery({ targetNodeId, onClose, onInstall }) {
  const [hierarchyData, setHierarchyData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      const token = localStorage.getItem('agentcache_token');
      try {
        const res = await fetch('/api/templates', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        // Transform the packs object into a D3 hierarchy JSON
        if (data.packs) {
          const root = {
            name: "Action Library",
            children: Object.keys(data.packs).map(packName => ({
              name: packName,
              children: data.packs[packName].map(tpl => ({
                name: tpl.name,
                description: tpl.description,
                id: tpl.id,
                is_file_pack: tpl.is_file_pack,
                value: 1 // Leaf nodes need a value for D3 partition sizing
              }))
            }))
          };
          setHierarchyData(root);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTemplates();
  }, []);

  const handleInstall = async (nodeData) => {
    // nodeData contains the leaf node payload from D3 (e.g. { name: 'Extract PDF', id: 'uuid', ... })
    if (!nodeData.id) return; // not a template leaf

    setLoading(true);
    const token = localStorage.getItem('agentcache_token');
    try {
      const res = await fetch('/api/templates?action=install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...(nodeData.is_file_pack ? { packId: nodeData.id } : { templateId: nodeData.id }),
          nodeId: targetNodeId
        })
      });
      
      if (res.ok) {
        if (onInstall) onInstall();
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '800px', maxWidth: '90vw', height: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Zap color="var(--accent-amber)" /> Action Library
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '8px 0 0 0', fontSize: '14px' }}>
              Click inner rings to zoom in. Click outer templates to install them onto the folder.
            </p>
          </div>
          <button className="icon-btn" onClick={onClose} disabled={loading}><X /></button>
        </div>
        
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', padding: '24px', overflow: 'hidden' }}>
          {hierarchyData ? (
            <Sunburst 
              data={hierarchyData} 
              width={500} 
              height={500} 
              onSelectNode={handleInstall} 
            />
          ) : (
            <div style={{ color: 'var(--text-muted)' }}>Loading Actions...</div>
          )}
        </div>
        
        {loading && (
          <div style={{ textAlign: 'center', padding: '16px', color: 'var(--accent-amber)' }}>
            Installing Action...
          </div>
        )}
      </div>
    </div>
  );
}
