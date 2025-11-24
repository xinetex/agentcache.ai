/**
 * AgentCache Standard - HTTP Client
 */

import { AgentCacheError } from './types';

export class HttpClient {
  private apiKey: string;
  private endpoint: string;
  private namespace?: string;
  private timeout: number;

  constructor(
    apiKey: string,
    endpoint: string = 'https://agentcache.ai',
    namespace?: string,
    timeout: number = 10000
  ) {
    this.apiKey = apiKey;
    this.endpoint = endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.namespace = namespace;
    this.timeout = timeout;
  }

  async post<T = any>(path: string, data: any): Promise<T> {
    const url = `${this.endpoint}${path}`;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      };

      // Add namespace header if provided
      if (this.namespace) {
        headers['X-Cache-Namespace'] = this.namespace;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorDetails = null;

        try {
          const errorBody = await response.json() as any;
          errorMessage = errorBody.error || errorMessage;
          errorDetails = errorBody.details || errorBody;
        } catch {
          // If error response is not JSON, use status text
          errorMessage = await response.text() || errorMessage;
        }

        throw new AgentCacheError(errorMessage, response.status, errorDetails);
      }

      const result = await response.json() as any;
      
      // Add latency to result if not already present
      if (result && typeof result === 'object' && !result.latency) {
        result.latency = latency;
      }

      return result as T;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new AgentCacheError(
          `Request timeout after ${this.timeout}ms`,
          408
        );
      }

      if (error instanceof AgentCacheError) {
        throw error;
      }

      // Network or other errors
      throw new AgentCacheError(
        `Network error: ${error.message}`,
        0,
        error
      );
    }
  }

  async get<T = any>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.endpoint}${path}`);
    
    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const headers: Record<string, string> = {
        'X-API-Key': this.apiKey,
      };

      if (this.namespace) {
        headers['X-Cache-Namespace'] = this.namespace;
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorBody = await response.json() as any;
          errorMessage = errorBody.error || errorMessage;
        } catch {
          errorMessage = await response.text() || errorMessage;
        }
        throw new AgentCacheError(errorMessage, response.status);
      }

      return await response.json() as T;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new AgentCacheError(
          `Request timeout after ${this.timeout}ms`,
          408
        );
      }

      if (error instanceof AgentCacheError) {
        throw error;
      }

      throw new AgentCacheError(
        `Network error: ${error.message}`,
        0,
        error
      );
    }
  }
}
