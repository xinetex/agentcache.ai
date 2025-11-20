import os
import json
import sys
# Ensure local sdk-python is in path
sys.path.insert(0, os.path.abspath("sdk-python"))

import agentcache
print(f"DEBUG: agentcache file: {agentcache.__file__}")

from agentcache import AgentCache
from agentcache.strategies.reasoning import ReasoningState
from datetime import datetime

# Mock AgentCache to intercept completion calls
class MockAgentCache(AgentCache):
    def __init__(self):
        super().__init__(api_key="test")
        self.completion_calls = []

    def completion(self, **kwargs):
        self.completion_calls.append(kwargs)
        # Mock Critic Response
        messages = kwargs.get("messages", [])
        if messages and messages[0]["role"] == "system":
            # This is a critic call
            user_msg = messages[1]["content"]
            # print(f"DEBUG: Critic Prompt: {user_msg}") 
            if "Problem A: Write a python script" in user_msg and "Problem B: Write a python script to scrape" in user_msg:
                return {"choices": [{"message": {"content": "NO"}}]} # Critic says NO
            if "Problem A: Write a python script" in user_msg and "Problem B: Write a python script" in user_msg:
                 return {"choices": [{"message": {"content": "YES"}}]} # Critic says YES
            print(f"DEBUG: Critic Mock Missed! Prompt: {user_msg}")
        return None

def test_cheap_critic():
    print("🧪 Testing The Cheap Critic...")
    
    client = MockAgentCache()
    
    # 1. Seed Cache with a "Python Script" reasoning trace
    context_original = {
        "model": "o1-preview",
        "provider": "openai",
        "messages": [{"role": "user", "content": "Write a python script"}],
        "temperature": 0.7
    }
    # Ensure keys order matches what AgentCache might produce if we want to be sure, 
    # but sort_keys=True in hash function should handle it.
    
    hash_original = client.reasoning_cache._compute_context_hash(context_original)
    print(f"DEBUG: Original Hash: {hash_original}")

    client.reasoning_cache.cache_reasoning(
        context=context_original,
        reasoning_trace=["Step 1: Import sys", "Step 2: Print hello"],
        intermediate_values={},
        confidence=1.0
    )
    
    # 2. Test Exact Match (Should NOT call Critic)
    print("\n1️⃣  Testing Exact Match (Fast Path)...")
    client.completion_calls = []
    result = client.completion(
        model="o1-preview",
        messages=[{"role": "user", "content": "Write a python script"}],
        strategy="reasoning_cache"
    )
    
    if result and result.get("cached"):
        print("✅ Exact match found")
    else:
        print("❌ Exact match failed")
        
    if len(client.completion_calls) == 0:
        print("✅ Critic was NOT called (Optimization works)")
    else:
        print(f"❌ Error: Critic called {len(client.completion_calls)} times")

    # 3. Test Similar Match - Invalid (Should call Critic -> NO)
    print("\n2️⃣  Testing Similar Match (Critic Rejection)...")
    client.completion_calls = []
    # "Write a python script to scrape" is similar to "Write a python script" but different intent
    result = client.completion(
        model="o1-preview",
        messages=[{"role": "user", "content": "Write a python script to scrape"}],
        strategy="reasoning_cache"
    )
    
    if result is None:
        print("✅ Cache Miss (Critic correctly rejected)")
    else:
        print("❌ Error: Critic accepted invalid match")
        
    if len(client.completion_calls) > 0:
        print("✅ Critic was called")
    else:
        print("❌ Error: Critic was NOT called")

if __name__ == "__main__":
    test_cheap_critic()
