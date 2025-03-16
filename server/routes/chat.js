/**
 * Chat API endpoint
 * 
 * This API handles chat requests from the frontend, leveraging
 * vector search for relevant parts and LLM for natural language responses.
 */
const express = require('express');
const router = express.Router();
const { DeepseekChat } = require('../utils/deepseekUtils');
const vectorDB = require('../utils/vectorizeData');

// Initialize the Deepseek chat client
const chatClient = new DeepseekChat();

/**
 * Format parts data into a user-friendly context string
 * @param {Array} parts - Array of part objects from vector search
 * @returns {string} - Formatted context string
 */
function formatPartsContext(parts) {
  return parts.map(part => {
    const { text, metadata } = part;
    
    // Format price with currency if available
    const price = metadata.price ? `$${metadata.price}` : 'Price not available';
    
    // Format stock status
    const stockStatus = metadata.inStock ? 'In Stock' : 'Out of Stock';
    
    // Return formatted text based on chunk type
    if (metadata.chunkType === 'review') {
      return `CUSTOMER REVIEW: ${text}`;
    } else if (metadata.chunkType === 'symptoms') {
      return `SYMPTOMS FIXED: ${text}`;
    } else {
      return `PART INFO: ${text}\nPrice: ${price} | Status: ${stockStatus} | Brand: ${metadata.brand} | Type: ${metadata.type}`;
    }
  }).join('\n\n');
}

/**
 * Main chat endpoint
 */
router.post('/', async (req, res) => {
  try {
    const { message, conversation, filters } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`Processing chat request: "${message}"`);
    
    // Search for relevant parts using vector search
    const relevantParts = await vectorDB.queryVectors(message, filters || {}, 5);
    
    // Format the context for the LLM
    let context = '';
    if (relevantParts && relevantParts.length > 0) {
      context = formatPartsContext(relevantParts);
      console.log(`Found ${relevantParts.length} relevant parts for context`);
    } else {
      console.log('No relevant parts found for the query');
    }
    
    // Add conversation history to context if provided
    if (conversation && conversation.length > 0) {
      // Only include the last 5 messages to avoid context length issues
      const recentConversation = conversation.slice(-5);
      const conversationContext = recentConversation
        .map(msg => `${msg.role === 'user' ? 'Customer' : 'Assistant'}: ${msg.content}`)
        .join('\n');
      
      context = `${context}\n\nRECENT CONVERSATION:\n${conversationContext}`;
    }
    
    // Generate response from Deepseek
    const systemInstructions = `
You are a knowledgeable appliance parts specialist for PartSelect, an e-commerce website 
that sells refrigerator and dishwasher parts. Your role is to help customers find the 
right parts for their appliances. When a customer asks about a specific part or issue, 
provide helpful information based on the context below.

If you don't have enough information to answer a question, ask clarifying questions about:
1. The appliance type (refrigerator or dishwasher)
2. The brand name
3. The specific issue they're experiencing
4. The part they're looking for

When recommending parts, include the part number, price, and availability if that information
is available in the context. Be friendly, professional, and precise.

CONTEXT INFORMATION:
${context}`;

    const response = await chatClient.getResponse(message, systemInstructions);
    
    // Return the response
    return res.json({
      response,
      parts: relevantParts.map(part => ({
        partNumber: part.metadata.partNumber,
        title: part.text.split(':')[0],
        price: part.metadata.price,
        inStock: part.metadata.inStock,
        type: part.metadata.type,
        brand: part.metadata.brand,
        appliance: part.metadata.appliance
      }))
    });
    
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: 'Failed to process chat request', details: error.message });
  }
});

/**
 * Endpoint to initiate vectorization of consolidated data
 * Protected by an API key for security
 */
router.post('/vectorize', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    // Simple API key check
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Start the vectorization process in the background
    vectorDB.vectorizeAllData()
      .then(() => console.log('Vectorization completed successfully'))
      .catch(err => console.error('Vectorization failed:', err));
    
    // Immediately return success since this is a long-running process
    return res.json({ 
      message: 'Vectorization process started in the background',
      status: 'processing'
    });
    
  } catch (error) {
    console.error('Error starting vectorization:', error);
    res.status(500).json({ error: 'Failed to start vectorization', details: error.message });
  }
});

/**
 * Endpoint to check vectorization status
 */
router.get('/vectorize/status', async (req, res) => {
  try {
    // Get collection count to determine if vectorization has occurred
    const count = await vectorDB.collection.count();
    
    return res.json({
      vectorCount: count,
      status: count > 0 ? 'completed' : 'not started or in progress'
    });
    
  } catch (error) {
    console.error('Error checking vectorization status:', error);
    res.status(500).json({ error: 'Failed to check vectorization status', details: error.message });
  }
});

module.exports = router; 