import BaseNode from './BaseNode.jsx';

function CacheL2Node({ data }) {
  return (
    <BaseNode
      data={data}
      icon="📦"
      color="#059669"
      handles={{ input: true, output: true, miss: true }}
    />
  );
}

export default CacheL2Node;
