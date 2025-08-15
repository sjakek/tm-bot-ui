import OpenAI from 'openai';
import { GenerationParameters, Citation, StreamingMessage } from '@/types';
import { getAssistantVectorStores, assistantSupportsFileSearch } from './assistants';

// Server-only: Lazily create OpenAI client to avoid importing envs in client bundles
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set. Please configure it in your environment.');
  }
  return new OpenAI({ apiKey });
}

export interface ResponsesApiMessage {
  role: 'user' | 'assistant' | 'system';
  type: 'message';
  content: string;
}

export interface ResponsesApiRequest {
  model: string;
  input: ResponsesApiMessage[];
  temperature?: number;
  reasoning?: {
    effort: 'minimal' | 'low' | 'medium' | 'high';
  };
  tools?: Array<{
    type: 'file_search';
    file_search?: {
      vector_store_ids: string[];
    };
  }>;
  max_completion_tokens?: number;
}

/**
 * Get available models for the Responses API
 */
export function getAvailableModels(): string[] {
  return [
    'gpt-5-mini',
    'gpt-5',
    'gpt-4.1-mini', 
    'gpt-4.1',
    'gpt-4o-mini',
    'gpt-4o'
  ];
}

/**
 * Prepare messages for the Responses API format
 */
export function prepareMessagesForResponses(messages: Array<{ role: string; content: string }>): ResponsesApiMessage[] {
  return messages.map(msg => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    type: 'message' as const,
    content: msg.content
  }));
}

/**
 * Create a Responses API request
 */
export function createResponsesApiRequest(
  messages: ResponsesApiMessage[],
  assistantId: string,
  parameters: GenerationParameters,
  systemMessage?: string
): ResponsesApiRequest {
  function modelSupportsTemperature(model: string): boolean {
    // Some models (e.g., gpt-5 family) reject 'temperature'
    return !/^gpt-5/.test(model);
  }

  // Add system message if provided
  const input = systemMessage 
    ? [{ role: 'system' as const, type: 'message' as const, content: systemMessage }, ...messages]
    : messages;

  const request: ResponsesApiRequest = {
    model: parameters.model,
    input: input,
    reasoning: {
      effort: parameters.reasoning_effort
    }
  };

  // Only include temperature if supported by the selected model
  if (modelSupportsTemperature(parameters.model)) {
    request.temperature = parameters.temperature;
  }

  // Add max_completion_tokens if specified
  if (parameters.max_tokens) {
    request.max_completion_tokens = parameters.max_tokens;
  }

  // Add file search tool if assistant supports it
  if (assistantSupportsFileSearch(assistantId)) {
    const vectorStoreIds = getAssistantVectorStores(assistantId);
    if (vectorStoreIds.length > 0) {
      // Responses API expects vector_store_ids at the tool level
      // tools[0].vector_store_ids (not tools[0].file_search.vector_store_ids)
      request.tools = [{
        type: 'file_search',
        // @ts-expect-error: API requires vector_store_ids at tool level
        vector_store_ids: vectorStoreIds,
      }];
      // lightweight debug for visibility
      try { console.log('[OpenAI] Using vector stores:', vectorStoreIds); } catch {}
    }
  }

  return request;
}

/**
 * Make a request to the OpenAI Responses API
 */
export async function callResponsesApi(
  messages: Array<{ role: string; content: string }>,
  assistantId: string,
  parameters: GenerationParameters,
  systemMessage?: string
): Promise<{
  content: string;
  reasoning?: string;
  citations?: Citation[];
}> {
  try {
    const responsesMessages = prepareMessagesForResponses(messages);
    const requestBody = createResponsesApiRequest(responsesMessages, assistantId, parameters, systemMessage);

    console.log('Making Responses API request:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Responses API error:', response.status, errorData);
      throw new Error(`Responses API error: ${response.status} ${errorData}`);
    }

    const data = await response.json();
    console.log('Responses API response:', JSON.stringify(data, null, 2));

    // Parse the response based on the Responses API format
    let content = '';
    let reasoning = '';
    const citations: Citation[] = [];

    function collectAnnotations(annotations?: any[]) {
      if (!Array.isArray(annotations)) return;
      for (const ann of annotations) {
        if (ann && ann.type === 'file_citation') {
          citations.push({
            id: ann.file_id || '',
            filename: ann.filename || 'Unknown',
            content: '',
            page: ann.page || undefined,
            source: ann.source || undefined,
          });
        }
      }
    }

    // Extract content from output
    if (data.output_text) {
      content = data.output_text;
    } else if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (!part) continue;
            if (typeof part === 'string') {
              content += part;
            } else if (part.type === 'output_text' && part.text) {
              content += part.text;
              collectAnnotations(part.annotations);
            } else if (part.type === 'text' && part.content) {
              content += part.content;
              collectAnnotations(part.annotations);
            }
          }
        } else if (item.type === 'text' && item.content) {
          content += item.content;
        } else if (item.type === 'reasoning' && item.summary) {
          reasoning += Array.isArray(item.summary) ? item.summary.join(' ') : item.summary;
        }
      }
    }

    // Legacy extraction: function_call file_search JSON payloads
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'function_call' && item.name === 'file_search' && item.result) {
          try {
            const searchResults = JSON.parse(item.result);
            if (searchResults.files) {
              for (const file of searchResults.files) {
                citations.push({
                  id: file.id || '',
                  filename: file.filename || 'Unknown',
                  content: file.content || '',
                  page: file.page || undefined,
                  source: file.source || undefined,
                });
              }
            }
          } catch (e) {
            console.warn('Failed to parse file search results:', e);
          }
        }
      }
    }

    return {
      content: content || 'No response content',
      reasoning: reasoning || undefined,
      citations: citations.length > 0 ? citations : undefined
    };

  } catch (error) {
    console.error('Error calling Responses API:', error);
    throw error;
  }
}

/**
 * Stream responses from the Responses API
 */
export async function* streamResponsesApi(
  messages: Array<{ role: string; content: string }>,
  assistantId: string,
  parameters: GenerationParameters,
  systemMessage?: string
): AsyncGenerator<StreamingMessage, void, unknown> {
  try {
    const responsesMessages = prepareMessagesForResponses(messages);
    const requestBody = {
      ...createResponsesApiRequest(responsesMessages, assistantId, parameters, systemMessage),
      stream: true
    };

    console.log('Making streaming Responses API request');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Streaming Responses API error:', response.status, errorData);
      throw new Error(`Streaming Responses API error: ${response.status} ${errorData}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response stream available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    const messageId = `msg_${Date.now()}`;
    let accumulatedContent = '';
    let accumulatedReasoning = '';
    const citations: Citation[] = [];
    let isReasoning = false;
    let reasoningTokenCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Send final message
          yield {
            id: messageId,
            content: accumulatedContent,
            reasoning: accumulatedReasoning,
            citations,
            finished: true
          };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '' || !line.startsWith('data: ')) {
            continue;
          }

          const data = line.slice(6); // Remove 'data: '
          
          if (data === '[DONE]') {
            yield {
              id: messageId,
              content: accumulatedContent,
              reasoning: accumulatedReasoning,
              citations,
              finished: true
            };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            
            // Handle different possible streaming response formats
            let hasUpdate = false;
            let shouldLog = false;
            
            // Handle Responses API streaming format
            if (parsed.type === 'response.output_text.delta' && parsed.delta) {
              // Main content streaming
              accumulatedContent += parsed.delta;
              hasUpdate = true;
              shouldLog = false; // Don't log every single token
            } else if (parsed.type === 'response.reasoning.delta' && parsed.delta) {
              // Reasoning/thinking tokens (if they stream - currently they don't in Responses API)
              accumulatedReasoning += parsed.delta;
              hasUpdate = true;
              shouldLog = false; // Don't log every reasoning token
            } else if (parsed.type === 'response.output_item.added' && parsed.item?.type === 'reasoning') {
              // Reasoning phase started
              console.log('[OpenAI Stream] 💭 Reasoning phase started');
              isReasoning = true;
              reasoningTokenCount = 0;
              accumulatedReasoning = 'Starting to think about your question...';
              hasUpdate = true;
              shouldLog = false;
            } else if (parsed.type === 'response.output_item.done' && parsed.item?.type === 'reasoning') {
              // Reasoning phase completed - try to get reasoning summary
              console.log('[OpenAI Stream] ✅ Reasoning phase completed');
              isReasoning = false;
              
              // Try to extract actual reasoning content if available
              if (parsed.item && parsed.item.summary && parsed.item.summary.length > 0) {
                const reasoningSummary = Array.isArray(parsed.item.summary) ? parsed.item.summary.join(' ') : parsed.item.summary;
                if (reasoningSummary && reasoningSummary.trim()) {
                  accumulatedReasoning = reasoningSummary;
                } else {
                  accumulatedReasoning = `Completed reasoning (processed ${reasoningTokenCount > 0 ? reasoningTokenCount : 'many'} thoughts)`;
                }
              } else {
                accumulatedReasoning = `Completed reasoning phase`;
              }
              hasUpdate = true;
              shouldLog = false;
            } else if (parsed.type === 'response.output_text.done') {
              // Text generation completed
              console.log('[OpenAI Stream] ✅ Text generation completed, total content length:', accumulatedContent.length);
              shouldLog = false;
            } else if (parsed.type === 'response.done') {
              // Entire response completed - mark as done
              console.log('[OpenAI Stream] ✅ Response completed');
              
              // Update reasoning to show completion
              if (accumulatedReasoning && accumulatedReasoning !== 'Done') {
                accumulatedReasoning = 'Done';
                hasUpdate = true;
              }
              
              // Try to extract reasoning from the final response
              if (parsed.response && parsed.response.output) {
                for (const item of parsed.response.output) {
                  if (item.type === 'reasoning' && item.summary) {
                    const reasoningSummary = Array.isArray(item.summary) ? item.summary.join(' ') : item.summary;
                    if (reasoningSummary && reasoningSummary.trim()) {
                      accumulatedReasoning = reasoningSummary;
                      hasUpdate = true;
                      console.log('[OpenAI Stream] 💭 Extracted reasoning summary:', reasoningSummary.length, 'chars');
                    }
                  }
                }
              }
              shouldLog = false;
            } else if (parsed.type && (
              parsed.type.includes('file_search') ||
              parsed.type === 'response.created' ||
              parsed.type === 'response.in_progress'
            )) {
              // File search or meta events - log but don't process
              if (parsed.type.includes('file_search')) {
                console.log('[OpenAI Stream] 🔍 File search:', parsed.type);
              }
              shouldLog = false;
            } else {
              // Unknown format - log for debugging
              console.log('[OpenAI Stream] Unknown format:', JSON.stringify(parsed, null, 2));
              shouldLog = false;
            }

            // Only yield if we actually got a content update
            if (hasUpdate) {
              yield {
                id: messageId,
                content: accumulatedContent,
                reasoning: accumulatedReasoning,
                citations,
                finished: false
              };
            }

          } catch (e) {
            console.warn('Failed to parse streaming data:', data, e);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    console.error('Error streaming from Responses API:', error);
    throw error;
  }
}

/**
 * Validate API key and test connection
 */
export async function validateOpenAIConnection(): Promise<{ valid: boolean; error?: string }> {
  try {
    // Try to list models to test the connection (server only)
    const client = getOpenAIClient();
    await client.models.list();
    return { valid: true };
  } catch (error) {
    console.error('OpenAI connection validation failed:', error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}