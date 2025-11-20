import os
import hashlib
import json
import requests
from typing import List, Dict, Optional, Union, Any
from .strategies.reasoning import ReasoningCache
from .strategies.multimodal import MultimodalCache

class AgentCache:
    def __init__(self, api_key: str = None, base_url: str = "https://agentcache.ai"):
        self.api_key = api_key or os.environ.get("AGENTCACHE_API_KEY")
        if not self.api_key:
            raise ValueError("API key must be provided or set in AGENTCACHE_API_KEY environment variable")
        self.base_url = base_url
        self.reasoning_cache = ReasoningCache()
        self.multimodal_cache = MultimodalCache()

    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key
        }

    def completion(self, 
                  model: str, 
                  messages: List[Dict[str, str]], 
                  provider: str = "openai",
                  temperature: float = 0.7,
                  stream: bool = False,
                  strategy: str = "standard") -> Union[Dict, Any]:
        """
        Get a cached response or return a miss.
        mimics openai.chat.completions.create()
        
        Args:
            strategy: "standard" (default), "reasoning_cache", or "multimodal"
        """
        
        # Handle Reasoning Cache Strategy
        if strategy == "reasoning_cache":
            # Create context from messages/model
            context = {
                "model": model,
                "provider": provider,
                "messages": messages,
                "temperature": temperature
            }
            
            # Try to retrieve from reasoning cache
            # Pass self.completion as the verification function (Critic)
            # We use strategy="standard" to avoid infinite recursion
            def critic_fn(**kwargs):
                kwargs["strategy"] = "standard"
                return self.completion(**kwargs)

            cached_state = self.reasoning_cache.retrieve_reasoning(context, completion_fn=critic_fn)
            if cached_state:
                return {
                    "choices": [{
                        "message": {
                            "content": "\n".join(cached_state.reasoning_trace),
                            "role": "assistant"
                        }
                    }],
                    "cached": True,
                    "reasoning_trace": cached_state.reasoning_trace
                }
            
            # If miss, we would normally call the LLM here.
            # For the SDK wrapper, we return None to indicate miss, 
            # and the user would call the LLM and then call set()
            return None

        # Handle Multimodal Cache Strategy
        if strategy == "multimodal":
            # Extract file path if present in messages (convention: {"role": "user", "file_path": "..."})
            # Or user can pass it in a custom way, but for now we'll look for a 'file_path' key in the last message
            file_path = None
            if messages and "file_path" in messages[-1]:
                file_path = messages[-1]["file_path"]

            context = {
                "model": model,
                "messages": messages,
                "file_path": file_path
            }
            
            cached_asset = self.multimodal_cache.retrieve_asset(context)
            if cached_asset:
                return {
                    "choices": [{
                        "message": {
                            "content": "Cached Asset Retrieved",
                            "role": "assistant",
                            "data": cached_asset # Return the actual object
                        }
                    }],
                    "cached": True,
                    "asset": cached_asset
                }
            return None

        payload = {
            "provider": provider,
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream
        }
        
        # 1. Check Standard Cache
        try:
            response = requests.post(
                f"{self.base_url}/api/cache/get",
                headers=self._headers(),
                json=payload,
                stream=stream
            )
            
            if response.status_code == 200:
                if stream:
                    return self._stream_response(response)
                return response.json()
                
        except Exception as e:
            print(f"AgentCache Error: {e}")
            # Fail open logic would go here (return a special object indicating miss)
            return None

        return None

    def _stream_response(self, response):
        """Generator for streaming SSE events"""
        for line in response.iter_lines():
            if line:
                decoded = line.decode('utf-8')
                if decoded.startswith('data: '):
                    data = decoded[6:]
                    if data == '[DONE]':
                        break
                    try:
                        yield json.loads(data)
                    except:
                        pass

    def set(self, 
            model: str, 
            messages: List[Dict[str, str]], 
            response: str,
            provider: str = "openai",
            temperature: float = 0.7,
            strategy: str = "standard",
            reasoning_trace: List[str] = None,
            multimodal_data: Any = None):
        """
        Store a response in the cache
        """
        
        if strategy == "multimodal" and multimodal_data:
            file_path = None
            if messages and "file_path" in messages[-1]:
                file_path = messages[-1]["file_path"]

            context = {
                "model": model,
                "messages": messages,
                "file_path": file_path
            }
            self.multimodal_cache.cache_asset(context, multimodal_data)
            return True
        
        if strategy == "reasoning_cache" and reasoning_trace:
            context = {
                "model": model,
                "provider": provider,
                "messages": messages,
                "temperature": temperature
            }
            # Cache in local reasoning cache
            self.reasoning_cache.cache_reasoning(
                context=context,
                reasoning_trace=reasoning_trace,
                intermediate_values={},
                confidence=1.0 # Assume high confidence if user is setting it
            )
            return True

        payload = {
            "provider": provider,
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "response": response
        }
        
        try:
            requests.post(
                f"{self.base_url}/api/cache/set",
                headers=self._headers(),
                json=payload
            )
            return True
        except Exception as e:
            print(f"AgentCache Set Error: {e}")
            return False

# Convenience instance
_client = None

def completion(*args, **kwargs):
    global _client
    if not _client:
        _client = AgentCache()
    return _client.completion(*args, **kwargs)

def set(*args, **kwargs):
    global _client
    if not _client:
        _client = AgentCache()
    return _client.set(*args, **kwargs)
