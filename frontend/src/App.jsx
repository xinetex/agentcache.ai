import React, { useState, useEffect } from 'react';
import { Box, Search, Inbox, Folder as FolderIcon, Settings as SettingsIcon, X, Zap } from 'lucide-react';
import Canvas from './Canvas';
import LoginModal from './LoginModal';
import SettingsModal from './SettingsModal';
import TemplateGallery from './TemplateGallery';
import Sunburst from './Sunburst';

export default function App() {
  const [user, setUser] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeContents, setNodeContents] = useState(null);
  const [selectedNodeDetail, setSelectedNodeDetail] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [currentParentId, setCurrentParentId] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([{ id: null, name: 'Root' }]);
  
  useEffect(() => {
    if (selectedNode) {
      const fetchContentsAndDetail = async () => {
        const token = localStorage.getItem('agentcache_token');
        try {
          // Fetch contents (sunburst hierarchy)
          const resContents = await fetch(`/api/nodes?action=contents&id=${selectedNode.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const dataContents = await resContents.json();
          if (dataContents.hierarchy) {
            setNodeContents(dataContents.hierarchy);
          }
          
          // Fetch details (memory_context)
          const resDetail = await fetch(`/api/nodes?action=detail&id=${selectedNode.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const dataDetail = await resDetail.json();
          if (dataDetail.node) {
            setSelectedNodeDetail(dataDetail.node);
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchContentsAndDetail();
    } else {
      setNodeContents(null);
      setSelectedNodeDetail(null);
    }
  }, [selectedNode]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('agentcache_token');
      if (!token) return;
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          fetchNodes(token, currentParentId);
        } else {
          localStorage.removeItem('agentcache_token');
        }
      } catch (e) {
        console.error(e);
      }
    };
    checkAuth();
  }, [currentParentId]);

  const fetchNodes = async (token, parentId = null) => {
    try {
      const url = parentId ? `/api/nodes?parentId=${parentId}` : '/api/nodes';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
      }
    } catch (e) {
      console.error("Failed to fetch nodes", e);
    }
  };

  const handleNavigateDown = (nodeId, nodeName) => {
    setCurrentParentId(nodeId);
    setBreadcrumb(prev => [...prev, { id: nodeId, name: nodeName }]);
  };

  const handleNavigateUp = (index) => {
    const newCrumb = breadcrumb[index];
    setBreadcrumb(breadcrumb.slice(0, index + 1));
    setCurrentParentId(newCrumb.id);
  };

  if (!user) {
    return <LoginModal onLoginSuccess={(u) => { setUser(u); fetchNodes(localStorage.getItem('agentcache_token')); }} />;
  }

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-base)' }}>
      
      {/* LEFT SIDEBAR (Simplified for Canvas Mode) */}
      <aside className="sidebar" style={{ width: '240px', display: 'flex', flexDirection: 'column' }}>
        <div className="brand">
          <div className="logo-icon"><Box size={20} /></div>
          <span className="logo-text">AgentCache</span>
        </div>

        <nav className="main-nav">
          <a href="#" className="nav-item"><Search size={16} /> Search</a>
          <a href="#" className="nav-item"><Inbox size={16} /> Inbox <span className="badge">3</span></a>
          <a href="#" className="nav-item active"><FolderIcon size={16} /> Workspaces</a>
        </nav>

        <div style={{ padding: '24px', flex: 1 }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Welcome to the Visual Editor. Drag folders, connect them to route data, and click them to assign intelligent actions.
          </p>
        </div>

        <div className="sidebar-footer">
          <a href="#" className="nav-item" onClick={(e) => { e.preventDefault(); setShowSettings(true); }}><SettingsIcon size={16} /> Settings</a>
          <div className="user-profile">
            <div className="avatar">{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
            <div className="user-info">
              <span className="user-name">{user.name || user.email}</span>
              <span className="user-role">Connected</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CANVAS AREA */}
      <main style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '8px', alignItems: 'center', zIndex: 10 }}>
          <FolderIcon size={16} color="var(--text-muted)" />
          {breadcrumb.map((crumb, idx) => (
            <React.Fragment key={crumb.id || 'root'}>
              <span 
                style={{ cursor: 'pointer', color: idx === breadcrumb.length - 1 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: idx === breadcrumb.length - 1 ? 500 : 400 }}
                onClick={() => handleNavigateUp(idx)}
              >
                {crumb.name}
              </span>
              {idx < breadcrumb.length - 1 && <span style={{ color: 'var(--border-color)' }}>/</span>}
            </React.Fragment>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <Canvas 
            onNodeSelect={setSelectedNode} 
            selectedNode={selectedNode}
            nodeContents={nodeContents}
            initialApiNodes={nodes} 
            currentParentId={currentParentId}
            onNavigateDown={handleNavigateDown}
            onRefresh={() => fetchNodes(localStorage.getItem('agentcache_token'), currentParentId)}
          />
        </div>
      </main>

      {/* SLIDE OUT SETTINGS PANEL */}
      <aside className="right-panel" style={{ 
        width: '400px', 
        borderLeft: '1px solid var(--border-color)',
        background: 'var(--bg-surface)',
        transform: selectedNode ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {selectedNode && (
          <>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                {selectedNode.data.hasAction ? <Zap size={18} color="var(--accent-amber)" /> : <FolderIcon size={18} />}
                {selectedNode.data.label}
              </h3>
              <button className="icon-btn" onClick={() => setSelectedNode(null)}><X size={18} /></button>
            </div>
            
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
              <div className="settings-section" style={{ marginBottom: '24px' }}>
                <h4 className="section-title">Intelligent Actions</h4>
                {selectedNode.data.hasAction ? (
                  <div className="glass-panel" style={{ padding: '16px', borderColor: 'var(--accent-amber)' }}>
                    <div style={{ color: 'var(--accent-amber)', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>
                      <Zap size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                      Installed: {selectedNode.data.actionName}
                    </div>
                    <button className="btn-outline" style={{ marginTop: '12px', width: '100%' }}>Configure Template</button>
                    <button className="btn-outline" style={{ marginTop: '8px', width: '100%', borderColor: 'rgba(255,85,85,0.3)', color: '#ff5555' }}>Remove Action</button>
                  </div>
                ) : (
                  <button className="btn-primary" style={{ width: '100%' }} onClick={() => setShowGallery(true)}>
                    <Zap size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '8px' }}/> Assign Action
                  </button>
                )}
              </div>

              <div className="settings-section">
                <h4 className="section-title">Directory Guidance</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Write instructions for agents operating in this folder.
                </p>
                <textarea 
                  key={`prompt-${selectedNode.id}`}
                  defaultValue={selectedNodeDetail?.memory_context?.instructions || ''}
                  placeholder="e.g. Rename all dropped files to YYYY-MM-DD format and move PDFs to Archive."
                  style={{
                    width: '100%',
                    minHeight: '120px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    resize: 'vertical'
                  }}
                  onBlur={async (e) => {
                    const text = e.target.value;
                    const token = localStorage.getItem('agentcache_token');
                    try {
                      await fetch('/api/nodes?action=update', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                          nodeId: selectedNode.id,
                          memoryContext: { ...selectedNodeDetail?.memory_context, instructions: text }
                        })
                      });
                    } catch (err) {
                      console.error("Failed to save instructions", err);
                    }
                  }}
                />
              </div>
            </div>
          </>
        )}
      </aside>
      
      {showSettings && <SettingsModal user={user} onClose={() => setShowSettings(false)} />}
      {showGallery && selectedNode && (
        <TemplateGallery 
          targetNodeId={selectedNode.id} 
          onClose={() => setShowGallery(false)}
          onInstall={() => fetchNodes(localStorage.getItem('agentcache_token'), currentParentId)}
        />
      )}
    </div>
  );
}
