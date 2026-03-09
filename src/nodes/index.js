import InputNode from './InputNode.js';
import CacheL1Node from './CacheL1Node.js';
import CacheL2Node from './CacheL2Node.js';
import CacheL3Node from './CacheL3Node.js';
import OpenAINode from './OpenAINode.js';
import AnthropicNode from './AnthropicNode.js';
import GeminiNode from './GeminiNode.js';
import SemanticDedupNode from './SemanticDedupNode.js';
import OutputNode from './OutputNode.js';

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
