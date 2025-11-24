"""
AgentCache Exceptions
~~~~~~~~~~~~~~~~~~~~~

Exception classes for AgentCache SDK.
"""


class AgentCacheError(Exception):
    """Base exception for all AgentCache errors."""
    pass


class AuthenticationError(AgentCacheError):
    """Raised when API key is invalid or missing."""
    pass


class RateLimitError(AgentCacheError):
    """Raised when rate limit is exceeded."""
    pass
