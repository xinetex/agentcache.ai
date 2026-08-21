// src/index.js — public surface of the AgentCache engine.
export { AgentCache } from './engine.js';
export { MemoryStore, RedisStore } from './store.js';
export {
  DEFAULT_PRICES,
  setPrices,
  getPrice,
  dollarsSaved,
  summarize,
} from './savings.js';
export {
  computePrefixReuse,
  planBreakpoints,
  estimateTokens,
} from './prefix-cache.js';
