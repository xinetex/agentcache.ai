/**
 * Exception classes for AgentCache SDK
 */

/**
 * Base exception for all AgentCache errors
 */
export class AgentCacheError extends Error {
  public statusCode?: number;
  public response?: any;

  constructor(message: string, statusCode?: number, response?: any) {
    super(message);
    this.name = 'AgentCacheError';
    this.statusCode = statusCode;
    this.response = response;
    Object.setPrototypeOf(this, AgentCacheError.prototype);
  }
}

/**
 * Raised when API key is invalid or missing
 */
export class AuthenticationError extends AgentCacheError {
  constructor(message: string = 'Invalid or missing API key') {
    super(message, 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Raised when API rate limit is exceeded
 */
export class RateLimitError extends AgentCacheError {
  public retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Raised when request validation fails
 */
export class ValidationError extends AgentCacheError {
  constructor(message: string = 'Invalid request parameters') {
    super(message, 400);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Raised when requested resource is not found
 */
export class NotFoundError extends AgentCacheError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Raised when server encounters an error
 */
export class ServerError extends AgentCacheError {
  constructor(message: string = 'Internal server error') {
    super(message, 500);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * Raised when request times out
 */
export class TimeoutError extends AgentCacheError {
  constructor(message: string = 'Request timeout') {
    super(message, 408);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Raised when network connection fails
 */
export class NetworkError extends AgentCacheError {
  constructor(message: string = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}
