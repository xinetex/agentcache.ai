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
    <aside className="w-[280px] bg-slate-800 border-r border-slate-700 flex flex-col overflow-y-auto">
      <div className="p-6 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-slate-100 mb-1">Node Library</h2>
        <p className="text-sm text-slate-400">Drag nodes to canvas</p>
      </div>

      <div className="p-4">
        {nodeCategories.map((category) => (
          <div key={category.title} className="mb-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{category.title}</h3>
            <div className="flex flex-col gap-2">
              {category.nodes.map((node) => (
                <div
                  key={node.type}
                  className="flex items-center gap-3 p-3 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700 rounded-xl cursor-grab transition-all duration-300 relative overflow-hidden hover:from-slate-800 hover:to-slate-900 hover:border-sky-500 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-lg hover:shadow-sky-500/20 active:cursor-grabbing active:scale-95 group"
                  draggable
                  onDragStart={(e) => onDragStart(e, node.type)}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-500/10 to-transparent -translate-x-full transition-transform duration-500 group-hover:translate-x-full pointer-events-none" />
                  <span className="text-xl">{node.icon}</span>
                  <span className="flex-1 text-sm font-medium text-slate-200">{node.label}</span>
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
