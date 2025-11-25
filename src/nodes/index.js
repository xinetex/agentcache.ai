import InputNode from './InputNode';
import CacheL1Node from './CacheL1Node';
import CacheL2Node from './CacheL2Node';
import CacheL3Node from './CacheL3Node';
import OpenAINode from './OpenAINode';
import AnthropicNode from './AnthropicNode';
import GeminiNode from './GeminiNode';
import SemanticDedupNode from './SemanticDedupNode';
import OutputNode from './OutputNode';

export const nodeTypes = {
  input: InputNode,
  cache_l1: CacheL1Node,
  cache_l2: CacheL2Node,
  cache_l3: CacheL3Node,
  openai: OpenAINode,
  anthropic: AnthropicNode,
  gemini: GeminiNode,
  semantic_dedup: SemanticDedupNode,
  output: OutputNode,
};
