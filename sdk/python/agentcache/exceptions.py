"""Exception classes for AgentCache SDK."""


class AgentCacheError(Exception):
    """Base exception for all AgentCache errors."""
    
    def __init__(self, message: str, status_code: int = None, response: dict = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(self.message)


class AuthenticationError(AgentCacheError):
    """Raised when API key is invalid or missing."""
    
    def __init__(self, message: str = "Invalid or missing API key"):
        super().__init__(message, status_code=401)


class RateLimitError(AgentCacheError):
    """Raised when API rate limit is exceeded."""
    
    def __init__(self, message: str = "Rate limit exceeded", retry_after: int = None):
        super().__init__(message, status_code=429)
        self.retry_after = retry_after


class ValidationError(AgentCacheError):
    """Raised when request validation fails."""
    
    def __init__(self, message: str = "Invalid request parameters"):
        super().__init__(message, status_code=400)


class NotFoundError(AgentCacheError):
    """Raised when requested resource is not found."""
    
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)


class ServerError(AgentCacheError):
    """Raised when server encounters an error."""
    
    def __init__(self, message: str = "Internal server error"):
        super().__init__(message, status_code=500)


class TimeoutError(AgentCacheError):
    """Raised when request times out."""
    
    def __init__(self, message: str = "Request timeout"):
        super().__init__(message, status_code=408)


class NetworkError(AgentCacheError):
    """Raised when network connection fails."""
    
    def __init__(self, message: str = "Network connection failed"):
        super().__init__(message)
