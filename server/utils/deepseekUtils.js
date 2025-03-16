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
    this.dimensions = 1536; // Standard embedding dimension
  }

  /**
   * Generate mock embeddings for the given text
   * Note: This is a temporary solution for testing without API access
   * @param {string} text - The text to embed
   * @returns {Promise<number[]>} - The embedding vector
   */
  async embedText(text) {
    console.log(`Generating mock embedding for: "${text.substring(0, 50)}..."`);
    
    // Generate a deterministic but random-looking embedding based on the text
    const embedding = new Array(this.dimensions).fill(0).map((_, i) => {
      // Use simple hash of text + position to get a deterministic value
      const hash = this.simpleHash(text + i);
      // Convert to a value between -1 and 1
      return (hash % 1000) / 500 - 1;
    });
    
    // Normalize the embedding to unit length
    const length = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / length);
  }
  
  /**
   * Generate mock embeddings for multiple texts
   * @param {string[]} texts - Array of texts to embed
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async embedBatch(texts) {
    console.log(`Generating mock embeddings for ${texts.length} texts`);
    
    const results = [];
    for (const text of texts) {
      results.push(await this.embedText(text));
    }
    
    return results;
  }
  
  /**
   * Simple hash function for text
   * @param {string} text - The text to hash
   * @returns {number} - A number hash
   */
  simpleHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
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
   * @param {Array} conversation - Previous conversation history
   * @returns {Promise<string>} - The assistant's response text
   */
  async getResponse(query, context = '', conversation = []) {
    const systemMessage = context 
      ? `You are a helpful appliance parts assistant for PartSelect. Use the following information to answer the question: ${context}`
      : 'You are a helpful appliance parts assistant for PartSelect.';
    
    // For testing purposes, provide a mock response if API call fails
    try {
      // Prepare messages array with system message first
      let messages = [{ role: 'system', content: systemMessage }];
      
      // Add conversation history if provided
      if (conversation && Array.isArray(conversation) && conversation.length > 0) {
        messages = [...messages, ...conversation];
      }
      
      // Add the current user query if not already included in conversation
      if (!conversation.length || conversation[conversation.length - 1].role !== 'user') {
        messages.push({ role: 'user', content: query });
      }
      
      console.log(`Sending ${messages.length} messages to Deepseek API`);
      
      const completion = await this.createChatCompletion(messages);
      
      return completion.choices[0].message.content;
    } catch (error) {
      console.warn('Using mock response due to API error:', error.message);
      return `Here's information about your query: "${query}". 
      
      Based on the parts in our database, I'd recommend checking our selection of ${query.includes('refrigerator') ? 'refrigerator parts' : query.includes('dishwasher') ? 'dishwasher parts' : 'appliance parts'}.`;
    }
  }
}

module.exports = {
  DeepseekEmbeddings,
  DeepseekChat
};
