/**
 * Core AgentCache client implementation
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse } from 'axios';
import {
  AgentCacheConfig,
  CacheResponse,
  PipelineConfig,
  QueryRequest,
  Sector,
  WebhookConfig,
  ComplianceFramework,
  VerificationResponse,
} from './types';
import {
  AgentCacheError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  ServerError,
  TimeoutError,
  NetworkError,
} from './exceptions';

/**
 * AgentCache client for cognitive caching
 *
 * @example
 * ```typescript
 * import { AgentCache, Sector } from '@agentcache/sdk';
 *
 * const cache = new AgentCache({
 *   apiKey: 'sk_live_...',
 *   sector: Sector.HEALTHCARE
 * });
 *
 * const response = await cache.query('What is HIPAA?');
 * console.log(response.result);
 * ```
 */
export class AgentCache {
  private apiKey: string;
  private baseUrl: string;
  private sector?: Sector;
  private compliance?: ComplianceFramework[];
  private timeout: number;
  private maxRetries: number;
  private namespace?: string;
  private client: AxiosInstance;

  /**
   * Create a new AgentCache client
   *
   * @param config - Client configuration
   * @throws {AuthenticationError} If API key is missing
   */
  constructor(config: AgentCacheConfig) {
    this.apiKey = config.apiKey || process.env.AGENTCACHE_API_KEY || '';
    if (!this.apiKey) {
      throw new AuthenticationError(
        'API key required. Pass apiKey or set AGENTCACHE_API_KEY env var.'
      );
    }

    this.baseUrl = config.baseUrl || 'https://agentcache.ai';
    this.sector = config.sector;
    this.compliance = config.compliance;
    this.timeout = config.timeout || 30000; // 30 seconds
    this.maxRetries = config.maxRetries || 3;
    this.namespace = config.namespace;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': '@agentcache/sdk/0.1.0',
      },
    });
  }

  /**
   * Handle HTTP error responses
   */
  private handleError(error: AxiosError): never {
    const response = error.response;
    const message = response?.data?.error || error.message;

    if (!response) {
      if (error.code === 'ECONNABORTED') {
        throw new TimeoutError(`Request timeout after ${this.timeout}ms`);
      }
      throw new NetworkError(message);
    }

    switch (response.status) {
      case 401:
        throw new AuthenticationError(message);
      case 429:
        const retryAfter = response.headers['retry-after'];
        throw new RateLimitError(
          message,
          retryAfter ? parseInt(retryAfter) : undefined
        );
      case 400:
        throw new ValidationError(message);
      case 404:
        throw new NotFoundError(message);
      case 500:
      case 502:
      case 503:
      case 504:
        throw new ServerError(message);
      default:
        throw new AgentCacheError(message, response.status);
    }
  }

  /**
   * Execute request with retry logic
   */
  private async retryRequest<T>(
    fn: () => Promise<AxiosResponse<T>>,
    attempt: number = 0
  ): Promise<AxiosResponse<T>> {
    try {
      return await fn();
    } catch (error) {
      if (!(error instanceof AxiosError)) {
        throw error;
      }

      const response = error.response;

      // Don't retry on client errors (except rate limit)
      if (response && response.status >= 400 && response.status < 500) {
        if (response.status !== 429) {
          this.handleError(error);
        }
      }

      // Retry on rate limit or server error
      if (
        (response && (response.status === 429 || response.status >= 500)) ||
        !response
      ) {
        if (attempt < this.maxRetries - 1) {
          // Exponential backoff
          let waitTime = Math.pow(2, attempt) * 1000;
          if (response?.status === 429 && response.headers['retry-after']) {
            waitTime = parseInt(response.headers['retry-after']) * 1000;
          }

          await new Promise((resolve) => setTimeout(resolve, waitTime));
          return this.retryRequest(fn, attempt + 1);
        }
      }

      this.handleError(error);
    }
  }

  /**
   * Query the cache
   *
   * @param prompt - The query prompt
   * @param options - Query options
   * @returns Cache response with result and metrics
   *
   * @example
   * ```typescript
   * const response = await cache.query('What is HIPAA?', {
   *   context: { patient_id: '123' },
   *   ttl: 3600
   * });
   * ```
   */
  async query(
    prompt: string,
    options?: Partial<Omit<QueryRequest, 'prompt'>>
  ): Promise<CacheResponse> {
    const requestData: QueryRequest = {
      prompt,
      context: options?.context,
      metadata: options?.metadata,
      ttl: options?.ttl,
      sector: options?.sector || this.sector,
      compliance: options?.compliance || this.compliance,
      namespace: options?.namespace || this.namespace,
      invalidate_on: options?.invalidate_on,
    };

    // Remove undefined values
    Object.keys(requestData).forEach((key) => {
      if (requestData[key as keyof QueryRequest] === undefined) {
        delete requestData[key as keyof QueryRequest];
      }
    });

    const response = await this.retryRequest(() =>
      this.client.post<CacheResponse>('/api/cache/query', requestData)
    );

    return response.data;
  }

  /**
   * Invalidate a cache entry
   *
   * @param cacheKey - The cache key to invalidate
   * @returns True if successful
   */
  async invalidate(cacheKey: string): Promise<boolean> {
    const response = await this.retryRequest(() =>
      this.client.delete(`/api/cache/invalidate/${cacheKey}`)
    );
    return response.status === 200;
  }

  /**
   * Get pipeline configuration
   *
   * @param pipelineId - Pipeline ID
   * @returns Pipeline configuration
   */
  async getPipeline(pipelineId: string): Promise<PipelineConfig> {
    const response = await this.retryRequest(() =>
      this.client.get<PipelineConfig>(`/api/pipelines/${pipelineId}`)
    );
    return response.data;
  }

  /**
   * Create a webhook subscription
   *
   * @param webhook - Webhook configuration
   * @returns Created webhook data
   *
   * @example
   * ```typescript
   * const webhook = await cache.createWebhook({
   *   url: 'https://myapp.com/webhooks',
   *   events: ['cache.hit', 'cache.miss'],
   *   secret: 'webhook_secret_123'
   * });
   * ```
   */
  async createWebhook(webhook: WebhookConfig): Promise<any> {
    const response = await this.retryRequest(() =>
      this.client.post('/api/webhooks', webhook)
    );
    return response.data;
  }

  /**
   * List all webhooks
   *
   * @returns Array of webhooks
   */
  async listWebhooks(): Promise<WebhookConfig[]> {
    const response = await this.retryRequest(() =>
      this.client.get<WebhookConfig[]>('/api/webhooks')
    );
    return response.data;
  }

  /**
   * Delete a webhook
   *
   * @param webhookId - Webhook ID
   */
  async deleteWebhook(webhookId: string): Promise<boolean> {
    const response = await this.retryRequest(() =>
      this.client.delete(`/api/webhooks/${webhookId}`)
    );
    return response.status === 200;
  }

  /**
   * Verify a claim using the Trust Broker (System 2 Reasoning)
   *
   * @param claim - The statement or claim to verify
   * @returns Verification result with verdict and reasoning
   *
   * @example
   * ```typescript
   * const result = await cache.verifyClaim('The earth is flat');
   * console.log(result.data.verdict); // FALSE
   * ```
   */
  async verifyClaim(claim: string): Promise<VerificationResponse> {
    const response = await this.retryRequest(() =>
      this.client.post<VerificationResponse>('/api/v1/truth/verify', { claim })
    );
    return response.data;
  }
}
