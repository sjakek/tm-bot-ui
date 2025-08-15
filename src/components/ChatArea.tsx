'use client';

import { useState, useEffect } from 'react';
import { ChatSession, ChatMessage, GenerationParameters } from '@/types';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

interface ChatAreaProps {
  session: ChatSession | null;
  selectedAssistant: string;
  parameters: GenerationParameters;
  onCreateSession: (firstMessage?: string) => Promise<ChatSession | undefined>;
}

export default function ChatArea({
  session,
  selectedAssistant,
  parameters,
  onCreateSession,
}: ChatAreaProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<{
    content: string;
    reasoning?: string;
  } | null>(null);

  // Load messages when session changes
  useEffect(() => {
    if (session) {
      loadMessages();
    } else {
      setMessages([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  const loadMessages = async () => {
    if (!session) return;

    try {
      const response = await fetch(`/api/sessions/${session.id}/messages`);
      if (response.ok) {
        const messagesData = await response.json();
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    let currentSession = session;

    // Create session if none exists
    if (!currentSession) {
      const newSession = await onCreateSession(content);
      if (!newSession) return;
      currentSession = newSession;
    }

    setIsLoading(true);
    setStreamingMessage({ content: '' });

    try {
      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        session_id: currentSession.id,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, userMessage]);

          // Enable streaming with improved parsing
    const shouldStream = true;

      // Send to API for processing
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: currentSession.id,
          message: content,
          assistant_id: selectedAssistant,
          parameters,
          stream: shouldStream,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      if (shouldStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedContent = '';
        let accumulatedReasoning = '';

        let buffer = '';
        
        try {
          console.log('[ChatArea] Starting streaming response processing');
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              console.log('[ChatArea] Stream completed');
              break;
            }

            // Decode the chunk and add to buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            console.log('[ChatArea] Received chunk:', chunk.length, 'bytes');

            // Split buffer into lines
            const lines = buffer.split('\n');
            // Keep the last potentially incomplete line in buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.trim() === '') continue;
              
              if (!line.startsWith('data: ')) {
                console.log('[ChatArea] Non-data line:', line);
                continue;
              }
              
              const data = line.slice(6);
              console.log('[ChatArea] Processing data:', data);
              
              if (data === '[DONE]') {
                console.log('[ChatArea] Received [DONE], finalizing stream');
                // Reload messages to get the final stored version
                await loadMessages();
                setStreamingMessage(null);
                setIsLoading(false);
                return;
              }

              try {
                const parsed = JSON.parse(data);
                console.log('[ChatArea] Parsed streaming data:', parsed);
                
                if (parsed.content !== undefined) {
                  accumulatedContent = parsed.content;
                }
                if (parsed.reasoning !== undefined) {
                  accumulatedReasoning = parsed.reasoning;
                }

                console.log('[ChatArea] Setting streaming message, content length:', accumulatedContent.length);
                setStreamingMessage({
                  content: accumulatedContent,
                  reasoning: accumulatedReasoning || undefined,
                });
              } catch (e) {
                console.warn('[ChatArea] Failed to parse streaming data:', data, e);
              }
            }
          }
        } catch (error) {
          console.error('[ChatArea] Streaming error:', error);
        } finally {
          console.log('[ChatArea] Cleaning up stream');
          reader.releaseLock();
          setStreamingMessage(null);
          setIsLoading(false);
          await loadMessages();
        }
      } else {
        // Non-streaming: just reload messages when request completes
        await loadMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Show error message
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        session_id: currentSession.id,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingMessage(null);
    }
  };

  if (!session && !selectedAssistant) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No assistant selected</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Please select an assistant from the sidebar to start chatting.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">Start a new conversation</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Type a message below to begin chatting with your selected assistant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden">
        <MessageList 
          messages={messages} 
          streamingMessage={streamingMessage}
          isLoading={isLoading}
        />
      </div>
      <div className="flex-shrink-0">
        <MessageInput 
          onSendMessage={sendMessage}
          disabled={isLoading}
          placeholder={`Message ${selectedAssistant ? 'assistant' : ''}...`}
        />
      </div>
    </div>
  );
}