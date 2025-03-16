// Chat API client

/**
 * Sends a user query to the backend and gets a response
 * @param {string} userQuery - The user's message
 * @returns {Promise<Object>} - The assistant's response
 */
export const getAIMessage = async (userQuery) => {
  try {
    // In development, the backend is at localhost:5000
    // In production, the backend is served from the same domain
    const backendUrl = process.env.NODE_ENV === 'production' 
      ? '/api/chat' 
      : 'http://localhost:5000/api/chat';
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: userQuery }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting AI response:', error);
    
    // Return a fallback message
    return {
      role: 'assistant',
      content: "I'm sorry, I'm having trouble connecting to the server. Please try again later."
    };
  }
};
