import { Assistant } from '@/types';

/**
 * Load assistant configurations from environment variables
 * Expected format: JSON array of assistant objects
 */
export function getAssistants(): Assistant[] {
  try {
    console.log('=== DEBUG: Environment Variables ===');
    console.log('NEXT_PUBLIC_ASSISTANTS_CONFIG exists:', !!process.env.NEXT_PUBLIC_ASSISTANTS_CONFIG);
    console.log('ASSISTANTS_CONFIG exists:', !!process.env.ASSISTANTS_CONFIG);
    
    const assistantsConfig = process.env.NEXT_PUBLIC_ASSISTANTS_CONFIG || process.env.ASSISTANTS_CONFIG;
    
    console.log('Raw assistantsConfig (first 200 chars):', assistantsConfig?.substring(0, 200));
    
    if (!assistantsConfig) {
      console.warn('ASSISTANTS_CONFIG environment variable not set (try NEXT_PUBLIC_ASSISTANTS_CONFIG)');
      return getDefaultAssistants();
    }

    const assistants = JSON.parse(assistantsConfig) as Assistant[];
    console.log('Parsed assistants:', assistants.map(a => ({ id: a.id, name: a.name, model: a.model })));
    
    // Validate the configuration
    for (const assistant of assistants) {
      if (!assistant.id || !assistant.name || !assistant.vector_store_ids) {
        throw new Error(`Invalid assistant configuration: ${JSON.stringify(assistant)}`);
      }
    }

    return assistants;
  } catch (error) {
    console.error('Error parsing ASSISTANTS_CONFIG:', error);
    return getDefaultAssistants();
  }
}

/**
 * Get a specific assistant by ID
 */
export function getAssistant(id: string): Assistant | null {
  const assistants = getAssistants();
  return assistants.find(assistant => assistant.id === id) || null;
}

/**
 * Get all vector store IDs used by an assistant
 */
export function getAssistantVectorStores(assistantId: string): string[] {
  const assistant = getAssistant(assistantId);
  return assistant?.vector_store_ids || [];
}

/**
 * Default assistants configuration (fallback)
 */
function getDefaultAssistants(): Assistant[] {
  return [
    {
      id: 'asst_example',
      name: 'Example Assistant',
      description: 'A sample assistant for demonstration purposes. Configure your real assistants in the ASSISTANTS_CONFIG environment variable.',
      vector_store_ids: ['vs_example']
    }
  ];
}

/**
 * Validate that all required environment variables are set for assistants
 */
export function validateAssistantConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY is required');
  }
  
  const assistants = getAssistants();
  
  if (assistants.length === 0) {
    errors.push('No assistants configured');
  }
  
  // Check for duplicate assistant IDs
  const ids = assistants.map(a => a.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    errors.push(`Duplicate assistant IDs found: ${duplicateIds.join(', ')}`);
  }
  
  // Validate vector store IDs format
  for (const assistant of assistants) {
    for (const vectorStoreId of assistant.vector_store_ids) {
      if (!vectorStoreId.startsWith('vs_')) {
        errors.push(`Invalid vector store ID format for ${assistant.name}: ${vectorStoreId} (should start with 'vs_')`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get assistant selection options for UI components
 */
export function getAssistantOptions() {
  const assistants = getAssistants();
  return assistants.map(assistant => ({
    value: assistant.id,
    label: assistant.name,
    description: assistant.description
  }));
}

/**
 * Check if an assistant supports file search (has vector stores)
 */
export function assistantSupportsFileSearch(assistantId: string): boolean {
  const assistant = getAssistant(assistantId);
  return (assistant?.vector_store_ids?.length || 0) > 0;
}