import BaseNode from './BaseNode.jsx';

function GeminiNode({ data }) {
  const config = {
    CacheL3Node: { icon: '🗄️', color: '#047857' },
    OpenAINode: { icon: '🤖', color: '#8b5cf6' },
    AnthropicNode: { icon: '🧠', color: '#7c3aed' },
    GeminiNode: { icon: '✨', color: '#a855f7' },
    SemanticDedupNode: { icon: '🔍', color: '#06b6d4' },
    OutputNode: { icon: '📤', color: '#3b82f6' }
  }['GeminiNode'];
  
  const handles = 'GeminiNode' === 'OutputNode' 
    ? { input: true, output: false }
    : { input: true, output: true };
    
  return <BaseNode data={data} {...config} handles={handles} />;
}

export default GeminiNode;
