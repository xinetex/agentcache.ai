import './Sidebar.css';

const NODE_INFO = {
  input: { label: 'Request Input', icon: '🎯' },
  cache_l1: { label: 'L1 Memory', icon: '💾' },
  cache_l2: { label: 'L2 Redis', icon: '📦' },
  cache_l3: { label: 'L3 PostgreSQL', icon: '🗄️' },
  semantic_dedup: { label: 'Semantic Dedup', icon: '🔍' },
  phi_filter: { label: 'PHI Filter', icon: '🔒' },
  fraud_detector: { label: 'Fraud Detector', icon: '🔎' },
  transaction_validator: { label: 'Transaction Validator', icon: '✅' },
  openai: { label: 'OpenAI GPT', icon: '🤖' },
  anthropic: { label: 'Anthropic Claude', icon: '🧠' },
  gemini: { label: 'Google Gemini', icon: '✨' },
  hipaa_audit: { label: 'HIPAA Audit', icon: '📋' },
  pci_audit: { label: 'PCI Audit', icon: '📊' },
  sox_logger: { label: 'SOX Logger', icon: '📝' },
  retention_policy: { label: 'Retention Policy', icon: '🗓️' },
  audit_logger: { label: 'Audit Logger', icon: '📝' },
  encrypted_cache: { label: 'Encrypted Cache', icon: '🔐' },
  output: { label: 'Response Output', icon: '📤' },
};

const CATEGORY_ICONS = {
  input: '🎯',
  cache: '💾',
  intelligence: '🧠',
  llm: '🤖',
  compliance: '🔒',
  output: '📤',
};

function Sidebar({ sector, config }) {
  const nodeCategories = (config?.nodes || []).map(({ category, types }) => ({
    title: `${CATEGORY_ICONS[category] || '•'} ${category.charAt(0).toUpperCase() + category.slice(1)}`,
    nodes: types.map(type => ({
      type,
      ...NODE_INFO[type]
    }))
  }));
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Node Library</h2>
        <p>Drag nodes to canvas</p>
      </div>

      <div className="node-categories">
        {nodeCategories.map((category) => (
          <div key={category.title} className="node-category">
            <h3>{category.title}</h3>
            <div className="node-list">
              {category.nodes.map((node) => (
                <div
                  key={node.type}
                  className="node-item"
                  draggable
                  onDragStart={(e) => onDragStart(e, node.type)}
                >
                  <span className="node-item-icon">{node.icon}</span>
                  <span className="node-item-label">{node.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export default Sidebar;
