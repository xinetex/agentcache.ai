import BaseNode from './BaseNode.jsx';

function InputNode({ data }) {
  return (
    <BaseNode
      data={data}
      icon="🎯"
      color="#3b82f6"
      handles={{ input: false, output: true }}
    />
  );
}

export default InputNode;
