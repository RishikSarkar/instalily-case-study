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
const { 
  detectEntities, 
  extractPartNumbers, 
  detectApplianceType 
} = require('../utils/entityUtils');

// Initialize the Deepseek chat client
const chatClient = new DeepseekChat();

/**
 * Check if query is related to refrigerators or dishwashers
 * @param {string} query - The user's message
 * @returns {boolean} - True if the query is about refrigerators or dishwashers
 */
function isApplianceRelatedQuery(query) {
  // Convert to lowercase for case-insensitive matching
  const lowerQuery = query.toLowerCase();
  
  // First check for explicit part numbers which should always be considered relevant
  if (extractPartNumbers(query).length > 0) {
    return true;
  }
  
  // Check if we can detect a specific appliance type
  const applianceType = detectApplianceType(query);
  if (applianceType) {
    return true;
  }
  
  // Keywords related to refrigerators and dishwashers
  const applianceKeywords = [
    'refrigerator', 'fridge', 'freezer', 'ice maker', 'crisper', 'cooling', 'chiller',
    'dishwasher', 'dish', 'washer', 'rinse', 'detergent', 'spray arm', 'rack', 
    'filter', 'drain', 'water', 'door', 'shelf', 'bin', 'drawer', 'seal', 'gasket',
    'part', 'model', 'repair', 'replace', 'fix', 'broken', 'leaking', 'not working',
    'cold', 'freeze', 'appliance', 'kitchen', 'installation', 'manual', 'guide',
    'PS', 'part number', 'PartSelect', 'compatibility'
  ];
  
  // Keywords related to customer support and ordering
  const supportKeywords = [
    'order', 'shipping', 'delivery', 'return', 'warranty', 'status',
    'install', 'installation', 'video', 'how to', 'guide', 'tutorial', 
    'steps', 'payment', 'purchase', 'buy', 'price', 'cost', 'track',
    'help', 'support', 'service', 'customer support', 'contact',
    'login', 'account', 'checkout', 'cart', 'dimensions', 'material'
  ];
  
  // Check for appliance keywords
  if (applianceKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return true;
  }
  
  // Finally check for support keywords in combination with an appliance context 
  if (supportKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return true;
  }
  
  // If none of the above, it's not appliance-related
  return false;
}

/**
 * Format parts data into a user-friendly context string
 * @param {Array} parts - Array of part objects from vector search
 * @returns {string} - Formatted context string
 */
function formatPartsContext(parts) {
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return 'No relevant parts information available.';
  }
  
  // Build formatted part information
  const formattedParts = parts.map(part => {
    const metadata = part.metadata || {};
    
    // Make stock status very clear and prominent
    const inStock = typeof metadata.inStock === 'boolean' ? metadata.inStock : true;
    const stockStatus = inStock ? "IN STOCK" : "OUT OF STOCK";
    const stockStatusLine = `STOCK STATUS: ${stockStatus} - IMPORTANT: Please accurately report this stock status to the user`;
    
    const price = metadata.price ? `$${metadata.price}` : 'Price not available';
    const brand = metadata.brand || part.brand || 'Brand not specified';
    const type = metadata.type || part.type || 'Type not specified';
    const appliance = metadata.appliance || 'Compatible with multiple appliances';
    const modelCompatibility = metadata.compatibleModels && metadata.compatibleModels.length > 0 ? 
      `Compatible with models: ${metadata.compatibleModels.slice(0, 5).join(', ')}` : '';
    
    const partNumber = metadata.partNumber || part.partNumber || '';
    const partNumberLine = `PART NUMBER: ${partNumber} (reference this exact part number in your response)`;
    
    return `${partNumberLine}
TITLE: ${metadata.title || part.title || part.text || 'unknown'}
${stockStatusLine}
PRICE: ${price}
BRAND: ${brand}
TYPE: ${type}
APPLIANCE: ${appliance}
${modelCompatibility}
${metadata.rating ? `RATING: ${metadata.rating}/5` : ''}
DESCRIPTION: ${metadata.description || part.description || 'No description available'}
${metadata.chunkType === 'symptoms' && metadata.symptoms ? `SYMPTOMS RESOLVED: ${metadata.symptoms.join(', ')}` : ''}`;
  }).join('\n\n');

  return `IMPORTANT PARTS INFORMATION (always state accurate stock status in your response):\n\n${formattedParts}`;
}

/**
 * Check if parts should be shown for the given query and response
 * @param {string} query - The user query
 * @param {string} aiResponse - The AI response
 * @returns {boolean} - True if parts should be shown
 */
function shouldShowPartCards(query, aiResponse) {
  // Extract part numbers from query and response
  const queryEntities = detectEntities(query);
  const responseEntities = detectEntities(aiResponse);
  
  // If specific part numbers are mentioned, ONLY show those exact parts
  const hasSpecificPartNumbers = queryEntities.partNumbers.length > 0 || responseEntities.partNumbers.length > 0;
  
  // We'll use this flag to determine which filtering strategy to use
  return { 
    showParts: true, 
    onlyShowExactMatches: hasSpecificPartNumbers,
    partNumbers: [...new Set([...queryEntities.partNumbers, ...responseEntities.partNumbers])]
  };
}

/**
 * Enhance parts data with information from the response
 * @param {string} response - AI response text
 * @param {Array} currentParts - Current filtered parts
 * @param {Array} allParts - All parts returned by vector search
 * @returns {Array} - Enhanced parts array
 */
async function enhancePartsWithResponseMentions(response, currentParts, allParts) {
  // Extract newly mentioned part numbers from the AI response
  const responseEntities = detectEntities(response);
  const mentionedPartNumbers = responseEntities.partNumbers;
  
  // If no part numbers mentioned or we already have enough parts, just return current parts
  if (mentionedPartNumbers.length === 0 || currentParts.length >= 5) {
    return currentParts;
  }
  
  // Check if any mentioned part numbers are not already in currentParts
  const currentPartNumbers = new Set(currentParts.map(part => 
    (part.metadata?.partNumber || part.partNumber || '').toUpperCase()
  ));
  
  const newPartNumbers = mentionedPartNumbers.filter(
    partNum => !currentPartNumbers.has(partNum)
  );
  
  // If no new part numbers, return current parts
  if (newPartNumbers.length === 0) {
    return currentParts;
  }
  
  // Find parts in allParts that match new part numbers
  const additionalParts = allParts.filter(part => {
    const partNumber = (part.metadata?.partNumber || part.partNumber || '').toUpperCase();
    return newPartNumbers.includes(partNumber);
  });
  
  // Add new parts to current parts and limit to 5
  return [...currentParts, ...additionalParts].slice(0, 5);
}

// GET handler for chat route
router.get('/', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Check if the query is related to appliances
    if (!isApplianceRelatedQuery(query)) {
      return res.json({
        response: "I'm sorry, I can only assist with refrigerator and dishwasher parts. Please ask a question related to these appliances or their parts.",
        parts: []
      });
    }
    
    // Detect entities in the query
    const entities = detectEntities(query);
    console.log('Detected entities:', JSON.stringify(entities));
    
    // Get relevant parts from vector database
    const relevantParts = await vectorDB.queryVectors(
      query, 
      {}, // No filters for now
      10  // Get up to 10 results
    );
    
    // Format parts for context
    const partsContext = formatPartsContext(relevantParts);
    
    // Get AI response
    const aiResponse = await chatClient.getResponse(query, partsContext);
    
    // Check if we should show parts and filtering strategy
    const partDisplay = shouldShowPartCards(query, aiResponse);
    
    // Filter parts based on the strategy
    let filteredParts = [];
    
    if (partDisplay.showParts) {
      if (partDisplay.onlyShowExactMatches && partDisplay.partNumbers.length > 0) {
        // Only show exact part number matches
        filteredParts = relevantParts.filter(part => {
          const partNumber = (part.metadata?.partNumber || part.partNumber || '').toUpperCase();
          return partDisplay.partNumbers.includes(partNumber);
        });
        
        // Sort exact matches to the top
        filteredParts.sort((a, b) => {
          const aPartNumber = (a.metadata?.partNumber || a.partNumber || '').toUpperCase();
          const bPartNumber = (b.metadata?.partNumber || b.partNumber || '').toUpperCase();
          
          // If a is in the mentioned parts but b isn't, a comes first
          if (partDisplay.partNumbers.includes(aPartNumber) && !partDisplay.partNumbers.includes(bPartNumber)) {
            return -1;
          }
          // If b is in the mentioned parts but a isn't, b comes first
          if (!partDisplay.partNumbers.includes(aPartNumber) && partDisplay.partNumbers.includes(bPartNumber)) {
            return 1;
          }
          
          // Otherwise sort by in-stock status
          if (a.metadata?.inStock !== b.metadata?.inStock) {
            return a.metadata?.inStock ? -1 : 1;
          }
          
          return 0;
        });
      } else {
        // Use general relevance filtering for broader queries
        filteredParts = relevantParts;
      }
      
      // Enhance with parts mentioned in the response
      filteredParts = await enhancePartsWithResponseMentions(aiResponse, filteredParts, relevantParts);
    }
    
    // Limit to 5 parts
    filteredParts = filteredParts.slice(0, 5);
    
    // Deduplicate parts by part number (fix for duplicate cards)
    const seenPartNumbers = new Set();
    filteredParts = filteredParts.filter(part => {
      const partNumber = (part.metadata?.partNumber || part.partNumber || '').toUpperCase();
      if (!partNumber || seenPartNumbers.has(partNumber)) {
        return false;
      }
      seenPartNumbers.add(partNumber);
      return true;
    });

    // Return the response and filtered parts
    return res.json({
      response: aiResponse,
      parts: filteredParts
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// POST handler with conversation history
router.post('/', async (req, res) => {
  try {
    const { message, conversation } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Check if the message is related to appliances
    if (!isApplianceRelatedQuery(message)) {
      return res.json({
        response: "I'm sorry, I can only assist with refrigerator and dishwasher parts. Please ask a question related to these appliances or their parts.",
        parts: []
      });
    }
    
    // Detect entities in the message
    const messageEntities = detectEntities(message);
    console.log('Detected entities in message:', JSON.stringify(messageEntities));
    
    // Also detect entities in recent conversation to maintain context
    let conversationEntities = { partNumbers: [], modelNumbers: [], brands: [], categories: [] };
    
    if (conversation && Array.isArray(conversation) && conversation.length > 0) {
      // Only look at the last 3 messages to keep context relevant
      const recentMessages = conversation.slice(-3);
      
      recentMessages.forEach(msg => {
        const msgEntities = detectEntities(msg.content);
        
        // Combine with existing entities
        conversationEntities.partNumbers = [
          ...conversationEntities.partNumbers,
          ...msgEntities.partNumbers
        ];
        conversationEntities.modelNumbers = [
          ...conversationEntities.modelNumbers,
          ...msgEntities.modelNumbers
        ];
        conversationEntities.brands = [
          ...conversationEntities.brands,
          ...msgEntities.brands
        ];
        conversationEntities.categories = [
          ...conversationEntities.categories,
          ...msgEntities.categories
        ];
      });
      
      // Remove duplicates
      conversationEntities.partNumbers = [...new Set(conversationEntities.partNumbers)];
      conversationEntities.modelNumbers = [...new Set(conversationEntities.modelNumbers)];
      conversationEntities.brands = [...new Set(conversationEntities.brands)];
      conversationEntities.categories = [...new Set(conversationEntities.categories)];
      
      console.log('Detected entities in conversation:', JSON.stringify(conversationEntities));
    }
    
    // Combine message and conversation entities
    const combinedEntities = {
      partNumbers: [...new Set([...messageEntities.partNumbers, ...conversationEntities.partNumbers])],
      modelNumbers: [...new Set([...messageEntities.modelNumbers, ...conversationEntities.modelNumbers])],
      brands: [...new Set([...messageEntities.brands, ...conversationEntities.brands])],
      categories: [...new Set([...messageEntities.categories, ...conversationEntities.categories])]
    };
    
    // Prepare vector search query by enriching with entity information
    let vectorQuery = message;
    
    // Add model numbers to query if any were detected
    if (combinedEntities.modelNumbers.length > 0) {
      vectorQuery += ` model:${combinedEntities.modelNumbers.join(' ')}`;
    }
    
    // Add brand to query if any were detected
    if (combinedEntities.brands.length > 0) {
      vectorQuery += ` brand:${combinedEntities.brands.join(' ')}`;
    }
    
    // Get relevant parts from vector database with enriched query
    const results = await vectorDB.queryVectors(
      vectorQuery, 
      {}, // No filters for now
      10  // Get up to 10 results initially
    );
    
    // Format parts for context
    const context = formatPartsContext(results);
    
    // Prepare conversation history for the AI
    let promptConversation = [];
    
    if (conversation && Array.isArray(conversation)) {
      // Format previous messages for the LLM and limit to last 5 messages
      promptConversation = conversation.slice(-5).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
    }
    
    // Get response from the LLM
    const response = await chatClient.getResponse(message, context, promptConversation);
    
    // Check if we should show parts and filtering strategy
    const partDisplay = shouldShowPartCards(message, response);
    
    // Filter parts based on the strategy
    let relevantParts = [];
    
    if (partDisplay.showParts) {
      if (partDisplay.onlyShowExactMatches && partDisplay.partNumbers.length > 0) {
        // Only show exact part number matches
        relevantParts = results.filter(part => {
          const partNumber = (part.metadata?.partNumber || part.partNumber || '').toUpperCase();
          return partDisplay.partNumbers.includes(partNumber);
        });
        
        // Sort exact matches to the top
        relevantParts.sort((a, b) => {
          const aPartNumber = (a.metadata?.partNumber || a.partNumber || '').toUpperCase();
          const bPartNumber = (b.metadata?.partNumber || b.partNumber || '').toUpperCase();
          
          // If a is in the mentioned parts but b isn't, a comes first
          if (partDisplay.partNumbers.includes(aPartNumber) && !partDisplay.partNumbers.includes(bPartNumber)) {
            return -1;
          }
          // If b is in the mentioned parts but a isn't, b comes first
          if (!partDisplay.partNumbers.includes(aPartNumber) && partDisplay.partNumbers.includes(bPartNumber)) {
            return 1;
          }
          
          // Otherwise sort by in-stock status
          if (a.metadata?.inStock !== b.metadata?.inStock) {
            return a.metadata?.inStock ? -1 : 1;
          }
          
          return 0;
        });
      } else {
        // Use general relevance filtering for broader queries
        relevantParts = results;
      }
      
      // Enhance with parts mentioned in the response
      relevantParts = await enhancePartsWithResponseMentions(response, relevantParts, results);
    }
    
    // Format filtered parts for frontend (limit to 5)
    const formattedParts = relevantParts.slice(0, 5).map(part => {
      const metadata = part.metadata || {};
      
      // Extract part number from text if not available in metadata
      const extractedPartNumber = part.text && part.text.match(/\(PS\d+\)/i) 
        ? part.text.match(/\(PS\d+\)/i)[0].replace(/[()]/g, '') 
        : null;
        
      const partNumber = metadata.partNumber || part.partNumber || extractedPartNumber || 'Unknown';
      
      // Generate image URL based on part number
      const imageUrl = metadata.imageUrl || part.imageUrl || 
        `https://www.partselect.com/assets/images/parts/${partNumber}.jpg`;
      
      // Check if video is available
      const hasVideo = metadata.hasVideo || part.hasVideo || false;
      
      // Generate video URL
      const videoUrl = metadata.videoUrl || part.videoUrl || 
        (hasVideo ? `https://www.partselect.com/Installation-Video-${partNumber}.htm` : null);
      
      // Return formatted part data
      return {
        partNumber,
        title: metadata.title || part.title || (part.text ? part.text.split(':')[0] : 'Unknown Part'),
        description: metadata.description || part.description || (part.text ? part.text.split(':')[1] || part.text : ''),
        price: metadata.price || part.price || '0.00',
        inStock: typeof metadata.inStock !== 'undefined' ? metadata.inStock : true,
        brand: metadata.brand || part.brand || '',
        type: metadata.type || part.type || '',
        imageUrl,
        hasVideo,
        videoUrl,
        reviews: metadata.reviews || part.reviews || [],
        rating: metadata.rating || part.rating || 0,
        reviewCount: metadata.reviewCount || part.reviewCount || 0,
        symptoms: metadata.symptoms || part.symptoms || []
      };
    });
    
    // Deduplicate parts by part number (fix for duplicate cards)
    const seenPartNumbers = new Set();
    const uniqueParts = formattedParts.filter(part => {
      if (!part.partNumber || seenPartNumbers.has(part.partNumber.toUpperCase())) {
        return false;
      }
      seenPartNumbers.add(part.partNumber.toUpperCase());
      return true;
    });

    // Return the response and filtered parts
    return res.json({
      response,
      parts: uniqueParts
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
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
    // Check if metadata exists to determine if vectorization has occurred
    const hasMetadata = vectorDB.metadata && Array.isArray(vectorDB.metadata) && vectorDB.metadata.length > 0;
    
    return res.json({
      vectorCount: hasMetadata ? vectorDB.metadata.length : 0,
      status: hasMetadata ? 'completed' : 'not started or in progress'
    });
    
  } catch (error) {
    console.error('Error checking vectorization status:', error);
    res.status(500).json({ error: 'Failed to check vectorization status', details: error.message });
  }
});

module.exports = router; 