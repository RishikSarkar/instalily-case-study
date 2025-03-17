/**
 * Test script for Chat API
 * 
 * Usage: node test-chat-api.js "your message here"
 */
const axios = require('axios');

// Get message from command line args
const message = process.argv[2] || "I need a water filter for my GE refrigerator";

console.log(`Testing chat API with message: "${message}"`);

// Make request to chat API
axios.post('http://localhost:5000/api/chat', { message })
  .then(response => {
    console.log('\nAPI Response:');
    console.log('==============');
    console.log(response.data.response);
    
    if (response.data.parts && response.data.parts.length > 0) {
      console.log('\nRelevant Parts Found:');
      console.log('====================');
      response.data.parts.forEach((part, i) => {
        console.log(`${i+1}. ${part.title}`);
        console.log(`   Part #: ${part.partNumber}`);
        console.log(`   Price: $${part.price}`);
        console.log(`   Status: ${part.inStock ? 'In Stock' : 'Out of Stock'}`);
        console.log(`   Type: ${part.type}`);
        console.log(`   Brand: ${part.brand}`);
        console.log('');
      });
    } else {
      console.log('\nNo specific parts were found for this query');
    }
  })
  .catch(error => {
    console.error('\nError calling chat API:');
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server. Make sure the server is running.');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
    }
  }); 