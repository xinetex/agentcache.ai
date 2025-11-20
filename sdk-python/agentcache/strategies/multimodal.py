import hashlib
import json
import os
from typing import Dict, Any, Optional, Union

class MultimodalCache:
    """
    Strategy for caching generative assets (3D meshes, images, audio) 
    based on multimodal inputs (files + prompts).
    """
    def __init__(self):
        # In a real production SDK, this would interface with a local DB (SQLite) 
        # or the remote AgentCache API's blob store.
        # For this version, we use an in-memory dict to demonstrate the pattern 
        # as per the prototype.
        self._local_store: Dict[str, Any] = {}

    def _compute_hash(self, file_path: Optional[str], prompt: str) -> str:
        """
        Creates a deterministic hash from the input file content and prompt.
        """
        content = prompt
        
        if file_path:
            if os.path.exists(file_path):
                # Hash the actual file content for robustness
                with open(file_path, "rb") as f:
                    file_bytes = f.read()
                    file_hash = hashlib.sha256(file_bytes).hexdigest()
                    content += f":{file_hash}"
            else:
                # Fallback for URLs or non-existent files (just use path string)
                content += f":{file_path}"
        
        return hashlib.sha256(content.encode()).hexdigest()

    def retrieve_asset(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Retrieves a cached asset based on the context.
        Context must contain 'prompt' and optionally 'file_path'.
        """
        prompt = context.get("prompt", "")
        file_path = context.get("file_path")
        
        # Extract prompt from messages if not explicitly provided
        if not prompt and "messages" in context:
            # Naive extraction: join all content. 
            # In prod, we'd be more selective.
            prompt = "".join([m.get("content", "") for m in context["messages"]])

        key = self._compute_hash(file_path, prompt)
        return self._local_store.get(key)

    def cache_asset(self, context: Dict[str, Any], asset_data: Any):
        """
        Caches an asset.
        """
        prompt = context.get("prompt", "")
        file_path = context.get("file_path")
        
        if not prompt and "messages" in context:
            prompt = "".join([m.get("content", "") for m in context["messages"]])

        key = self._compute_hash(file_path, prompt)
        self._local_store[key] = asset_data
