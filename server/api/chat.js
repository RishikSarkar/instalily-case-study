// Chat API endpoint

const express = require('express');
const router = express.Router();
const { DeepseekChat } = require('../utils/deepseekUtils');
const vectorDB = require('../utils/vectorizeData');

// Initialize Deepseek chat client
const chatClient = new DeepseekChat();

// Check if query is related to refrigerators or dishwashers
function isApplianceRelatedQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  const applianceKeywords = [
    'refrigerator', 'fridge', 'freezer', 'ice maker', 'crisper', 'cooling', 'chiller',
    'dishwasher', 'dish', 'washer', 'rinse', 'detergent', 'spray arm', 'rack', 
    'filter', 'drain', 'water', 'door', 'shelf', 'bin', 'drawer', 'seal', 'gasket',
    'part', 'model', 'repair', 'replace', 'fix', 'broken', 'leaking', 'not working',
    'cold', 'freeze', 'appliance', 'kitchen', 'installation', 'manual', 'guide',
    'PS', 'part number', 'PartSelect', 'compatibility'
  ];
  
  const supportKeywords = [
    'order', 'shipping', 'delivery', 'return', 'warranty', 'status',
    'install', 'installation', 'video', 'how to', 'guide', 'tutorial', 
    'steps', 'payment', 'purchase', 'buy', 'price', 'cost', 'track',
    'help', 'support', 'service', 'customer support', 'contact',
    'login', 'account', 'checkout', 'cart', 'dimensions', 'material'
  ];
  
  // Check for explicit part numbers
  if (query.match(/PS\d+/i)) {
    return true;
  }
  
  // Check for appliance keywords
  if (applianceKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return true;
  }
  
  // Check for support keywords in combination with appliance context
  if (supportKeywords.some(keyword => lowerQuery.includes(keyword))) {
    return true;
  }
  
  return false;
}

// Format parts data into a user-friendly context string
function formatPartsContext(parts) {
  console.log('Formatting parts context. Received parts:', JSON.stringify(parts, null, 2));
  
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    console.log('No parts to format or invalid parts data');
    return 'No relevant parts information available.';
  }
  
  const exactMatches = parts.filter(part => part.exactMatch);
  const generalParts = parts.filter(part => !part.exactMatch && (!part.metadata?.chunkType || part.metadata?.chunkType === 'general'));
  const reviews = parts.filter(part => !part.exactMatch && part.metadata?.chunkType === 'review');
  const symptoms = parts.filter(part => !part.exactMatch && part.metadata?.chunkType === 'symptoms');
  
  const sections = [];
  
  const allPartsInventory = [...exactMatches, ...generalParts].map(part => {
    const metadata = part.metadata || {};
    const partNum = metadata.partNumber || part.partNumber || '';
    const inStock = metadata.inStock === false ? false : true;
    return `Part ${partNum} availability: ${inStock ? 'In Stock' : 'Out of Stock'}`;
  }).join('\n');
  
  if (allPartsInventory) {
    sections.push(`INVENTORY INFORMATION:\n${allPartsInventory}`);
  }
  
  if (exactMatches.length > 0) {
    sections.push("EXACT PART MATCHES:\n" + 
      exactMatches.map(part => {
        const metadata = part.metadata || {};
        const text = part.text || '';
        const price = metadata.price ? `$${metadata.price}` : 'Price not available';
        const stockStatus = metadata.inStock === false ? 'Out of Stock' : 'In Stock';
        const brand = metadata.brand || 'Unknown brand';
        const type = metadata.type || 'Unknown type';
        const appliance = metadata.appliance || 'appliance';
        
        return `${text}\nPart Number: ${metadata.partNumber || part.partNumber}\nPrice: ${price}\nAvailability: ${stockStatus}\nBrand: ${brand}\nType: ${type}\nFor: ${appliance}`;
      }).join('\n\n')
    );
  }
  
  if (generalParts.length > 0) {
    sections.push("RELATED PARTS:\n" + 
      generalParts.map(part => {
        const metadata = part.metadata || {};
        const text = part.text || '';
        const price = metadata.price ? `$${metadata.price}` : 'Price not available';
        const stockStatus = metadata.inStock === false ? 'Out of Stock' : 'In Stock';
        
        return `${text}\nPart Number: ${metadata.partNumber || part.partNumber}\nPrice: ${price}\nAvailability: ${stockStatus}\nBrand: ${metadata.brand || 'Unknown'}\nType: ${metadata.type || 'Unknown'}`;
      }).join('\n\n')
    );
  }
  
  if (reviews.length > 0) {
    sections.push("CUSTOMER REVIEWS:\n" + 
      reviews.map(part => part.text).join('\n\n')
    );
  }
  
  if (symptoms.length > 0) {
    sections.push("SYMPTOMS FIXED BY THESE PARTS:\n" + 
      symptoms.map(part => part.text).join('\n\n')
    );
  }
  
  return sections.join('\n\n');
}

// Determine if part cards should be shown based on the query intent
function shouldShowPartCards(query, aiResponse) {
  const lowerQuery = query.toLowerCase();
  const lowerResponse = aiResponse.toLowerCase();
  
  // Always show parts when a part number is mentioned in the query or response
  const partNumberPattern = /ps\d+/i;
  const hasPartNumberInQuery = partNumberPattern.test(query);
  const hasPartNumberInResponse = partNumberPattern.test(aiResponse);
  
  // If a part number is mentioned, always show cards
  if (hasPartNumberInQuery || hasPartNumberInResponse) {
    return true;
  }
  
  // Show parts when the query is explicitly asking for parts
  const askingForParts = [
    'what part', 'which part', 'recommend part', 'need a part',
    'looking for part', 'find part', 'parts for', 'replacement part',
    'show me', 'i need', 'where can i find', 'help me find', 'compatible',
    'do you have', 'similar to', 'equivalent', 'alternative'
  ].some(phrase => lowerQuery.includes(phrase));
  
  // Show parts when the response is recommending specific parts
  const recommendingParts = [
    'recommend', 'you need', 'you should replace', 'common part',
    'replacement part', 'compatible part', 'available part', 'alternative part',
    'substitute', 'option', 'selection', 'variety', 'choice'
  ].some(phrase => lowerResponse.includes(phrase));
  
  // Show parts when specific part types are mentioned
  const partTypeKeywords = [
    'filter', 'shelf', 'drawer', 'bin', 'gasket', 'seal', 'pump', 'motor',
    'compressor', 'fan', 'valve', 'ice maker', 'thermostat', 'control board',
    'door', 'handle', 'hinge', 'latch', 'switch', 'light', 'bulb', 'tray'
  ];
  
  const mentionsPartTypes = partTypeKeywords.some(
    type => lowerQuery.includes(type) || lowerResponse.includes(type)
  );
  
  const simpleQuestions = [
    'thank you', 'thanks', 'got it', 'ok', 'great', 'awesome',
    'appreciate', 'helpful', 'understood'
  ];
  
  if (simpleQuestions.some(q => lowerQuery.includes(q) && lowerQuery.length < 20)) {
    return false;
  }
  
  return askingForParts || recommendingParts || mentionsPartTypes;
}

// Filter parts to only show relevant ones based on the query and response
function filterRelevantParts(parts, query, aiResponse) {
  if (!parts || !Array.isArray(parts) || parts.length === 0) {
    return [];
  }
  
  const extractPartNumbers = (text) => {
    const matches = text.match(/PS\d+/gi) || [];
    
    const extendedMatches = text.match(/(?:part|part number|part #|number)[:\s]+PS\d+/gi) || [];
    extendedMatches.forEach(match => {
      const partMatch = match.match(/PS\d+/i);
      if (partMatch && !matches.includes(partMatch[0])) {
        matches.push(partMatch[0]);
      }
    });
    
    return matches.map(match => match.toUpperCase());
  };
  
  const queryPartNumbers = extractPartNumbers(query);
  const responsePartNumbers = extractPartNumbers(aiResponse);
  const mentionedPartNumbers = [...new Set([...queryPartNumbers, ...responsePartNumbers])];
  
  // Include parts explicitly mentioned by part number
  let filteredParts = parts.filter(part => {
    const partNumber = part.metadata?.partNumber || part.partNumber || 
                      (part.text && part.text.match(/\(PS\d+\)/i) ? 
                       part.text.match(/\(PS\d+\)/i)[0].replace(/[()]/g, '') : 
                       '');
    
    return mentionedPartNumbers.includes(partNumber.toUpperCase());
  });
  
  // If no specific parts mentioned by number prioritize exact matches
  if (filteredParts.length === 0 && parts.some(part => part.exactMatch)) {
    filteredParts = parts.filter(part => part.exactMatch);
  }
  
  if (filteredParts.length === 0) {
    const lowerResponse = aiResponse.toLowerCase();
    
    const partTypes = [
      'water filter', 'door bin', 'shelf', 'drawer', 'ice maker', 
      'compressor', 'motor', 'control board', 'thermostat', 'gasket',
      'spray arm', 'pump', 'drain hose', 'seal', 'fan', 'bin', 'basket',
      'dispenser', 'grille', 'handle', 'hinge', 'latch', 'switch', 'timer',
      'valve', 'cap', 'light', 'bulb', 'belt', 'knob', 'rack', 'door shelf',
      'tray', 'tube', 'circuit board', 'touch pad', 'panel', 'bearing',
      'container', 'wheel', 'roller', 'coil', 'relay', 'sensor', 'filter'
    ];
    
    const commonBrands = [
      'whirlpool', 'ge', 'frigidaire', 'samsung', 'lg', 'maytag', 'kitchenaid',
      'bosch', 'kenmore', 'electrolux', 'amana', 'jenn-air', 'admiral'
    ];
    
    const brandPartCombos = [];
    commonBrands.forEach(brand => {
      partTypes.forEach(type => {
        brandPartCombos.push(`${brand} ${type}`);
      });
    });
    
    const mentionedTypes = partTypes.filter(type => lowerResponse.includes(type));
    const mentionedBrandPartCombos = brandPartCombos.filter(combo => lowerResponse.includes(combo));
    
    if (mentionedTypes.length > 0 || mentionedBrandPartCombos.length > 0) {
      filteredParts = parts.filter(part => {
        const partType = (part.metadata?.type || part.type || '').toLowerCase();
        const partTitle = (part.text || '').toLowerCase();
        const partBrand = (part.metadata?.brand || part.brand || '').toLowerCase();
        
        const hasType = mentionedTypes.some(type => partType.includes(type) || partTitle.includes(type));
        
        const hasBrandPartCombo = mentionedBrandPartCombos.some(combo => {
          const [brand, ...typeParts] = combo.split(' ');
          const type = typeParts.join(' ');
          return partBrand.includes(brand) && (partType.includes(type) || partTitle.includes(type));
        });
        
        return hasType || hasBrandPartCombo;
      });
    }
  }
  
  if (filteredParts.length === 0 && shouldShowPartCards(query, aiResponse)) {
    filteredParts = parts.slice(0, 5);
  }

  return filteredParts
    .sort((a, b) => {
      // First priority: Exact matches
      if (a.exactMatch !== b.exactMatch) {
        return a.exactMatch ? -1 : 1;
      }
      
      // Second priority: In stock items
      if (a.metadata?.inStock !== b.metadata?.inStock) {
        return a.metadata?.inStock ? -1 : 1;
      }
      
      // Third priority: Higher score (relevance)
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, 5);
}

// Find all part numbers mentioned in the response and add them to the results
async function enhancePartsWithResponseMentions(aiResponse, currentParts, allParts) {
  if (!aiResponse || !allParts || !Array.isArray(allParts)) {
    return currentParts;
  }
  
  const partNumberRegex = /PS\d+/gi;
  const mentionedPartNumbers = new Set();
  let match;
  
  while ((match = partNumberRegex.exec(aiResponse)) !== null) {
    mentionedPartNumbers.add(match[0].toUpperCase());
  }
  
  if (mentionedPartNumbers.size === 0) {
    return currentParts;
  }
  
  const currentPartNumbers = new Set(
    currentParts.map(p => 
      (p.partNumber || '').toUpperCase()
    )
  );
  
  const newMentionedPartNumbers = [...mentionedPartNumbers].filter(
    num => !currentPartNumbers.has(num)
  );
  
  if (newMentionedPartNumbers.length === 0) {
    return currentParts;
  }
  
  const mentionedParts = allParts.filter(part => {
    const partNumber = (
      part.metadata?.partNumber || 
      part.partNumber || 
      (part.text && part.text.match(/\(PS\d+\)/i) ? 
       part.text.match(/\(PS\d+\)/i)[0].replace(/[()]/g, '') : 
       '')
    ).toUpperCase();
    
    return newMentionedPartNumbers.includes(partNumber);
  });
  
  console.log(`Found ${mentionedParts.length} additional parts mentioned in AI response`);
  
  return [...currentParts, ...mentionedParts];
}

// Main chat endpoint
router.post('/', async (req, res) => {
  try {
    const { message, conversation = [], filters } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    console.log(`Processing chat request: "${message}"`);
    console.log(`Conversation history: ${JSON.stringify(conversation)}`);
    
    if (!isApplianceRelatedQuery(message)) {
      return res.json({
        response: "I specialize in refrigerator and dishwasher parts only. I'm unable to help with other appliances or unrelated topics. How can I help you find refrigerator or dishwasher parts today?",
        parts: []
      });
    }
    
    const partNumberMatch = message.match(/PS\d+/i);
    
    let searchParams = {
      limit: 10,
      filters: {}
    };
    
    if (partNumberMatch) {
      const partNumber = partNumberMatch[0];
      console.log(`Found part number in query: ${partNumber}`);
      searchParams.exactMatch = partNumber;
    }
    
    if (filters) {
      searchParams.filters = { ...searchParams.filters, ...filters };
    }
    
    // Perform vector search
    const results = await vectorDB.queryVectors(message, searchParams);
    console.log(`Found ${results.length} results from vector search`);
    
    const context = formatPartsContext(results);

    let promptConversation = [];
    if (conversation && Array.isArray(conversation)) {
      promptConversation = conversation.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }));
    }
    
    const response = await chatClient.getResponse(message, context, promptConversation);
    
    let relevantParts = filterRelevantParts(results, message, response);
    
    relevantParts = await enhancePartsWithResponseMentions(response, relevantParts, results);
    
    const formattedParts = relevantParts.map(part => {
      const extractedPartNumber = part.text && part.text.match(/\(PS\d+\)/i) 
        ? part.text.match(/\(PS\d+\)/i)[0].replace(/[()]/g, '') 
        : null;
        
      const partNumber = part.metadata?.partNumber || part.partNumber || extractedPartNumber || 'Unknown';
      
      const imageUrl = part.metadata?.imageUrl || part.imageUrl || 
        `https://www.partselect.com/assets/images/parts/${partNumber}.jpg`;
      
      const hasVideo = part.metadata?.hasVideo || part.hasVideo || false;
      
      const videoUrl = part.metadata?.videoUrl || part.videoUrl || 
        (hasVideo ? `https://www.partselect.com/Installation-Video-${partNumber}.htm` : null);
      
      return {
        partNumber,
        title: part.text?.split(':')[0] || 'Unknown Part',
        price: part.metadata?.price || part.price || '0.00',
        inStock: part.metadata?.inStock !== false,
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