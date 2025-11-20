import os
import json
from agentcache import AgentCache

def test_multimodal_cache():
    print("🧪 Testing Multimodal Cache Strategy...")
    
    # 1. Setup Mock Environment
    os.environ["AGENTCACHE_API_KEY"] = "test-key"
    client = AgentCache()
    
    # Create a dummy image file for testing
    with open("test_image.jpg", "wb") as f:
        f.write(b"fake_image_bytes")
    
    # 2. Define Context
    messages = [
        {"role": "user", "content": "Generate 3D model", "file_path": "test_image.jpg"}
    ]
    model = "sam-3d-body"
    
    # 3. Test Cache Miss (First Run)
    print("\n1️⃣  Testing Cache Miss...")
    response = client.completion(
        model=model,
        messages=messages,
        strategy="multimodal"
    )
    
    if response is None:
        print("✅ Cache Miss (Expected)")
    else:
        print("❌ Error: Expected Cache Miss, got Hit")
        return

    # 4. Simulate Generation & Cache Set
    print("\n2️⃣  Simulating Generation & Caching...")
    mock_3d_asset = {
        "vertices": [[0,1,0], [1,0,1]],
        "format": "obj"
    }
    
    success = client.set(
        model=model,
        messages=messages,
        response="", # Not used for multimodal
        strategy="multimodal",
        multimodal_data=mock_3d_asset
    )
    
    if success:
        print("✅ Asset Cached Successfully")
    else:
        print("❌ Failed to cache asset")
        return

    # 5. Test Cache Hit (Second Run)
    print("\n3️⃣  Testing Cache Hit...")
    response = client.completion(
        model=model,
        messages=messages,
        strategy="multimodal"
    )
    
    if response and response.get("cached") and response.get("asset") == mock_3d_asset:
        print("✅ Cache Hit! Asset retrieved correctly.")
    else:
        print(f"❌ Error: Expected Cache Hit with correct asset. Got: {response}")

    # Cleanup
    os.remove("test_image.jpg")

if __name__ == "__main__":
    test_multimodal_cache()
