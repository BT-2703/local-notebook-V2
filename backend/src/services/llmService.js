const { Configuration, OpenAIApi } = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pool } = require('../database/init');
const logger = require('../utils/logger');

// Función para obtener la configuración LLM activa
async function getActiveLLMConfig() {
  try {
    const result = await pool.query(`
      SELECT * FROM llm_configs 
      WHERE is_active = true 
      ORDER BY is_default DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      throw new Error('No hay configuración LLM activa');
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error al obtener configuración LLM:', error);
    throw error;
  }
}

// Función para generar respuesta de chat
async function generateChatResponse(messages, options = {}) {
  try {
    const llmConfig = await getActiveLLMConfig();
    
    switch (llmConfig.provider) {
      case 'openai':
        return await generateOpenAIResponse(llmConfig, messages, options);
      case 'anthropic':
        return await generateAnthropicResponse(llmConfig, messages, options);
      case 'gemini':
        return await generateGeminiResponse(llmConfig, messages, options);
      case 'ollama':
        return await generateOllamaResponse(llmConfig, messages, options);
      default:
        throw new Error(`Proveedor no soportado: ${llmConfig.provider}`);
    }
  } catch (error) {
    logger.error('Error al generar respuesta de chat:', error);
    throw error;
  }
}

// Función para generar embeddings
async function generateEmbeddings(text) {
  try {
    const llmConfig = await getActiveLLMConfig();
    
    switch (llmConfig.provider) {
      case 'openai':
        return await generateOpenAIEmbeddings(llmConfig, text);
      case 'ollama':
        return await generateOllamaEmbeddings(llmConfig, text);
      default:
        // Fallback a OpenAI para embeddings si el proveedor no los soporta
        const openAIConfig = await pool.query(`
          SELECT * FROM llm_configs 
          WHERE provider = 'openai' AND is_active = true 
          LIMIT 1
        `);
        
        if (openAIConfig.rows.length > 0) {
          return await generateOpenAIEmbeddings(openAIConfig.rows[0], text);
        } else {
          throw new Error('No hay configuración de OpenAI disponible para embeddings');
        }
    }
  } catch (error) {
    logger.error('Error al generar embeddings:', error);
    throw error;
  }
}

// Implementaciones específicas para cada proveedor

async function generateOpenAIResponse(config, messages, options) {
  const openai = new OpenAIApi(new Configuration({
    apiKey: config.api_key,
    basePath: config.base_url || undefined
  }));
  
  const response = await openai.createChatCompletion({
    model: config.model,
    messages: messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    temperature: options.temperature || 0.7,
    max_tokens: options.max_tokens || 1000,
    ...config.config
  });
  
  return {
    text: response.data.choices[0].message.content,
    provider: 'openai',
    model: config.model
  };
}

async function generateAnthropicResponse(config, messages, options) {
  const anthropic = new Anthropic({
    apiKey: config.api_key,
    baseURL: config.base_url || undefined
  });
  
  // Convertir mensajes al formato de Anthropic
  const formattedMessages = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
  
  const response = await anthropic.messages.create({
    model: config.model,
    messages: formattedMessages,
    max_tokens: options.max_tokens || 1000,
    temperature: options.temperature || 0.7,
    ...config.config
  });
  
  return {
    text: response.content[0].text,
    provider: 'anthropic',
    model: config.model
  };
}

async function generateGeminiResponse(config, messages, options) {
  const genAI = new GoogleGenerativeAI(config.api_key);
  const model = genAI.getGenerativeModel({ model: config.model });
  
  // Convertir mensajes al formato de Gemini
  const formattedMessages = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
  
  const chat = model.startChat({
    generationConfig: {
      temperature: options.temperature || 0.7,
      maxOutputTokens: options.max_tokens || 1000,
      ...config.config
    }
  });
  
  const result = await chat.sendMessage(formattedMessages);
  const response = await result.response;
  
  return {
    text: response.text(),
    provider: 'gemini',
    model: config.model
  };
}

async function generateOllamaResponse(config, messages, options) {
  const { default: ollama } = await import('ollama');
  
  // Configurar URL base de Ollama
  const ollamaBaseUrl = config.base_url || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  ollama.setBaseUrl(ollamaBaseUrl);
  
  // Convertir mensajes al formato de Ollama
  const formattedMessages = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
  
  const response = await ollama.chat({
    model: config.model,
    messages: formattedMessages,
    options: {
      temperature: options.temperature || 0.7,
      num_predict: options.max_tokens || 1000,
      ...config.config
    }
  });
  
  return {
    text: response.message.content,
    provider: 'ollama',
    model: config.model
  };
}

async function generateOpenAIEmbeddings(config, text) {
  const openai = new OpenAIApi(new Configuration({
    apiKey: config.api_key,
    basePath: config.base_url || undefined
  }));
  
  const response = await openai.createEmbedding({
    model: 'text-embedding-ada-002',
    input: text
  });
  
  return response.data.data[0].embedding;
}

async function generateOllamaEmbeddings(config, text) {
  const { default: ollama } = await import('ollama');
  
  // Configurar URL base de Ollama
  const ollamaBaseUrl = config.base_url || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  ollama.setBaseUrl(ollamaBaseUrl);
  
  const response = await ollama.embeddings({
    model: config.model,
    prompt: text
  });
  
  return response.embedding;
}

module.exports = {
  generateChatResponse,
  generateEmbeddings,
  getActiveLLMConfig
};