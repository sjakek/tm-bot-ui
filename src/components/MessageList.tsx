'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage, Citation } from '@/types';
import { formatDate, copyToClipboard } from '@/lib/utils';

interface MessageListProps {
  messages: ChatMessage[];
  streamingMessage?: {
    content: string;
    reasoning?: string;
  } | null;
  isLoading: boolean;
}

export default function MessageList({ messages, streamingMessage, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    let citations: Citation[] = [];
    
    try {
      if (message.citations) {
        citations = typeof message.citations === 'string' 
          ? JSON.parse(message.citations) 
          : message.citations;
      }
    } catch (e) {
      console.warn('Failed to parse citations:', e);
    }

    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-3xl ${isUser ? 'bg-blue-600 dark:bg-blue-600 text-white' : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'} rounded-lg px-4 py-3`}>
          {!isUser && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-200">Assistant</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => copyToClipboard(message.content)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded"
                  title="Copy message"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                </button>
                <span className="text-xs text-gray-500">{formatDate(message.created_at)}</span>
              </div>
            </div>
          )}
          
          <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert' : ''}`}>
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>

          {/* Reasoning section */}
          {message.reasoning && (
            <details className="mt-3 border-t pt-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                💭 Thinking
              </summary>
              <div className="mt-2 p-3 bg-blue-50 rounded text-xs text-gray-600 italic whitespace-pre-wrap">
                {message.reasoning}
              </div>
            </details>
          )}

          {/* Citations section */}
          {citations.length > 0 && (
            <div className="mt-3 border-t pt-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Sources</h4>
              <div className="space-y-2">
                {citations.map((citation, index) => (
                  <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                    <div className="font-medium text-gray-900">{citation.filename}</div>
                    {citation.content && (
                      <div className="text-gray-600 mt-1 text-xs">
                        {citation.content.length > 150 
                          ? citation.content.slice(0, 150) + '...'
                          : citation.content
                        }
                      </div>
                    )}
                    {citation.page && (
                      <div className="text-gray-500 text-xs mt-1">Page {citation.page}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isUser && (
            <div className="flex justify-end mt-2">
              <span className="text-xs text-blue-200">{formatDate(message.created_at)}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-800">
      {messages.length === 0 && !streamingMessage && !isLoading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <div className="mx-auto h-12 w-12 text-gray-300 mb-4">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        </div>
      )}

      {messages.map(renderMessage)}

      {/* Streaming message */}
      {streamingMessage && (
        <div className="flex justify-start mb-4">
          <div className="max-w-3xl bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-200">Assistant</span>
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75"></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></div>
                </div>
                <span className="text-xs text-blue-600">Streaming...</span>
              </div>
            </div>
            
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap">{streamingMessage.content}</div>
            </div>

            {streamingMessage.reasoning && (
              <div className="mt-3 border-t border-gray-200 dark:border-gray-600 pt-3">
                <div className={`p-3 rounded-lg text-xs italic whitespace-pre-wrap transition-all duration-300 ${
                  streamingMessage.reasoning.includes('Starting to think') || streamingMessage.reasoning === 'Thinking...'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 animate-pulse' 
                    : streamingMessage.reasoning === 'Done'
                    ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : streamingMessage.reasoning.includes('Completed reasoning')
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {streamingMessage.reasoning.includes('Starting to think') || streamingMessage.reasoning === 'Thinking...' ? (
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-yellow-500 dark:bg-yellow-400 rounded-full animate-bounce"></div>
                        <div className="w-1 h-1 bg-yellow-500 dark:bg-yellow-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-1 h-1 bg-yellow-500 dark:bg-yellow-400 rounded-full animate-bounce delay-150"></div>
                      </div>
                      <span className="font-medium">💭 {streamingMessage.reasoning}</span>
                    </div>
                  ) : streamingMessage.reasoning === 'Done' ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
                      <span className="font-medium">✅ Response complete</span>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full"></div>
                        <span className="font-medium text-xs">💭 AI Reasoning</span>
                      </div>
                      <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-600">
                        {streamingMessage.reasoning}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && !streamingMessage && (
        <div className="flex justify-start mb-4">
          <div className="max-w-3xl bg-white border rounded-lg px-4 py-3 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
              </div>
              <span className="text-sm text-gray-500">Assistant is thinking...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}