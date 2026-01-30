/** Moonshot-based Audio Transcription Service
 * 
 * Replaces OpenAI transcription with Moonshot to avoid quota limits
 */

import { moonshotConfig, callMoonshotAPI } from '../ai-provider-moonshot.js';

export interface TranscriptionRequest {
  audioData: Buffer;
  language?: string;
  prompt?: string;
  fileName: string;
}

export interface TranscriptionResponse {
  text: string;
  language: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  confidence: number;
}

export class MoonshotTranscriptionService {
  async transcribeAudio(request: TranscriptionRequest): Promise<TranscriptionResponse> {
    // Convert audio to base64 for Moonshot API
    const audioBase64 = request.audioData.toString('base64');
    const audioMimeType = this.getAudioMimeType(request.fileName);
    
    // Create context-aware transcript request
    const messages = [
      {
        role: 'system',
        content: 'You are a audio transcription assistant. Transcribe the provided audio content accurately.'
      },
      {
        role: 'user', 
        content: `Please transcribe this audio file: ${request.fileName}${request.language ? ` (expected language: ${request.language})` : ''}. The base64-encoded audio content is attached.

Audio data (base64): ${audioBase64}
${request.prompt ? `\nAdditional context: ${request.prompt}` : ''}`
      }
    ];

    try {
      const result = await callMoonshotAPI(messages, moonshotConfig);
      
      return {
        text: result.toString().trim(),
        language: request.language || 'en',
        segments: this.parseSegments(result.toString()),
        confidence: this.calculateConfidence(result.toString())
      };
    } catch (error) {
      console.error(`Moonshot transcription error for file ${request.fileName}:`, error);
      throw error;
    }
  }

  async transcribeBatch(files: TranscriptionRequest[]): Promise<TranscriptionResponse[]> {
    return Promise.all(files.map(file => this.transcribeAudio(file)));
  }

  private getAudioMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'm4a': return 'audio/m4a';
      case 'ogg': return 'audio/ogg';
      default: return 'audio/mp4'; // Default
    }
  }

  private parseSegments(transcription: string): TranscriptionResponse['segments'] {
    // Basic segment parsing - can be enhanced for more sophisticated chunking
    const sentences = transcription.split(/[.!?]+/).filter(s => s.trim());
    const duration = sentences.length * 0.5; // Estimate duration (0.5s per sentence)
    const segmentLength = duration / sentences.length;
    
    return sentences.map((sentence, index) => ({
      start: index * segmentLength,
      end: (index + 1) * segmentLength, 
      text: sentence.trim()
    }));
  }

  private calculateConfidence(text: string): number {
    // Calculate confidence based on text patterns
    const wordCount = text.split(/\s+/).length;
    const ellipsisCount = (text.match(/\.{2,}/g) || []).length;
    const understandableFactor = Math.max(0, text.replace(/[.,!?;]/g, '').length);
    
    // Base confidence with penalty for ellipsis which indicates uncertain transcription
    return Math.max(0.7, Math.min(0.99, 0.8 - (ellipsisCount * 0.1) + (understandableFactor / text.length * 0.1)));
  }
}

export const moonshotTranscriptionService = new MoonshotTranscriptionService();