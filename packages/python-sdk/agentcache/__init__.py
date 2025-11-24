"""
AgentCache Python SDK
~~~~~~~~~~~~~~~~~~~~~

The official Python client for AgentCache - Lightning-fast caching for AI agents.

Basic usage:

   >>> from agentcache import AgentCache
   >>> cache = AgentCache(api_key="ac_live_...")
   >>> result = cache.get_or_set("my_key", lambda: expensive_llm_call())

:copyright: (c) 2025 by AgentCache.
:license: MIT, see LICENSE for more details.
"""

from .client import AgentCache
from .exceptions import AgentCacheError, AuthenticationError, RateLimitError

__version__ = "0.1.0"
__all__ = ["AgentCache", "AgentCacheError", "AuthenticationError", "RateLimitError"]
