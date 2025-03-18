// Chat API handler

/**
 * Gets AI response for user query
 * @param {string} userQuery - User message
 * @param {Array} conversationHistory - Chat history
 * @returns {Promise<Object>} AI response
 */
export const getAIMessage = async (userQuery, conversationHistory = []) => {
  try {
    // Use prod URL or localhost
    const backendUrl = process.env.REACT_APP_API_URL 
      ? `${process.env.REACT_APP_API_URL}/api/chat`
      : 'http://localhost:5000/api/chat';
    
    // Format history for API
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        message: userQuery,
        conversation: formattedHistory 
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle non-appliance questions
    if (data.outsideDomain) {
      return {
        role: 'assistant',
        content: "I apologize, but I can only help with questions about refrigerator and dishwasher parts. If you have questions about other appliances or topics, please contact customer service.",
        parts: []
      };
    }
    
    // Add missing image/video URLs
    if (data.parts && Array.isArray(data.parts)) {
      data.parts = data.parts.map(part => ({
        ...part,
        imageUrl: part.imageUrl || null,
        videoUrl: part.videoUrl || (part.hasInstallationVideo ? 
          `https://www.partselect.com/Installation-Video-${part.partNumber}.htm` : null)
      }));
      
      if (data.shouldShowParts === false) {
        data.parts = [];
      }
    }
    
    return {
      role: 'assistant',
      content: data.response,
      parts: data.parts || []
    };
  } catch (error) {
    console.error('Error getting AI response:', error);
    
    return {
      role: 'assistant',
      content: "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
      parts: []
    };
  }
};
