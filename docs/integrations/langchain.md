# LangChain Integration

AgentCache can be used as a custom LLM Cache or Tool in LangChain.

## Python

### Custom Cache
```python
from langchain.cache import BaseCache
from agentcache import AgentCache

class AgentCacheLangChain(BaseCache):
    def __init__(self):
        self.client = AgentCache()

    def lookup(self, prompt, llm_string):
        return self.client.get(f"{llm_string}:{prompt}")

    def update(self, prompt, llm_string, return_val):
        self.client.set(f"{llm_string}:{prompt}", return_val)

import langchain
langchain.llm_cache = AgentCacheLangChain()
```

## Node.js

### Custom Tool
```javascript
import { DynamicTool } from "langchain/tools";
import { agentcache } from "agentcache";

const cacheTool = new DynamicTool({
  name: "cache_search",
  description: "Check if we have a cached answer",
  func: async (input) => {
    return await agentcache.get(input) || "MISS";
  },
});
```
