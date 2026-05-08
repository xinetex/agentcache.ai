/**
 * @license
 * Copyright (c) 2026 AgentCache.ai. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL:
 * This software and its documentation are the property of AgentCache.ai.
 * Unauthorized copying, distribution, or modification of this file,
 * via any medium, is strictly prohibited.
 */

import { AbstractLLMProvider } from '../AbstractLLMProvider.js';
import { LLMRegistry } from '../Registry.js';
import type { CompletionResponse, Message } from '../types.js';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export class DeepSeekProvider extends AbstractLLMProvider {
  constructor(apiKey?: string, baseUrl: string = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com') {
    super('deepseek', apiKey, trimTrailingSlash(baseUrl));
  }

  protected async executeChat(
    messages: Message[],
    options?: { model?: string; temperature?: number; maxTokens?: number },
  ): Promise<CompletionResponse> {
    const model = options?.model || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API Error: ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      usage: {
        inputTokens: Number(data.usage?.prompt_tokens || 0),
        outputTokens: Number(data.usage?.completion_tokens || 0),
        reasoningTokens: data.usage?.reasoning_tokens == null ? undefined : Number(data.usage.reasoning_tokens),
        totalTokens: Number(data.usage?.total_tokens || 0),
      },
      model: data.model || model,
      provider: 'deepseek',
      metadata: {
        finishReason: choice?.finish_reason,
        reasoningContent: choice?.message?.reasoning_content,
      },
    };
  }
}

LLMRegistry.register('deepseek', DeepSeekProvider);
