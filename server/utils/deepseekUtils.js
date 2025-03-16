/**
 * Deepseek API Utilities
 * 
 * This module provides utilities for interacting with the Deepseek API
 * for both chat completions and embeddings generation.
 */
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Deepseek API configuration
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_EMBEDDING_MODEL = 'deepseek-embed'; // Use the embedding model
const DEEPSEEK_CHAT_MODEL = 'deepseek-chat'; // Use the chat completion model
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1';

// Validate API key
if (!DEEPSEEK_API_KEY) {
  console.warn('Warning: DEEPSEEK_API_KEY not found in environment variables. API calls will fail.');
}

class DeepseekEmbeddings {
  constructor() {
    this.apiKey = DEEPSEEK_API_KEY;
    this.client = axios.create({
      baseURL: DEEPSEEK_API_URL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Generate embeddings for the given text
   * @param {string} text - The text to embed
   * @returns {Promise<number[]>} - The embedding vector
   */
  async embedText(text) {
    try {
      const response = await this.client.post('/embeddings', {
        input: text,
        model: DEEPSEEK_EMBEDDING_MODEL
      });
      
      return response.data.data[0].embedding;
    } catch (error) {
      console.error('Error generating embeddings:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Generate embeddings for multiple texts
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async embedBatch(texts) {
    try {
      // Deepseek might have rate limits, so we process in smaller batches
      const batchSize = 20;
      const results = [];
      
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        const response = await this.client.post('/embeddings', {
          input: batch,
          model: DEEPSEEK_EMBEDDING_MODEL
        });
        
        const embeddings = response.data.data.map(item => item.embedding);
        results.push(...embeddings);
      }
      
      return results;
    } catch (error) {
      console.error('Error batch generating embeddings:', error.response?.data || error.message);
      throw error;
    }
  }
}

class DeepseekChat {
  constructor() {
    this.apiKey = DEEPSEEK_API_KEY;
    this.client = axios.create({
      baseURL: DEEPSEEK_API_URL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Generate a chat completion
   * @param {Object[]} messages - Array of message objects with role and content
   * @param {Object} options - Additional options for the completion
   * @returns {Promise<Object>} - The completion response
   */
  async createChatCompletion(messages, options = {}) {
    try {
      const response = await this.client.post('/chat/completions', {
        model: DEEPSEEK_CHAT_MODEL,
        messages,
        ...options
      });
      
      return response.data;
    } catch (error) {
      console.error('Error generating chat completion:', error.response?.data || error.message);
      throw error;
    }
  }
  
  /**
   * Simplified method to get a response for a single user query with context
   * @param {string} query - The user's query
   * @param {string} context - Additional context to provide in the system message
   * @returns {Promise<string>} - The assistant's response text
   */
  async getResponse(query, context = '') {
    const systemMessage = context 
      ? `You are a helpful appliance parts assistant for PartSelect. Use the following information to answer the question: ${context}`
      : 'You are a helpful appliance parts assistant for PartSelect.';
    
    const completion = await this.createChatCompletion([
      { role: 'system', content: systemMessage },
      { role: 'user', content: query }
    ]);
    
    return completion.choices[0].message.content;
  }
}

module.exports = {
  DeepseekEmbeddings,
  DeepseekChat
};
