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
  console.log('Formatting parts context. Received parts:', JSON.stringify(parts, null, 2));
  
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    console.log('No parts to format or invalid parts data');
    return 'No relevant parts information available.';
  }
  
  // Group parts by type (exact matches first, then by chunk type)
  const exactMatches = parts.filter(part => part.exactMatch);
  const generalParts = parts.filter(part => !part.exactMatch && (!part.metadata?.chunkType || part.metadata?.chunkType === 'general'));
  const reviews = parts.filter(part => !part.exactMatch && part.metadata?.chunkType === 'review');
  const symptoms = parts.filter(part => !part.exactMatch && part.metadata?.chunkType === 'symptoms');
  
  // Build context sections
  const sections = [];
  
  // Add exact matches first with more detailed information
  if (exactMatches.length > 0) {
    sections.push("EXACT PART MATCHES:\n" + 
      exactMatches.map(part => {
        const metadata = part.metadata || {};
        const text = part.text || '';
        const price = metadata.price ? `$${metadata.price}` : 'Price not available';
        const stockStatus = metadata.inStock ? 'In Stock' : 'Out of Stock';
        const brand = metadata.brand || 'Unknown brand';
        const type = metadata.type || 'Unknown type';
        const appliance = metadata.appliance || 'appliance';
        
        return `${text}\nPrice: ${price} | Status: ${stockStatus} | Brand: ${brand} | Type: ${type} | For: ${appliance}`;
      }).join('\n\n')
    );
  }
  
  // Add general parts
  if (generalParts.length > 0) {
    sections.push("RELATED PARTS:\n" + 
      generalParts.map(part => {
        const metadata = part.metadata || {};
        const text = part.text || '';
        const price = metadata.price ? `$${metadata.price}` : 'Price not available';
        const stockStatus = metadata.inStock ? 'In Stock' : 'Out of Stock';
        
        return `${text}\nPrice: ${price} | Status: ${stockStatus} | Brand: ${metadata.brand || 'Unknown'} | Type: ${metadata.type || 'Unknown'}`;
      }).join('\n\n')
    );
  }
  
  // Add customer reviews if available
  if (reviews.length > 0) {
    sections.push("CUSTOMER REVIEWS:\n" + 
      reviews.map(part => part.text).join('\n\n')
    );
  }
  
  // Add symptom information if available
  if (symptoms.length > 0) {
    sections.push("SYMPTOMS FIXED BY THESE PARTS:\n" + 
      symptoms.map(part => part.text).join('\n\n')
    );
  }
  
  return sections.join('\n\n');
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
    
    // Check for part numbers in the query
    const partNumberMatch = message.match(/PS\d+/i);
    
    // Prepare enhanced filters if part number is detected
    const enhancedFilters = { ...filters };
    if (partNumberMatch) {
      console.log(`Part number detected in query: ${partNumberMatch[0]}`);
    }
    
    // Search for relevant parts using vector search
    const relevantParts = await vectorDB.queryVectors(message, enhancedFilters, 10);
    
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
right parts for their appliances and provide detailed installation or repair advice.

When a customer asks about a specific part number (like PS12345678):
1. Prioritize providing information about that exact part
2. Include compatibility information, price, and installation advice if available
3. If the exact part is not in the database, recommend similar alternatives

When a customer describes an issue without a part number:
1. Help diagnose the issue and recommend appropriate parts
2. Explain why those parts might be failing and how replacing them will fix the issue
3. Provide any relevant installation tips or precautions

Always include specific model compatibility information when available, and be precise about
part numbers, brand compatibility, and appliance types.

CONTEXT INFORMATION:
${context}`;

    const response = await chatClient.getResponse(message, systemInstructions);
    
    // Return the response with detailed part information
    return res.json({
      response,
      parts: relevantParts.map(part => {
        // Extract part number from text if not available in metadata
        const extractedPartNumber = part.text && part.text.match(/\(PS\d+\)/i) 
          ? part.text.match(/\(PS\d+\)/i)[0].replace(/[()]/g, '') 
          : null;
          
        const partNumber = part.metadata?.partNumber || part.partNumber || extractedPartNumber || 'Unknown';
        
        // Generate image URL based on part number
        const imageUrl = part.metadata?.imageUrl || part.imageUrl || 
          `https://www.partselect.com/assets/images/parts/${partNumber}.jpg`;
        
        // Check if video is available
        const hasVideo = part.metadata?.hasVideo || part.hasVideo || false;
        
        // Generate video URL
        const videoUrl = part.metadata?.videoUrl || part.videoUrl || 
          (hasVideo ? `https://www.partselect.com/Installation-Video-${partNumber}.htm` : null);
        
        return {
          partNumber,
          title: part.text?.split(':')[0] || 'Unknown Part',
          price: part.metadata?.price || part.price || '0.00',
          inStock: part.metadata?.inStock || part.inStock || false,
          type: part.metadata?.type || part.type || 'unknown',
          brand: part.metadata?.brand || part.brand || 'unknown',
          appliance: part.metadata?.appliance || part.appliance || 'unknown',
          exactMatch: part.exactMatch || false,
          rating: part.metadata?.rating || part.rating || 0,
          reviewCount: part.metadata?.reviewCount || part.reviewCount || 0,
          imageUrl,
          videoUrl
        };
      })
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