export interface AssistantDefaultParameters {
  model?: string;
  temperature?: number;
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
  // max_tokens removed - auto-managed by API
}

export interface Assistant {
  id: string;
  name: string;
  description: string;
  vector_store_ids: string[];
  model?: string;
  default_parameters?: AssistantDefaultParameters;
  system_message?: string;
}

export interface GenerationParameters {
  model: string;
  temperature: number;
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high';
  verbosity: 'low' | 'medium' | 'high';
  // max_tokens removed - auto-managed by API
}

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
  citations?: Citation[];
  parameters?: GenerationParameters;
  created_at: string;
}

export interface Citation {
  id: string;
  filename: string;
  content: string;
  page?: number;
  source?: string;
}

export interface StreamingMessage {
  id: string;
  content: string;
  reasoning: string;
  citations: Citation[];
  finished: boolean;
}

export interface OpenAIResponsesApiRequest {
  model: string;
  input: Array<{
    role: string;
    type: string;
    content: string;
  }>;
  temperature?: number;
  reasoning?: {
    effort: 'minimal' | 'low' | 'medium' | 'high';
  };
  tools?: Array<{
    type: string;
    file_search?: {
      vector_store_ids: string[];
    };
  }>;
  max_completion_tokens?: number;
}

export interface AuthSession {
  authenticated: boolean;
  expiresAt: number;
}