import BaseNode from './BaseNode';

function CacheL1Node({ data }) {
  return (
    <BaseNode
      data={data}
      icon="💾"
      color="#10b981"
      handles={{ input: true, output: true, miss: true }}
    />
  );
}

export default CacheL1Node;
