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
 * Check if query is related to refrigerators or dishwashers
 * @param {string} query - The user's message
 * @returns {boolean} - True if the query is about refrigerators or dishwashers
 */
function isApplianceRelatedQuery(query) {
  // Convert to lowercase for case-insensitive matching
  const lowerQuery = query.toLowerCase();
  
  // Keywords related to refrigerators and dishwashers
  const applianceKeywords = [
    'refrigerator', 'fridge', 'freezer', 'ice maker', 'crisper', 'cooling', 'chiller',
    'dishwasher', 'dish', 'washer', 'rinse', 'detergent', 'spray arm', 'rack', 
    'filter', 'drain', 'water', 'door', 'shelf', 'bin', 'drawer', 'seal', 'gasket',
    'part', 'model', 'repair', 'replace', 'fix', 'broken', 'leaking', 'not working',
    'cold', 'freeze', 'appliance', 'kitchen', 'installation', 'manual', 'guide',
    'PS', 'part number', 'PartSelect', 'compatibility'
  ];
  
  // Check if any appliance keyword is in the query
  return applianceKeywords.some(keyword => lowerQuery.includes(keyword));
}

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
 * Determine if part cards should be shown based on the query intent
 * @param {string} query - The user query
 * @param {string} aiResponse - The AI response text
 * @returns {boolean} - Whether to show part cards
 */
function shouldShowPartCards(query, aiResponse) {
  // Convert to lowercase for case-insensitive matching
  const lowerQuery = query.toLowerCase();
  const lowerResponse = aiResponse.toLowerCase();
  
  // Only show parts when:
  // 1. A specific part number is mentioned in the query or response
  const partNumberPattern = /ps\d+/i;
  const hasPartNumberInQuery = partNumberPattern.test(query);
  const hasPartNumberInResponse = partNumberPattern.test(aiResponse);
  
  // 2. The query is explicitly asking for parts
  const askingForParts = [
    'what part', 'which part', 'recommend part', 'need a part',
    'looking for part', 'find part', 'parts for', 'replacement part'
  ].some(phrase => lowerQuery.includes(phrase));
  
  // 3. The response is recommending specific parts
  const recommendingParts = [
    'recommend', 'you need', 'you should replace', 'common part',
    'replacement part', 'compatible part'
  ].some(phrase => lowerResponse.includes(phrase));
  
  // Don't show parts for simple follow-up questions or thank you messages
  const simpleQuestions = [
    'how does', 'why is', 'when should', 'thank you', 'thanks', 
    'got it', 'how do i', 'could you explain'
  ];
  
  if (simpleQuestions.some(q => lowerQuery.includes(q)) && 
      !hasPartNumberInQuery && !hasPartNumberInResponse) {
    return false;
  }
  
  // Don't show parts if the AI is asking for more information
  if ((lowerResponse.includes('could you provide') || 
      lowerResponse.includes('please provide') || 
      lowerResponse.includes('need more information')) &&
      !hasPartNumberInResponse) {
    return false;
  }
  
  // Return true if any of our positive conditions are met
  return hasPartNumberInQuery || hasPartNumberInResponse || askingForParts || recommendingParts;
}

/**
 * Filter parts to only show relevant ones based on the query and response
 * @param {Array} parts - All parts returned from vector search
 * @param {string} query - The user query
 * @param {string} aiResponse - The AI response text
 * @returns {Array} - Filtered parts limited to 3 with the most relevant first
 */
function filterRelevantParts(parts, query, aiResponse) {
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return [];
  }
  
  // Extract part numbers mentioned in query or response
  const extractPartNumbers = (text) => {
    const matches = text.match(/PS\d+/gi) || [];
    return matches.map(match => match.toUpperCase());
  };
  
  const queryPartNumbers = extractPartNumbers(query);
  const responsePartNumbers = extractPartNumbers(aiResponse);
  const mentionedPartNumbers = [...new Set([...queryPartNumbers, ...responsePartNumbers])];
  
  // First, include parts that were explicitly mentioned by part number
  let filteredParts = parts.filter(part => {
    const partNumber = part.metadata?.partNumber || part.partNumber || 
                      (part.text && part.text.match(/\(PS\d+\)/i) ? 
                       part.text.match(/\(PS\d+\)/i)[0].replace(/[()]/g, '') : 
                       '');
    
    return mentionedPartNumbers.includes(partNumber.toUpperCase());
  });
  
  // If no specific parts were mentioned by number, prioritize exact matches
  if (filteredParts.length === 0 && parts.some(part => part.exactMatch)) {
    filteredParts = parts.filter(part => part.exactMatch);
  }
  
  // If we still don't have any parts, include parts with types mentioned in the response
  if (filteredParts.length === 0) {
    const lowerResponse = aiResponse.toLowerCase();
    
    // Extract commonly mentioned part types
    const partTypes = [
      'water filter', 'door bin', 'shelf', 'drawer', 'ice maker', 
      'compressor', 'motor', 'control board', 'thermostat', 'gasket',
      'spray arm', 'pump', 'drain hose', 'seal', 'fan'
    ];
    
    const mentionedTypes = partTypes.filter(type => lowerResponse.includes(type));
    
    if (mentionedTypes.length > 0) {
      filteredParts = parts.filter(part => {
        const partType = (part.metadata?.type || part.type || '').toLowerCase();
        const partTitle = (part.text || '').toLowerCase();
        return mentionedTypes.some(type => partType.includes(type) || partTitle.includes(type));
      });
    }
  }
  
  // If we still don't have any parts but the conversation suggests parts are relevant,
  // include up to 3 most relevant parts
  if (filteredParts.length === 0 && shouldShowPartCards(query, aiResponse)) {
    filteredParts = parts.slice(0, 3);
  }
  
  // Limit to 3 parts, prioritizing exact matches
  return filteredParts
    .sort((a, b) => (b.exactMatch ? 1 : 0) - (a.exactMatch ? 1 : 0))
    .slice(0, 3);
}

/**
 * Main chat endpoint
 */
router.post('/', async (req, res) => {
  try {
    const { message, conversation = [], filters } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`Processing chat request: "${message}"`);
    console.log(`Conversation history: ${JSON.stringify(conversation)}`);
    
    // Check if the query is related to refrigerators or dishwashers
    if (!isApplianceRelatedQuery(message)) {
      // If not appliance-related, send a specific response
      return res.json({
        response: "I apologize, but I can only help with questions about refrigerator and dishwasher parts. If you have questions about other appliances or topics, please contact customer service.",
        parts: [],
        outsideDomain: true
      });
    }
    
    // Check for part numbers in the query
    const partNumberMatch = message.match(/PS\d+/i);
    
    // Default search parameters
    let searchParams = {
      limit: 10,
      filters: {}
    };
    
    // Add exact part number match if found
    if (partNumberMatch) {
      const partNumber = partNumberMatch[0];
      console.log(`Found part number in query: ${partNumber}`);
      searchParams.exactMatch = partNumber;
    }
    
    // Apply any additional filters from the client
    if (filters) {
      searchParams.filters = { ...searchParams.filters, ...filters };
    }
    
    // Perform the vector search
    const results = await vectorDB.queryVectors(message, searchParams);
    console.log(`Found ${results.length} results from vector search`);
    
    // Format the context for the LLM
    const context = formatPartsContext(results);
    
    // Prepare the conversation history for the LLM
    let promptConversation = [];
    if (conversation && Array.isArray(conversation)) {
      // Format previous messages for the LLM
      promptConversation = conversation.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
    }
    
    // Get response from the LLM
    const response = await chatClient.getResponse(message, context, promptConversation);
    
    // Filter parts to only show relevant ones based on the query and response
    const relevantParts = filterRelevantParts(results, message, response);
    
    // Format filtered parts for frontend
    const formattedParts = relevantParts.map(part => {
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
    });
    
    // Return the response
    return res.json({
      response,
      parts: formattedParts,
      shouldShowParts: formattedParts.length > 0
    });
    
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
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