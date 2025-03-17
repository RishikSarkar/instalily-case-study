/**
 * Super simple test for Chat API
 */
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const data = JSON.stringify({
  message: 'The ice maker on my Whirlpool fridge is not working. How can I fix it?'
});

console.log('Sending request to chat API...');

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(responseData);
      console.log('\nFull response object:');
      console.log(JSON.stringify(parsedData, null, 2));
      
      if (parsedData.error) {
        console.log('\nError:');
        console.log(parsedData.error);
        console.log('Details:', parsedData.details);
      } else if (parsedData.response) {
        console.log('\nResponse from API:');
        console.log('=================');
        console.log(parsedData.response);
      }
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('Error with request:', error);
});

req.write(data);
req.end(); 