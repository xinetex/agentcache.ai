import sys
import os

# Add sdk-python to path
sys.path.append(os.path.join(os.getcwd(), "sdk-python"))

from agentcache import AgentCache

def test_reasoning_cache():
    print("Initializing AgentCache with Reasoning Strategy...")
    client = AgentCache(api_key="test_key")
    
    # 1. Define a problem context
    model = "o1-preview"
    messages = [{"role": "user", "content": "Solve 2x + 5 = 15"}]
    
    # 2. Define a reasoning trace (what o1 would output)
    trace = [
        "Subtract 5 from both sides: 2x = 10",
        "Divide by 2: x = 5",
        "Final Answer: x = 5"
    ]
    
    print("\n1. Caching reasoning trace...")
    success = client.set(
        model=model,
        messages=messages,
        response="x = 5", # Standard response
        strategy="reasoning_cache",
        reasoning_trace=trace
    )
    
    if success:
        print("✅ Trace cached successfully")
    else:
        print("❌ Failed to cache trace")
        return

    # 3. Retrieve it
    print("\n2. Retrieving from cache...")
    result = client.completion(
        model=model,
        messages=messages,
        strategy="reasoning_cache"
    )
    
    if result and result.get("cached"):
        print("✅ Cache Hit!")
        print(f"Trace length: {len(result['reasoning_trace'])}")
        print("Trace content:")
        for step in result['reasoning_trace']:
            print(f"  - {step}")
    else:
        print("❌ Cache Miss (Expected Hit)")

    # 4. Test Similarity (MVP uses set intersection)
    print("\n3. Testing Similarity Retrieval...")
    # Slightly different message
    messages_sim = [{"role": "user", "content": "Solve 2x + 5 = 15 please"}]
    
    result_sim = client.completion(
        model=model,
        messages=messages_sim,
        strategy="reasoning_cache"
    )
    
    if result_sim and result_sim.get("cached"):
        print("✅ Similarity Cache Hit!")
    else:
        print("❌ Similarity Cache Miss (Might be expected depending on threshold)")

if __name__ == "__main__":
    test_reasoning_cache()
