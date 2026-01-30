/* Vercel Edge Function: Bridge to Moonshot AI Gateway for audio1.tv audio processing
 * 
 * This service routes AI/audio processing requests through Vercel AI Gateway
 * using Moonshot (Kimi) instead of hitting OpenAI quota limits
 */

export const config = {
  runtime: 'edge',
  regions: ['iad1', 'sfo1']
};

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ 
        error: 'Method not allowed. Use POST.' 
      }, { status: 405 });
    }

    const { audioData, language, fileName, jobId, type } = await req.json();
    
    // Route to different AI processing based on type
    switch (type) {
      case 'transcription':
        return await processTranscription({ audioData, language, fileName, jobId });
      case 'summary':  
        return await processSummary({ audioData, fileName, jobId });
      case 'analysis':
        return await processAnalysis({ audioData, fileName, jobId });
      default:
        return Response.json({ 
          error: 'Unknown processing type. Use: transcription, summary, analysis' 
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Moonshot AI bridge error:', error);
    return Response.json({ 
      error: `AI processing failed: ${error.message}` 
    }, { status: 500 });
  }
}

async function processTranscription({ audioData, language, fileName, jobId }) {
  // Prepare prompt for accurate transcription
  const prompt = `Accurately transcribe this audio file: ${fileName}${language ? ` (language expected: ${language})` : ''}. 
Analyze the audio data and provide a complete, accurate transcription with timestamps if possible.`;

  const gatewayRequest = {
    messages: [
      {
        role: 'system',
        content: 'You are a professional audio transcription service. Provide accurate, detailed transcriptions with speaker diarization when possible and time stamps where applicable.'
      },
      {
        role: 'user', 
        content: prompt
      }
    ],
    model: 'moonshotai/kimi-k2',
    max_tokens: 8000,
    temperature: 0.1
  };

  return await callAIGateway(gatewayRequest, jobId);
}

async function processSummary({ audioData, fileName, jobId }) {
  const prompt = `Please provide a concise summary of this audio content: ${fileName}. Extract key information and create short, informative bullet points.`;
  
  const gatewayRequest = {
    messages: [
      {
        role: 'system', 
        content: 'You are an audio content analyst. Provide clear, concise summaries highlighting main topics and key moments.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    model: 'moonshotai/kimi-k2',
    max_tokens: 1000,
    temperature: 0.3
  };

  return await callAIGateway(gatewayRequest, jobId);
}

async function processAnalysis({ audioData, fileName, jobId }) {
  const prompt = `Analyze this audio content: ${fileName}. Identify sentiment, topics, key moments, and any notable insights or patterns.`;
  
  const gatewayRequest = {
    messages: [
      {
        role: 'system',
        content: 'You are an audio analyst that identifies sentiment, topics, patterns and insights from audio content. Be thorough and specific.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    model: 'moonshotai/kimi-k2',
    max_tokens: 2000,
    temperature: 0.2
  };

  return await callAIGateway(gatewayRequest, jobId);
}

async function callAIGateway(request, jobId) {
  // Route to Vercel AI Gateway with Moonshot (Kimi)
  const response = await fetch('https://api.vercel.com/drgnflai-jetty/ai-gateway', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VERCEL_AI_GATEWAY_KEY}`
    },
    body: JSON.stringify({
      ...request,
      provider: 'moonshotai',
      routing: 'kimi-k2'
    })
  });

  if (!response.ok) {
    throw new Error(`Gateway Error ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();
  const generatedText = result?.choices?.[0]?.message?.content || '';
  
  return Response.json({
    success: true,
    jobId,
    result: generatedText,
    processedAt: new Date().toISOString(),
    provider: 'moonshotai',
    model: 'kimi-k2',
    type: result.type || 'text',
    segments: parseAIGatewayResponse(generatedText)
  });
}

function parseAIGatewayResponse(text) {
  // Parse response into structured segments  
  const lines = text.split('\n').filter(line => line.trim());
  const segments = [];
  let currentIndex = 0;
  const estimatedTimePerSegment = 0.1; // 0.1 minutes per segment
  
  for (const line of lines) {
    segments.push({
      start: currentIndex * estimatedTimePerSegment,
      end: (currentIndex + 1) * estimatedTimePerSegment,
      text: line.trim()
    });
    currentIndex++;
  }
  
  return segments;
}