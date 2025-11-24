"""
AgentCache Python SDK - Quick Start Example
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

This example shows how to integrate AgentCache in 5 lines.
"""

from agentcache import AgentCache
import os

# Initialize client
api_key = os.getenv("AGENTCACHE_API_KEY", "ac_demo_test")
cache = AgentCache(
    api_key=api_key,
    base_url="http://localhost:3000"  # Use local dev server for testing
)

# Simulate an expensive LLM call
def expensive_llm_call(prompt: str) -> str:
    """Simulate a slow, expensive API call."""
    print(f"🔥 CACHE MISS - Computing result for: '{prompt}'")
    import time
    time.sleep(1)  # Simulate latency
    return f"Response to: {prompt}"

# Example 1: get_or_set (THE KEY METHOD)
print("=" * 60)
print("Example 1: get_or_set (Smart caching)")
print("=" * 60)

prompt = "What is the capital of France?"

print("\nFirst call (cache miss)...")
result1 = cache.get_or_set(
    prompt,
    lambda: expensive_llm_call(prompt),
    ttl=3600
)
print(f"✅ Result: {result1}")

print("\nSecond call (cache hit)...")
result2 = cache.get_or_set(
    prompt,
    lambda: expensive_llm_call(prompt),
    ttl=3600
)
print(f"⚡ Result: {result2}")

# Example 2: Model Routing
print("\n" + "=" * 60)
print("Example 2: Intelligent Model Routing")
print("=" * 60)

prompts_to_test = [
    "Hello, how are you?",
    "Write a Python function to sort a list",
    "Analyze the strategic implications of quantum computing on cryptography"
]

for p in prompts_to_test:
    try:
        route_info = cache.route(p)
        print(f"\n📝 Prompt: {p[:50]}...")
        print(f"   → Model: {route_info['model']}")
        print(f"   → Tier: {route_info['tier']}")
        print(f"   → Cost: ${route_info['estimatedCost']}/1M tokens")
    except Exception as e:
        print(f"   ⚠️ Routing not available: {e}")

# Example 3: Manual Cache Operations
print("\n" + "=" * 60)
print("Example 3: Manual Cache Operations")
print("=" * 60)

# Set a value
cache.set("user:123:name", "Alice", ttl=600)
print("✅ Set user:123:name = Alice")

# Get it back
name = cache.get("user:123:name")
print(f"✅ Get user:123:name = {name}")

# Invalidate
deleted = cache.invalidate("user:*")
print(f"✅ Invalidated {deleted} keys matching 'user:*'")

print("\n🎉 Quick Start Complete!")
print("Visit https://agentcache.ai/docs for more examples.")
