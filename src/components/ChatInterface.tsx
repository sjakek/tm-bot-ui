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
    // max_tokens removed
  });
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed for mobile-first
  const [showMobileSettings, setShowMobileSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Handle responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(true); // Always open on desktop
      }
    };

    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
            // max_tokens removed,
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
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
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
              // max_tokens removed,
            };
            console.log('Setting new parameters:', newParams);
            setParameters(newParams);
          }
        }}
        onSessionSelect={selectSession}
        onSessionDelete={deleteSession}
        onSessionRename={updateSessionName}
        onNewSession={() => createNewSession()}
        onLogout={logout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-800">
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-2 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              {/* Always show hamburger on mobile, hide on desktop */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 lg:hidden"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                {currentSession?.name || 'Chat'}
              </h1>
            </div>

            {/* Desktop controls */}
            <div className="hidden md:block">
              <ParameterControls
                parameters={parameters}
                onParametersChange={setParameters}
              />
            </div>

            {/* Mobile controls */}
            <div className="flex items-center space-x-2 md:hidden">
              {/* New Chat button for mobile */}
              <button 
                onClick={() => createNewSession()}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400"
                title="New Chat"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
              
              {/* Settings button for mobile */}
              <button 
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => setShowMobileSettings(true)}
                title="Settings"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
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

      {/* Mobile Settings Modal */}
      {showMobileSettings && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setShowMobileSettings(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-lg max-h-[80vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
                <button
                  onClick={() => setShowMobileSettings(false)}
                  className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <ParameterControls
                parameters={parameters}
                onParametersChange={setParameters}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}