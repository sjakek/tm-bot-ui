import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDatabase } from '@/lib/database';
import { streamResponsesApi, callResponsesApi } from '@/lib/openai';
import { GenerationParameters } from '@/types';
import { getAssistant } from '@/lib/assistants';

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    console.warn('[ChatAPI] Unauthorized request');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { session_id, message, assistant_id, parameters, stream = false } = await request.json();
    console.log('[ChatAPI] Incoming request', { hasSession: !!session_id, msgLen: message?.length, assistant_id, stream });

    if (!session_id || !message || !assistant_id || !parameters) {
      console.warn('[ChatAPI] Missing fields', { session_id, hasMessage: !!message, assistant_id, hasParameters: !!parameters });
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = getDatabase();
    console.log('[ChatAPI] DB opened');
    
    // Verify session exists
    const session = db.getSession(session_id);
    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Add user message to database
    db.addMessage(session_id, 'user', message);

    // Get conversation history
    const messages = db.getSessionMessages(session_id);
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get assistant and system message
    const assistant = getAssistant(assistant_id);
    const systemMessage = assistant?.system_message;

    if (stream) {
      // Set up streaming response
      const encoder = new TextEncoder();
      
      const streamResponse = new Response(
        new ReadableStream({
          async start(controller) {
            try {
              let accumulatedContent = '';
              let accumulatedReasoning = '';
              let citations: unknown[] = [];

              console.log('[ChatAPI] Starting streaming response generator');
              
              let chunkCount = 0;
              let lastLoggedContentLength = 0;
              const logInterval = 50; // Log every 50 chunks to reduce spam
              
              for await (const chunk of streamResponsesApi(
                conversationHistory,
                assistant_id,
                parameters as GenerationParameters,
                systemMessage
              )) {
                chunkCount++;
                
                // Send chunk to client
                const data = JSON.stringify({
                  content: chunk.content,
                  reasoning: chunk.reasoning,
                  citations: chunk.citations,
                  finished: chunk.finished,
                });
                
                // Only log periodically or on important events
                const contentLength = chunk.content?.length || 0;
                const shouldLog = chunk.finished || 
                                 chunkCount === 1 || 
                                 chunkCount % logInterval === 0 ||
                                 (contentLength - lastLoggedContentLength) > 1000;
                
                if (shouldLog) {
                  console.log(`[ChatAPI] Chunk ${chunkCount}:`, {
                    contentLength: contentLength,
                    reasoningLength: chunk.reasoning?.length || 0,
                    finished: chunk.finished,
                    ...(chunkCount > 1 && !chunk.finished && { deltaTokens: contentLength - lastLoggedContentLength })
                  });
                  lastLoggedContentLength = contentLength;
                }
                
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));

                if (chunk.finished) {
                  accumulatedContent = chunk.content;
                  accumulatedReasoning = chunk.reasoning;
                  citations = chunk.citations || [];
                  console.log(`[ChatAPI] Streaming completed after ${chunkCount} chunks, final content length: ${contentLength}`);
                  break;
                }
              }
              
              console.log('[ChatAPI] Streaming completed, sending [DONE]');

              // Save final assistant message to database
              db.addMessage(
                session_id,
                'assistant',
                accumulatedContent,
                accumulatedReasoning || undefined,
                citations.length > 0 ? citations : undefined,
                parameters as GenerationParameters
              );

              // Send completion signal
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();

            } catch (error) {
              console.error('[ChatAPI] Streaming error:', error);
              const errText = String(error instanceof Error ? error.message : error || '');
              const isStreamingUnsupported = errText.includes('param') && errText.includes('stream') || errText.includes('unsupported_value');

              if (isStreamingUnsupported) {
                try {
                  // Fallback to non-streaming call
                  const response = await callResponsesApi(
                    conversationHistory,
                    assistant_id,
                    parameters as GenerationParameters,
                    systemMessage
                  );

                  // Save assistant message to database
                  db.addMessage(
                    session_id,
                    'assistant',
                    response.content,
                    response.reasoning,
                    response.citations,
                    parameters as GenerationParameters
                  );

                  // Send final chunk and DONE over SSE to keep client path consistent
                  const data = JSON.stringify({
                    content: response.content,
                    reasoning: response.reasoning,
                    citations: response.citations,
                    finished: true,
                  });
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  controller.close();
                  return;
                } catch (fallbackErr) {
                  console.error('[ChatAPI] Fallback call error:', fallbackErr);
                }
              }

              const errorData = JSON.stringify({
                error: 'Failed to generate response',
                content: 'Sorry, I encountered an error. Please try again.',
                finished: true,
              });
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
              controller.close();
            }
          },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );

      return streamResponse;
    } else {
      // Non-streaming response
      try {
        console.log('[ChatAPI] Making non-streaming request');
        const response = await callResponsesApi(
          conversationHistory,
          assistant_id,
          parameters as GenerationParameters,
          systemMessage
        );
        
        console.log('[ChatAPI] Got non-streaming response:', {
          contentLength: response.content?.length || 0,
          reasoningLength: response.reasoning?.length || 0,
          citationsCount: response.citations?.length || 0
        });

        // Save assistant message to database
        const assistantMessage = db.addMessage(
          session_id,
          'assistant',
          response.content,
          response.reasoning,
          response.citations,
          parameters as GenerationParameters
        );

        return new Response(JSON.stringify(assistantMessage), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('[ChatAPI] API call error:', error);
        
        // Save error message to database
        const errorMessage = db.addMessage(
          session_id,
          'assistant',
          'Sorry, I encountered an error processing your request. Please try again.',
        );

        return new Response(JSON.stringify(errorMessage), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  } catch (error) {
    console.error('[ChatAPI] Chat API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}