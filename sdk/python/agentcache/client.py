"""Core AgentCache client implementation."""

import os
import time
from typing import Any, Dict, List, Optional, Union
from urllib.parse import urljoin

import httpx
from httpx import AsyncClient, Client

from .types import (
    CacheResponse,
    PipelineConfig,
    QueryRequest,
    Sector,
    WebhookConfig,
    ComplianceFramework,
)
from .exceptions import (
    AuthenticationError,
    RateLimitError,
    ValidationError,
    NotFoundError,
    ServerError,
    TimeoutError,
    NetworkError,
    AgentCacheError,
)


class AgentCache:
    """
    AgentCache client for cognitive caching.
    
    Usage:
        >>> cache = AgentCache(api_key="sk_live_...", sector=Sector.HEALTHCARE)
        >>> response = await cache.query("What is HIPAA?")
        >>> print(response.result)
    
    Args:
        api_key: Your AgentCache API key (or set AGENTCACHE_API_KEY env var)
        base_url: API base URL (default: https://agentcache.ai)
        sector: Default sector for queries (optional)
        compliance: Default compliance frameworks (optional)
        timeout: Request timeout in seconds (default: 30)
        max_retries: Maximum retry attempts (default: 3)
        namespace: Namespace for multi-tenant isolation (optional)
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://agentcache.ai",
        sector: Optional[Sector] = None,
        compliance: Optional[List[ComplianceFramework]] = None,
        timeout: int = 30,
        max_retries: int = 3,
        namespace: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("AGENTCACHE_API_KEY")
        if not self.api_key:
            raise AuthenticationError(
                "API key required. Pass api_key or set AGENTCACHE_API_KEY env var."
            )
        
        self.base_url = base_url.rstrip("/")
        self.sector = sector
        self.compliance = compliance
        self.timeout = timeout
        self.max_retries = max_retries
        self.namespace = namespace
        
        self._client: Optional[Client] = None
        self._async_client: Optional[AsyncClient] = None
    
    @property
    def client(self) -> Client:
        """Get or create synchronous HTTP client."""
        if self._client is None:
            self._client = Client(
                headers=self._get_headers(),
                timeout=self.timeout,
            )
        return self._client
    
    @property
    def async_client(self) -> AsyncClient:
        """Get or create async HTTP client."""
        if self._async_client is None:
            self._async_client = AsyncClient(
                headers=self._get_headers(),
                timeout=self.timeout,
            )
        return self._async_client
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with auth."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "agentcache-python/0.1.0",
        }
    
    def _build_url(self, path: str) -> str:
        """Build full URL from path."""
        return urljoin(self.base_url, path.lstrip("/"))
    
    def _handle_error(self, response: httpx.Response) -> None:
        """Handle HTTP error responses."""
        try:
            error_data = response.json()
            message = error_data.get("error", response.text)
        except Exception:
            message = response.text
        
        if response.status_code == 401:
            raise AuthenticationError(message)
        elif response.status_code == 429:
            retry_after = response.headers.get("Retry-After")
            raise RateLimitError(
                message,
                retry_after=int(retry_after) if retry_after else None
            )
        elif response.status_code == 400:
            raise ValidationError(message)
        elif response.status_code == 404:
            raise NotFoundError(message)
        elif response.status_code >= 500:
            raise ServerError(message)
        else:
            raise AgentCacheError(message, status_code=response.status_code)
    
    def _retry_request(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> httpx.Response:
        """Execute request with retry logic."""
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                response = self.client.request(method, url, **kwargs)
                
                # Don't retry on client errors (except rate limit)
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    self._handle_error(response)
                    return response
                
                # Retry on rate limit or server error
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt < self.max_retries - 1:
                        # Exponential backoff
                        wait_time = 2 ** attempt
                        if response.status_code == 429:
                            retry_after = response.headers.get("Retry-After")
                            if retry_after:
                                wait_time = int(retry_after)
                        time.sleep(wait_time)
                        continue
                    else:
                        self._handle_error(response)
                
                response.raise_for_status()
                return response
                
            except httpx.TimeoutException as e:
                last_exception = TimeoutError(f"Request timeout after {self.timeout}s")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
            except httpx.NetworkError as e:
                last_exception = NetworkError(f"Network error: {str(e)}")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)
                    continue
            except Exception as e:
                last_exception = AgentCacheError(f"Unexpected error: {str(e)}")
                break
        
        if last_exception:
            raise last_exception
        raise AgentCacheError("Request failed after retries")
    
    async def _retry_request_async(
        self,
        method: str,
        url: str,
        **kwargs
    ) -> httpx.Response:
        """Execute async request with retry logic."""
        import asyncio
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                response = await self.async_client.request(method, url, **kwargs)
                
                if 400 <= response.status_code < 500 and response.status_code != 429:
                    self._handle_error(response)
                    return response
                
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt < self.max_retries - 1:
                        wait_time = 2 ** attempt
                        if response.status_code == 429:
                            retry_after = response.headers.get("Retry-After")
                            if retry_after:
                                wait_time = int(retry_after)
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        self._handle_error(response)
                
                response.raise_for_status()
                return response
                
            except httpx.TimeoutException:
                last_exception = TimeoutError(f"Request timeout after {self.timeout}s")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
            except httpx.NetworkError as e:
                last_exception = NetworkError(f"Network error: {str(e)}")
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                    continue
            except Exception as e:
                last_exception = AgentCacheError(f"Unexpected error: {str(e)}")
                break
        
        if last_exception:
            raise last_exception
        raise AgentCacheError("Request failed after retries")
    
    def query(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None,
        sector: Optional[Sector] = None,
        compliance: Optional[List[ComplianceFramework]] = None,
        namespace: Optional[str] = None,
    ) -> CacheResponse:
        """
        Query the cache (synchronous).
        
        Args:
            prompt: The query prompt
            context: Additional context
            metadata: Custom metadata
            ttl: Time-to-live override (seconds)
            sector: Sector override
            compliance: Compliance framework override
            namespace: Namespace override
        
        Returns:
            CacheResponse with result and metrics
        """
        request_data = {
            "prompt": prompt,
            "context": context,
            "metadata": metadata,
            "ttl": ttl,
            "sector": (sector or self.sector).value if (sector or self.sector) else None,
            "compliance": [c.value for c in (compliance or self.compliance or [])],
            "namespace": namespace or self.namespace,
        }
        
        # Remove None values
        request_data = {k: v for k, v in request_data.items() if v is not None}
        
        url = self._build_url("/api/cache/query")
        response = self._retry_request("POST", url, json=request_data)
        
        return CacheResponse(**response.json())
    
    async def query_async(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ttl: Optional[int] = None,
        sector: Optional[Sector] = None,
        compliance: Optional[List[ComplianceFramework]] = None,
        namespace: Optional[str] = None,
    ) -> CacheResponse:
        """Query the cache (async)."""
        request_data = {
            "prompt": prompt,
            "context": context,
            "metadata": metadata,
            "ttl": ttl,
            "sector": (sector or self.sector).value if (sector or self.sector) else None,
            "compliance": [c.value for c in (compliance or self.compliance or [])],
            "namespace": namespace or self.namespace,
        }
        
        request_data = {k: v for k, v in request_data.items() if v is not None}
        
        url = self._build_url("/api/cache/query")
        response = await self._retry_request_async("POST", url, json=request_data)
        
        return CacheResponse(**response.json())
    
    def invalidate(self, cache_key: str) -> bool:
        """Invalidate a cache entry."""
        url = self._build_url(f"/api/cache/invalidate/{cache_key}")
        response = self._retry_request("DELETE", url)
        return response.status_code == 200
    
    async def invalidate_async(self, cache_key: str) -> bool:
        """Invalidate a cache entry (async)."""
        url = self._build_url(f"/api/cache/invalidate/{cache_key}")
        response = await self._retry_request_async("DELETE", url)
        return response.status_code == 200
    
    def get_pipeline(self, pipeline_id: str) -> PipelineConfig:
        """Get pipeline configuration."""
        url = self._build_url(f"/api/pipelines/{pipeline_id}")
        response = self._retry_request("GET", url)
        return PipelineConfig(**response.json())
    
    async def get_pipeline_async(self, pipeline_id: str) -> PipelineConfig:
        """Get pipeline configuration (async)."""
        url = self._build_url(f"/api/pipelines/{pipeline_id}")
        response = await self._retry_request_async("GET", url)
        return PipelineConfig(**response.json())
    
    def create_webhook(self, webhook: WebhookConfig) -> Dict[str, Any]:
        """Create a webhook subscription."""
        url = self._build_url("/api/webhooks")
        response = self._retry_request("POST", url, json=webhook.model_dump())
        return response.json()
    
    async def create_webhook_async(self, webhook: WebhookConfig) -> Dict[str, Any]:
        """Create a webhook subscription (async)."""
        url = self._build_url("/api/webhooks")
        response = await self._retry_request_async("POST", url, json=webhook.model_dump())
        return response.json()
    
    def close(self) -> None:
        """Close HTTP clients."""
        if self._client:
            self._client.close()
        if self._async_client:
            import asyncio
            asyncio.create_task(self._async_client.aclose())
    
    def __enter__(self):
        """Context manager entry."""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self._async_client:
            await self._async_client.aclose()
