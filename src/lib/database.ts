import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';

export interface ChatSession {
  id: string;
  name: string;
  assistant_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  citations?: string; // JSON string of citations
  parameters?: string; // JSON string of generation parameters
  created_at: string;
}

export interface GenerationParameters {
  model: string;
  temperature: number;
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high';
  verbosity: 'low' | 'medium' | 'high';
  max_tokens?: number;
}

class DatabaseManager {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const databasePath = dbPath || process.env.DATABASE_PATH || './data/assistants.db';
    
    // Ensure directory exists
    const dir = path.dirname(databasePath);
    fs.mkdirSync(dir, { recursive: true });
    
    this.db = new Database(databasePath);
    this.initializeSchema();
  }

  private initializeSchema() {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        assistant_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        reasoning TEXT,
        citations TEXT, -- JSON string
        parameters TEXT, -- JSON string of generation parameters
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES chat_sessions (id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session_id ON chat_messages (session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_created_at ON chat_messages (created_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON chat_sessions (updated_at);
    `);
  }

  // Chat Sessions
  createSession(name: string, assistantId: string): ChatSession {
    const id = nanoid();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO chat_sessions (id, name, assistant_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, name, assistantId, now, now);
    
    return {
      id,
      name,
      assistant_id: assistantId,
      created_at: now,
      updated_at: now
    };
  }

  getSession(id: string): ChatSession | null {
    const stmt = this.db.prepare('SELECT * FROM chat_sessions WHERE id = ?');
    return stmt.get(id) as ChatSession | null;
  }

  getAllSessions(): ChatSession[] {
    const stmt = this.db.prepare('SELECT * FROM chat_sessions ORDER BY updated_at DESC');
    return stmt.all() as ChatSession[];
  }

  updateSessionName(id: string, name: string): void {
    const stmt = this.db.prepare(`
      UPDATE chat_sessions 
      SET name = ?, updated_at = ? 
      WHERE id = ?
    `);
    stmt.run(name, new Date().toISOString(), id);
  }

  updateSessionTimestamp(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE chat_sessions 
      SET updated_at = ? 
      WHERE id = ?
    `);
    stmt.run(new Date().toISOString(), id);
  }

  deleteSession(id: string): void {
    const stmt = this.db.prepare('DELETE FROM chat_sessions WHERE id = ?');
    stmt.run(id);
  }

  // Chat Messages
  addMessage(
    sessionId: string,
    role: ChatMessage['role'],
    content: string,
    reasoning?: string,
    citations?: unknown[],
    parameters?: GenerationParameters
  ): ChatMessage {
    const id = nanoid();
    const now = new Date().toISOString();
    
    const stmt = this.db.prepare(`
      INSERT INTO chat_messages (id, session_id, role, content, reasoning, citations, parameters, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      sessionId,
      role,
      content,
      reasoning || null,
      citations ? JSON.stringify(citations) : null,
      parameters ? JSON.stringify(parameters) : null,
      now
    );

    // Update session timestamp
    this.updateSessionTimestamp(sessionId);
    
    return {
      id,
      session_id: sessionId,
      role,
      content,
      reasoning,
      citations: citations ? JSON.stringify(citations) : undefined,
      parameters: parameters ? JSON.stringify(parameters) : undefined,
      created_at: now
    };
  }

  getSessionMessages(sessionId: string): ChatMessage[] {
    const stmt = this.db.prepare(`
      SELECT * FROM chat_messages 
      WHERE session_id = ? 
      ORDER BY created_at ASC
    `);
    return stmt.all(sessionId) as ChatMessage[];
  }

  deleteMessage(id: string): void {
    const stmt = this.db.prepare('DELETE FROM chat_messages WHERE id = ?');
    stmt.run(id);
  }

  // Utility methods
  getSessionCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_sessions');
    return (stmt.get() as { count: number }).count;
  }

  getMessageCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM chat_messages');
    return (stmt.get() as { count: number }).count;
  }

  close(): void {
    this.db.close();
  }
}

// Singleton instance
let dbInstance: DatabaseManager | null = null;

export function getDatabase(): DatabaseManager {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
  }
  return dbInstance;
}

export default DatabaseManager;