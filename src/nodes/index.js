/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
import InputNode from './InputNode.jsx';
import CacheL1Node from './CacheL1Node.jsx';
import CacheL2Node from './CacheL2Node.jsx';
import CacheL3Node from './CacheL3Node.jsx';
import OpenAINode from './OpenAINode.jsx';
import AnthropicNode from './AnthropicNode.jsx';
import GeminiNode from './GeminiNode.jsx';
import SemanticDedupNode from './SemanticDedupNode.jsx';
import OutputNode from './OutputNode.jsx';

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
