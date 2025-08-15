'use client';

import { useState, useEffect } from 'react';
import { ChatSession, Assistant, GenerationParameters } from '@/types';
import { getAssistants } from '@/lib/assistants';
import Sidebar from './Sidebar';
import ChatArea from './ChatArea';
import ParameterControls from './ParameterControls';

export default function ChatInterface() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedAssistant, setSelectedAssistant] = useState<string>('');
  const [parameters, setParameters] = useState<GenerationParameters>({
    model: 'gpt-5-mini',
    temperature: 0.7,
    reasoning_effort: 'medium',
    verbosity: 'medium',
    max_tokens: undefined
  });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load assistants
        const assistantsData = getAssistants();
        console.log('Loaded assistants:', assistantsData);
        setAssistants(assistantsData);
        
        if (assistantsData.length > 0 && !selectedAssistant) {
          const first = assistantsData[0];
          console.log('=== DEBUG: First Assistant ===');
          console.log('Full first assistant object:', JSON.stringify(first, null, 2));
          console.log('Does first.model exist?', 'model' in first);
          console.log('First assistant model value:', first.model);
          console.log('First assistant model type:', typeof first.model);
          console.log('First assistant default_parameters:', first.default_parameters);
          console.log('=== END DEBUG ===');
          
          setSelectedAssistant(first.id);
          const newParams = {
            model: first.model || 'gpt-5-mini',
            temperature: first.default_parameters?.temperature ?? 0.7,
            reasoning_effort: first.default_parameters?.reasoning_effort ?? 'medium',
            verbosity: first.default_parameters?.verbosity ?? 'medium',
            max_tokens: 4000,
          };
          console.log('Setting new parameters:', newParams);
          setParameters(newParams);
        }

        // Load sessions
        const response = await fetch('/api/sessions');
        if (response.ok) {
          const sessionsData = await response.json();
          setSessions(sessionsData);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedAssistant]);

  const createNewSession = async (firstMessage?: string) => {
    console.log('createNewSession called', { selectedAssistant, firstMessage });
    if (!selectedAssistant) {
      console.error('No assistant selected!');
      return;
    }

    try {
      const sessionName = firstMessage 
        ? firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '')
        : new Intl.DateTimeFormat('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          }).format(new Date()).replace(',', '');

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sessionName,
          assistant_id: selectedAssistant,
        }),
      });

      if (response.ok) {
        const newSession = await response.json();
        setSessions(prev => [newSession, ...prev]);
        setCurrentSession(newSession);
        return newSession;
      } else {
        const errText = await response.text().catch(() => '');
        console.error('Failed to create session', { status: response.status, body: errText });
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const selectSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSession(session);
      setSelectedAssistant(session.assistant_id);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        if (currentSession?.id === sessionId) {
          setCurrentSession(null);
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const updateSessionName = async (sessionId: string, name: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        setSessions(prev => 
          prev.map(s => s.id === sessionId ? { ...s, name } : s)
        );
        if (currentSession?.id === sessionId) {
          setCurrentSession(prev => prev ? { ...prev, name } : null);
        }
      }
    } catch (error) {
      console.error('Error updating session name:', error);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 overflow-hidden">
      <Sidebar
        sessions={sessions}
        currentSession={currentSession}
        assistants={assistants}
        selectedAssistant={selectedAssistant}
        onAssistantChange={(id) => {
          console.log('Switching to assistant:', id);
          setSelectedAssistant(id);
          const a = assistants.find(x => x.id === id);
          if (a) {
            console.log('Found assistant:', a);
            console.log('Assistant model:', a.model);
            console.log('Assistant default_parameters:', a.default_parameters);
            const newParams = {
              model: a.model || 'gpt-5-mini',
              temperature: a.default_parameters?.temperature ?? 0.7,
              reasoning_effort: a.default_parameters?.reasoning_effort ?? 'medium',
              verbosity: a.default_parameters?.verbosity ?? 'medium',
              max_tokens: 4000,
            };
            console.log('Setting new parameters:', newParams);
            setParameters(newParams);
          }
        }}
        onSessionSelect={selectSession}
        onSessionDelete={deleteSession}
        onSessionRename={updateSessionName}
        onNewSession={createNewSession}
        onLogout={logout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-800">
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 rounded-md hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {currentSession?.name || 'Select or create a chat session'}
              </h1>
            </div>
            <ParameterControls
              parameters={parameters}
              onParametersChange={setParameters}
            />
          </div>
        </div>
        
        <div className="flex-1 min-h-0">
          <ChatArea
            session={currentSession}
            selectedAssistant={selectedAssistant}
            parameters={parameters}
            onCreateSession={createNewSession}
          />
        </div>
      </div>
    </div>
  );
}