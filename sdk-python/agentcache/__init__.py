import os
import hashlib
import json
import requests
from typing import List, Dict, Optional, Union, Any

class AgentCache:
    def __init__(self, api_key: str = None, base_url: str = "https://agentcache.ai"):
        self.api_key = api_key or os.environ.get("AGENTCACHE_API_KEY")
        if not self.api_key:
            raise ValueError("API key must be provided or set in AGENTCACHE_API_KEY environment variable")
        self.base_url = base_url

    def _headers(self):
        return {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key
        }

    def completion(self, 
                  model: str, 
                  messages: List[Dict[str, str]], 
                  provider: str = "openai",
                  temperature: float = 0.7,
                  stream: bool = False) -> Union[Dict, Any]:
        """
        Get a cached response or return a miss.
        mimics openai.chat.completions.create()
        """
        payload = {
            "provider": provider,
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "stream": stream
        }
        
        # 1. Check Cache
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
            temperature: float = 0.7):
        """
        Store a response in the cache
        """
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
