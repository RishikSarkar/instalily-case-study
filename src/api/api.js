// Chat API client

/**
 * Sends a user query to the backend and gets a response
 * @param {string} userQuery - The user's message
 * @param {Array} conversationHistory - Previous messages in the conversation
 * @returns {Promise<Object>} - The assistant's response
 */
export const getAIMessage = async (userQuery, conversationHistory = []) => {
  try {
    // In development, the backend is at localhost:5000
    // In production, the backend is served from the same domain
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? '/api/chat' 
      : 'http://localhost:5000/api/chat';
    
    // Format the conversation history for the backend
    const formattedHistory = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // Send conversation history to maintain context
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
    
    // Check if the response indicates it's outside the appliance domain
    if (data.outsideDomain) {
      return {
        role: 'assistant',
        content: "I apologize, but I can only help with questions about refrigerator and dishwasher parts. If you have questions about other appliances or topics, please contact customer service.",
        parts: []
      };
    }
    
    // Add placeholders for image URLs and video URLs
    if (data.parts && Array.isArray(data.parts)) {
      data.parts = data.parts.map(part => ({
        ...part,
        // Generate fallback image URL if not provided
        imageUrl: part.imageUrl || null,
        // Generate video URL if not provided but we have installation data
        videoUrl: part.videoUrl || (part.hasInstallationVideo ? 
          `https://www.partselect.com/Installation-Video-${part.partNumber}.htm` : null)
      }));
      
      // Only include parts if relevant to the query
      if (data.shouldShowParts === false) {
        data.parts = [];
      }
    }
    
    // Format the response to match our expected format
    // The API returns { response: "text", parts: [...] }
    // We need to return { role: "assistant", content: "text", parts: [...] }
    return {
      role: 'assistant',
      content: data.response,
      parts: data.parts || []
    };
  } catch (error) {
    console.error('Error getting AI response:', error);
    
    // Return a fallback message
    return {
      role: 'assistant',
      content: "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
      parts: []
    };
  }
};
