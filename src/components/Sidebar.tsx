'use client';

import { useState } from 'react';
import { ChatSession, Assistant } from '@/types';
import { formatRelativeTime, truncateText, formatSessionDate } from '@/lib/utils';

interface SidebarProps {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  assistants: Assistant[];
  selectedAssistant: string;
  onAssistantChange: (assistantId: string) => void;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionRename: (sessionId: string, name: string) => void;
  onNewSession: () => Promise<void> | void;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({
  sessions,
  currentSession,
  assistants,
  selectedAssistant,
  onAssistantChange,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onNewSession,
  onLogout,
  isOpen,
  onToggle
}: SidebarProps) {
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const startEditing = (session: ChatSession) => {
    setEditingSession(session.id);
    setEditingName(session.name);
  };

  const saveEdit = () => {
    if (editingSession && editingName.trim()) {
      onSessionRename(editingSession, editingName.trim());
    }
    setEditingSession(null);
    setEditingName('');
  };

  const cancelEdit = () => {
    setEditingSession(null);
    setEditingName('');
  };

  if (!isOpen) return null;

  return (
    <div className={`
      ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
      fixed lg:relative lg:translate-x-0 z-30
      w-80 max-w-[85vw] lg:max-w-none
      bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 
      flex flex-col h-full transition-transform duration-300 ease-in-out
    `}>
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">Chat Sessions</h2>
          <button
            onClick={onToggle}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 lg:hidden"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Assistant Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Assistant
          </label>
          <select
            value={selectedAssistant}
            onChange={(e) => onAssistantChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm text-gray-800 dark:text-gray-200"
          >
            {assistants.map((assistant) => (
              <option key={assistant.id} value={assistant.id}>
                {assistant.name}
              </option>
            ))}
          </select>
          {selectedAssistant && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {assistants.find(a => a.id === selectedAssistant)?.description}
            </p>
          )}
        </div>

        {/* New Session Button */}
        <button
          onClick={async () => { try { await onNewSession(); } catch (e) { console.error('New Chat failed:', e); } }}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-sm font-medium"
        >
          + New Chat
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
            No chat sessions yet. Click &quot;New Chat&quot; to get started.
          </div>
        ) : (
          <div className="p-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group relative p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
                  currentSession?.id === session.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                }`}
                onClick={() => onSessionSelect(session.id)}
              >
                {editingSession === session.id ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      onBlur={saveEdit}
                      className="flex-1 text-sm border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                      autoFocus
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {session.name.includes('/') && session.name.includes(':') 
                            ? formatSessionDate(session.created_at)
                            : truncateText(session.name, 40)
                          }
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatRelativeTime(session.updated_at)}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(session);
                          }}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                          title="Rename"
                        >
                          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this chat session?')) {
                              onSessionDelete(session.id);
                            }
                          }}
                          className="p-1 rounded hover:bg-red-100"
                          title="Delete"
                        >
                          <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      {assistants.find(a => a.id === session.assistant_id)?.name || 'Unknown Assistant'}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onLogout}
          className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
        >
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
            </svg>
            Sign Out
          </div>
        </button>
      </div>
    </div>
  );
}