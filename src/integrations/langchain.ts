import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BaseMessage, AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatResult, ChatGeneration } from '@langchain/core/outputs';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';

import { BaseChatModelParams } from '@langchain/core/language_models/chat_models';

export interface AgentCacheInput extends BaseChatModelParams {
    apiKey?: string;
    baseUrl?: string;
    provider?: 'openai' | 'anthropic' | 'gemini' | 'moonshot';
    model?: string;
    temperature?: number;
}

export class ChatAgentCache extends BaseChatModel {
    apiKey: string;
    baseUrl: string;
    provider: string;
    modelName: string;
    temperature: number;

    constructor(fields: AgentCacheInput) {
        super(fields);
        this.apiKey = fields.apiKey || process.env.AGENTCACHE_API_KEY || '';
        this.baseUrl = fields.baseUrl || 'http://localhost:3000/api'; // Default to local for now, configurable
        this.provider = fields.provider || 'moonshot';
        this.modelName = fields.model || 'moonshot-v1-8k';
        this.temperature = fields.temperature || 0.7;
    }

    _llmType() {
        return 'agentcache';
    }

    async _generate(
        messages: BaseMessage[],
        options: this['ParsedCallOptions'],
        runManager?: CallbackManagerForLLMRun
    ): Promise<ChatResult> {
        const lastMessage = messages[messages.length - 1];
        const input = lastMessage.content.toString();

        // Convert LangChain messages to AgentCache format if needed, 
        // but for now our API takes a single 'message' and handles history internally or via session.
        // For a true chat model, we should send the whole history. 
        // Our current api/agent/chat.ts takes { message, sessionId, provider, model }.
        // Let's assume we send the last user message for this v1 adapter.

        const response = await fetch(`${this.baseUrl}/agent/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                message: input,
                provider: this.provider,
                model: this.modelName
            })
        });

        if (!response.ok) {
            throw new Error(`AgentCache API Error: ${response.statusText}`);
        }

        const data = await response.json();

        // Map AgentCache response to LangChain ChatResult
        const generations: ChatGeneration[] = [{
            text: data.message,
            message: new AIMessage(data.message),
            generationInfo: {
                cached: data.cached,
                latency: data.latency,
                metrics: data.metrics
            }
        }];

        return {
            generations,
            llmOutput: {
                tokenUsage: {
                    totalTokens: data.metrics?.actualReasoningTokens || 0 // Placeholder
                }
            }
        };
    }
}
