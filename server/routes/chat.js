// Chat API endpoint
// This API handles chat requests from the frontend using vector search

const express = require('express');
const router = express.Router();
const { DeepseekChat } = require('../utils/deepseekUtils');
const vectorDB = require('../utils/vectorizeData');
const { 
  detectEntities, 
  extractPartNumbers, 
  detectApplianceType 
} = require('../utils/entityUtils');

// Initialize Deepseek chat client
const chatClient = new DeepseekChat();

// Check if query related to refrigerators or dishwashers
function isApplianceRelatedQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  // Check for part numbers
  if (extractPartNumbers(query).length > 0) {
    return true;
  }
  
  // Check if specific appliance type
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
  
  if (applianceKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return true;
  }
  
  if (supportKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return true;
  }
  
  return false;
}

// Format parts data into context string
function formatPartsContext(parts) {
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return 'No relevant parts information available.';
  }
  
  const formattedParts = parts.map(part => {
        const metadata = part.metadata || {};
    
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

// Check if parts should be shown for the given query and response
function shouldShowPartCards(query, aiResponse) {
  const queryEntities = detectEntities(query);
  const responseEntities = detectEntities(aiResponse);
  
  const hasSpecificPartNumbers = queryEntities.partNumbers.length > 0 || responseEntities.partNumbers.length > 0;
    
  return { 
    showParts: true, 
    onlyShowExactMatches: hasSpecificPartNumbers,
    partNumbers: [...new Set([...queryEntities.partNumbers, ...responseEntities.partNumbers])]
  };
}

// Enhance parts data with information from the response
async function enhancePartsWithResponseMentions(response, currentParts, allParts) {
  const responseEntities = detectEntities(response);
  const mentionedPartNumbers = responseEntities.partNumbers;
  
  // If no part numbers mentioned or already have enough parts return current parts
  if (mentionedPartNumbers.length === 0 || currentParts.length >= 5) {
    return currentParts;
  }
  
  // Check if any mentioned part numbers not already in currentParts
  const currentPartNumbers = new Set(currentParts.map(part => 
    (part.metadata?.partNumber || part.partNumber || '').toUpperCase()
  ));
  
  const newPartNumbers = mentionedPartNumbers.filter(
    partNum => !currentPartNumbers.has(partNum)
  );
  
  if (newPartNumbers.length === 0) {
    return currentParts;
  }
  
  const additionalParts = allParts.filter(part => {
    const partNumber = (part.metadata?.partNumber || part.partNumber || '').toUpperCase();
    return newPartNumbers.includes(partNumber);
  });
  
  return [...currentParts, ...additionalParts].slice(0, 5);
}

// GET handler for chat route
router.get('/', async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    if (!isApplianceRelatedQuery(query)) {
      return res.json({
        response: "I'm sorry, I can only assist with refrigerator and dishwasher parts. Please ask a question related to these appliances or their parts.",
        parts: []
      });
    }
    
    const entities = detectEntities(query);
    console.log('Detected entities:', JSON.stringify(entities));
    
    const relevantParts = await vectorDB.queryVectors(
      query, 
      {},
      10
    );
    
    const partsContext = formatPartsContext(relevantParts);
    
    const aiResponse = await chatClient.getResponse(query, partsContext);
    
    const partDisplay = shouldShowPartCards(query, aiResponse);
    
    let filteredParts = [];
    
    if (partDisplay.showParts) {
      if (partDisplay.onlyShowExactMatches && partDisplay.partNumbers.length > 0) {
        filteredParts = relevantParts.filter(part => {
          const partNumber = (part.metadata?.partNumber || part.partNumber || '').toUpperCase();
          return partDisplay.partNumbers.includes(partNumber);
        });
        
        filteredParts.sort((a, b) => {
          const aPartNumber = (a.metadata?.partNumber || a.partNumber || '').toUpperCase();
          const bPartNumber = (b.metadata?.partNumber || b.partNumber || '').toUpperCase();
          
          if (partDisplay.partNumbers.includes(aPartNumber) && !partDisplay.partNumbers.includes(bPartNumber)) {
            return -1;
          }
          if (!partDisplay.partNumbers.includes(aPartNumber) && partDisplay.partNumbers.includes(bPartNumber)) {
            return 1;
          }
          
          if (a.metadata?.inStock !== b.metadata?.inStock) {
            return a.metadata?.inStock ? -1 : 1;
          }
          
          return 0;
        });
      } else {
        filteredParts = relevantParts;
      }
      
      filteredParts = await enhancePartsWithResponseMentions(aiResponse, filteredParts, relevantParts);
    }
    
    filteredParts = filteredParts.slice(0, 5);
    
    const seenPartNumbers = new Set();
    filteredParts = filteredParts.filter(part => {
      const partNumber = (part.metadata?.partNumber || part.partNumber || '').toUpperCase();
      if (!partNumber || seenPartNumbers.has(partNumber)) {
        return false;
      }
      seenPartNumbers.add(partNumber);
      return true;
    });

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
    
    if (!isApplianceRelatedQuery(message)) {
      return res.json({
        response: "I'm sorry, I can only assist with refrigerator and dishwasher parts. Please ask a question related to these appliances or their parts.",
        parts: []
      });
    }
    
    const messageEntities = detectEntities(message);
    console.log('Detected entities in message:', JSON.stringify(messageEntities));
    
    let conversationEntities = { partNumbers: [], modelNumbers: [], brands: [], categories: [] };
    
    if (conversation && Array.isArray(conversation) && conversation.length > 0) {
      const recentMessages = conversation.slice(-3);
      
      recentMessages.forEach(msg => {
        const msgEntities = detectEntities(msg.content);
        
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
      
      conversationEntities.partNumbers = [...new Set(conversationEntities.partNumbers)];
      conversationEntities.modelNumbers = [...new Set(conversationEntities.modelNumbers)];
      conversationEntities.brands = [...new Set(conversationEntities.brands)];
      conversationEntities.categories = [...new Set(conversationEntities.categories)];
      
      console.log('Detected entities in conversation:', JSON.stringify(conversationEntities));
    }
    
    const combinedEntities = {
      partNumbers: [...new Set([...messageEntities.partNumbers, ...conversationEntities.partNumbers])],
      modelNumbers: [...new Set([...messageEntities.modelNumbers, ...conversationEntities.modelNumbers])],
      brands: [...new Set([...messageEntities.brands, ...conversationEntities.brands])],
      categories: [...new Set([...messageEntities.categories, ...conversationEntities.categories])]
    };
    
    let vectorQuery = message;
    
    if (combinedEntities.modelNumbers.length > 0) {
      vectorQuery += ` model:${combinedEntities.modelNumbers.join(' ')}`;
    }
    
    if (combinedEntities.brands.length > 0) {
      vectorQuery += ` brand:${combinedEntities.brands.join(' ')}`;
    }
    
    const results = await vectorDB.queryVectors(
      vectorQuery, 
      {},
      10
    );
    
    const context = formatPartsContext(results);
    
    let promptConversation = [];
    
    if (conversation && Array.isArray(conversation)) {
      promptConversation = conversation.slice(-5).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
    }
    
    const response = await chatClient.getResponse(message, context, promptConversation);
    
    const partDisplay = shouldShowPartCards(message, response);
    
    let relevantParts = [];
    
    if (partDisplay.showParts) {
      if (partDisplay.onlyShowExactMatches && partDisplay.partNumbers.length > 0) {
        relevantParts = results.filter(part => {
          const partNumber = (part.metadata?.partNumber || part.partNumber || '').toUpperCase();
          return partDisplay.partNumbers.includes(partNumber);
        });
        
        relevantParts.sort((a, b) => {
          const aPartNumber = (a.metadata?.partNumber || a.partNumber || '').toUpperCase();
          const bPartNumber = (b.metadata?.partNumber || b.partNumber || '').toUpperCase();
          
          if (partDisplay.partNumbers.includes(aPartNumber) && !partDisplay.partNumbers.includes(bPartNumber)) {
            return -1;
          }
          if (!partDisplay.partNumbers.includes(aPartNumber) && partDisplay.partNumbers.includes(bPartNumber)) {
            return 1;
          }
          
          if (a.metadata?.inStock !== b.metadata?.inStock) {
            return a.metadata?.inStock ? -1 : 1;
          }
          
          return 0;
        });
      } else {
        relevantParts = results;
      }
      
      relevantParts = await enhancePartsWithResponseMentions(response, relevantParts, results);
    }
    
    const formattedParts = relevantParts.slice(0, 5).map(part => {
      const metadata = part.metadata || {};
      
      const extractedPartNumber = part.text && part.text.match(/\(PS\d+\)/i) 
        ? part.text.match(/\(PS\d+\)/i)[0].replace(/[()]/g, '') 
        : null;
        
      const partNumber = metadata.partNumber || part.partNumber || extractedPartNumber || 'Unknown';
      
      const imageUrl = metadata.imageUrl || part.imageUrl || 
        `https://www.partselect.com/assets/images/parts/${partNumber}.jpg`;
      
      const hasVideo = metadata.hasVideo || part.hasVideo || false;
      
      const videoUrl = metadata.videoUrl || part.videoUrl || 
        (hasVideo ? `https://www.partselect.com/Installation-Video-${partNumber}.htm` : null);
      
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
    
    const seenPartNumbers = new Set();
    const uniqueParts = formattedParts.filter(part => {
      if (!part.partNumber || seenPartNumbers.has(part.partNumber.toUpperCase())) {
        return false;
      }
      seenPartNumbers.add(part.partNumber.toUpperCase());
      return true;
    });

    return res.json({
      response,
      parts: uniqueParts
    });
  } catch (error) {
    console.error('Error in chat API:', error);
    res.status(500).json({ error: 'An error occurred while processing your request' });
  }
});

// Endpoint to initiate vectorization of consolidated data
router.post('/vectorize', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    vectorDB.vectorizeAllData()
      .then(() => console.log('Vectorization completed successfully'))
      .catch(err => console.error('Vectorization failed:', err));
    
    return res.json({ 
      message: 'Vectorization process started in the background',
      status: 'processing'
    });
    
  } catch (error) {
    console.error('Error starting vectorization:', error);
    res.status(500).json({ error: 'Failed to start vectorization', details: error.message });
  }
});

// Endpoint to check vectorization status
router.get('/vectorize/status', async (req, res) => {
  try {
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