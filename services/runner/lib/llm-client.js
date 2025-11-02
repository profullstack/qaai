/**
 * Multi-LLM Client
 * 
 * Unified interface for multiple LLM providers:
 * - OpenAI (GPT-4o-mini, GPT-4o)
 * - Anthropic Claude (Sonnet, Opus)
 * - Ollama (Llama 3.1, Qwen, etc.)
 * 
 * Provider selection via environment variables.
 */

/**
 * LLM Provider configuration
 */
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  claude: {
    name: 'Anthropic Claude',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  ollama: {
    name: 'Ollama',
    apiKeyEnv: null, // Ollama doesn't require API key
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    defaultModel: 'llama3.1:8b',
  },
};

/**
 * Get the active LLM provider from environment
 */
function getProvider() {
  const provider = process.env.LLM_PROVIDER || 'openai';
  
  if (!PROVIDERS[provider]) {
    throw new Error(`Unknown LLM provider: ${provider}. Valid options: ${Object.keys(PROVIDERS).join(', ')}`);
  }
  
  return provider;
}

/**
 * Get the model to use for the active provider
 */
function getModel() {
  const provider = getProvider();
  return process.env.LLM_MODEL || PROVIDERS[provider].defaultModel;
}

/**
 * Call OpenAI API
 */
async function callOpenAI(messages, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  const model = options.model || getModel();
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 4000;
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }
  
  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage,
    model: data.model,
  };
}

/**
 * Call Anthropic Claude API
 */
async function callClaude(messages, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }
  
  const model = options.model || getModel();
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens || 4000;
  
  // Convert OpenAI-style messages to Claude format
  const systemMessage = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages: conversationMessages,
      system: systemMessage?.content,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} ${error}`);
  }
  
  const data = await response.json();
  return {
    content: data.content[0].text,
    usage: {
      prompt_tokens: data.usage.input_tokens,
      completion_tokens: data.usage.output_tokens,
      total_tokens: data.usage.input_tokens + data.usage.output_tokens,
    },
    model: data.model,
  };
}

/**
 * Call Ollama API
 */
async function callOllama(messages, options = {}) {
  const baseUrl = PROVIDERS.ollama.baseUrl;
  const model = options.model || getModel();
  const temperature = options.temperature ?? 0.7;
  
  // Ollama uses OpenAI-compatible chat endpoint
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: false,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error: ${response.status} ${error}`);
  }
  
  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    model: data.model,
  };
}

/**
 * Generate a completion using the configured LLM provider
 * 
 * @param {Array} messages - Array of message objects with role and content
 * @param {object} options - Optional parameters
 * @param {string} options.model - Override default model
 * @param {number} options.temperature - Temperature (0-1)
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @returns {Promise<object>} Response with content, usage, and model
 */
export async function generateCompletion(messages, options = {}) {
  const provider = getProvider();
  
  console.log(`[LLM] Using provider: ${PROVIDERS[provider].name}`);
  console.log(`[LLM] Model: ${options.model || getModel()}`);
  console.log(`[LLM] Messages: ${messages.length}`);
  
  try {
    let result;
    
    switch (provider) {
      case 'openai':
        result = await callOpenAI(messages, options);
        break;
        
      case 'claude':
        result = await callClaude(messages, options);
        break;
        
      case 'ollama':
        result = await callOllama(messages, options);
        break;
        
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    
    console.log(`[LLM] Completion generated successfully`);
    console.log(`[LLM] Tokens used: ${result.usage.total_tokens}`);
    
    return result;
    
  } catch (error) {
    console.error(`[LLM] Error generating completion:`, error);
    throw error;
  }
}

/**
 * Generate a structured JSON response using the configured LLM
 * 
 * @param {string} systemPrompt - System prompt defining the task
 * @param {string} userPrompt - User prompt with the specific request
 * @param {object} options - Optional parameters
 * @returns {Promise<object>} Parsed JSON response
 */
export async function generateJSON(systemPrompt, userPrompt, options = {}) {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  
  const result = await generateCompletion(messages, options);
  
  // Extract JSON from markdown code blocks if present
  let content = result.content.trim();
  const jsonMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (jsonMatch) {
    content = jsonMatch[1];
  }
  
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('[LLM] Failed to parse JSON response:', content);
    throw new Error(`Failed to parse LLM JSON response: ${error.message}`);
  }
}

/**
 * Test the LLM connection
 */
export async function testConnection() {
  try {
    const provider = getProvider();
    console.log(`[LLM] Testing connection to ${PROVIDERS[provider].name}...`);
    
    const result = await generateCompletion([
      { role: 'user', content: 'Say "OK" if you can read this.' },
    ], { maxTokens: 10 });
    
    console.log(`[LLM] Connection test successful!`);
    console.log(`[LLM] Response: ${result.content}`);
    
    return true;
  } catch (error) {
    console.error(`[LLM] Connection test failed:`, error);
    return false;
  }
}