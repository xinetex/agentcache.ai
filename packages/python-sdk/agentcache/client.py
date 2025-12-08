"""
AgentCache Client
~~~~~~~~~~~~~~~~~

Core client for interacting with the AgentCache API.
"""

import json
import hashlib
from typing import Any, Callable, Optional, Dict
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import quote_plus

from .exceptions import AgentCacheError, AuthenticationError, RateLimitError


class AgentCache:
    """Main client for AgentCache operations."""
    
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://agentcache-l5j1apqyd-drgnflai-jetty.vercel.app",
        timeout: int = 30
    ):
        """
        Initialize AgentCache client.
        
        Args:
            api_key: Your AgentCache API key (starts with 'ac_')
            base_url: API base URL (defaults to production)
            timeout: Request timeout in seconds
        """
        if not api_key or not api_key.startswith("ac_"):
            raise ValueError("Invalid API key. Must start with 'ac_'")
        
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
    
    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Any:
        """Make HTTP request to AgentCache API."""
        url = f"{self.base_url}{endpoint}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "agentcache-python/0.1.0"
        }
        
        body = json.dumps(data).encode("utf-8") if data else None
        req = Request(url, data=body, headers=headers, method=method)
        
        try:
            with urlopen(req, timeout=self.timeout) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as e:
            if e.code == 401:
                raise AuthenticationError("Invalid API key")
            elif e.code == 429:
                raise RateLimitError("Rate limit exceeded")
            else:
                raise AgentCacheError(f"API error: {e.code} {e.reason}")
    
    def get(self, key: str) -> Optional[str]:
        """
        Get cached value by key.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found
        """
        try:
            # URL-encode the key to handle spaces and special chars
            safe_key = quote_plus(key)
            # Use /api/cache/get?key=...
            result = self._request("GET", f"/api/cache/get?key={safe_key}")
            return result.get("value")
        except AgentCacheError:
            return None
    
    def set(self, key: str, value: str, ttl: int = 3600) -> bool:
        """
        Set cache value.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (default 1 hour)
            
        Returns:
            True if successful
        """
        self._request("POST", "/api/cache/set", {
            "key": key,
            "value": value,
            "ttl": ttl
        })
        return True
    
    def get_or_set(self, key: str, fn: Callable[[], str], ttl: int = 3600) -> str:
        """
        Get from cache or compute and cache the result.
        
        This is the main method you'll use. It handles cache misses automatically.
        
        Args:
            key: Cache key
            fn: Function to call if cache misses (should return a string)
            ttl: Time-to-live in seconds
            
        Returns:
            Cached or computed value
            
        Example:
            >>> result = cache.get_or_set(
            ...     "weather_sf",
            ...     lambda: get_weather("San Francisco")
            ... )
        """
        cached = self.get(key)
        if cached is not None:
            return cached
        
        # Cache miss - compute value
        value = fn()
        self.set(key, str(value), ttl)
        return value
    
    def invalidate(self, pattern: str = "*") -> int:
        """
        Invalidate cache entries matching pattern.
        
        Args:
            pattern: Pattern to match (supports wildcards)
            
        Returns:
            Number of keys invalidated
        """
        result = self._request("POST", "/api/cache/invalidate", {
            "pattern": pattern
        })
        return result.get("deleted", 0)
    
    def route(self, prompt: str) -> Dict[str, Any]:
        """
        Get optimal model routing for a prompt.
        
        Args:
            prompt: The prompt to analyze
            
        Returns:
            Dict with tier, model, reason, and estimatedCost
            
        Example:
            >>> route_info = cache.route("Solve this complex equation...")
            >>> print(f"Recommended: {route_info['model']}")
        """
        return self._request("POST", "/api/router/route", {
            "prompt": prompt
        })

    def compress(self, text: str, ratio: str = "16x") -> Dict[str, Any]:
        """
        Compress text using CLaRa-7B cognitive compression.
        
        Args:
            text: The text/document to compress
            ratio: Compression ratio ("16x", "32x", "128x")
            
        Returns:
            Dict containing 'compressed_text' and 'stats'
        """
        return self._request("POST", "/api/cognitive/compress", {
            "text": text,
            "compression_ratio": ratio
        })
