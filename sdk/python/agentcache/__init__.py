"""
AgentCache Python SDK
~~~~~~~~~~~~~~~~~~~~~

Python client library for AgentCache.ai cognitive caching platform.

Usage:
    >>> from agentcache import AgentCache, Sector
    >>> cache = AgentCache(api_key="sk_live_...", sector=Sector.HEALTHCARE)
    >>> response = await cache.query("What is HIPAA compliance?")
    >>> print(response.result)

For more information, see: https://docs.agentcache.ai
"""

from .client import AgentCache
from .types import (
    Sector,
    CacheResponse,
    QueryRequest,
    PipelineConfig,
    ComplianceFramework,
)
from .exceptions import (
    AgentCacheError,
    AuthenticationError,
    RateLimitError,
    ValidationError,
)

__version__ = "0.1.0"
__all__ = [
    "AgentCache",
    "Sector",
    "CacheResponse",
    "QueryRequest",
    "PipelineConfig",
    "ComplianceFramework",
    "AgentCacheError",
    "AuthenticationError",
    "RateLimitError",
    "ValidationError",
]
