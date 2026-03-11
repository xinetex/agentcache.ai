/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 * 
 * PROPRIETARY AND CONFIDENTIAL: 
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file, 
 * via any medium, is strictly prohibited.
 */
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
