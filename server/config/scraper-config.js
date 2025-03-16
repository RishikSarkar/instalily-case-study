/**
 * Configuration for the comprehensive scraper
 * These settings control the behavior of the scraper
 */

// Check for environment variables first, then use defaults
const config = {
  // Maximum number of parts to extract per page
  maxPartsPerPage: process.env.MAX_PARTS_PER_PAGE 
    ? parseInt(process.env.MAX_PARTS_PER_PAGE, 10) 
    : 1000, // Effectively no limit per page
  
  // Maximum number of pages to scrape per category
  maxPagesPerCategory: process.env.MAX_PAGES_PER_CATEGORY 
    ? parseInt(process.env.MAX_PAGES_PER_CATEGORY, 10) 
    : 1000, // Effectively no limit on pagination
  
  // Delay between requests in milliseconds to avoid being blocked
  delayBetweenRequests: process.env.DELAY_BETWEEN_REQUESTS 
    ? parseInt(process.env.DELAY_BETWEEN_REQUESTS, 10) 
    : 1500, // Reasonable delay
  
  // Target appliance types to scrape
  applianceTypes: ['refrigerator', 'dishwasher']
};

// Log configuration when this module is loaded
console.log('Scraper configuration:');
console.log(`- Max parts per page: ${config.maxPartsPerPage}`);
console.log(`- Max pages per category: ${config.maxPagesPerCategory}`);
console.log(`- Delay between requests: ${config.delayBetweenRequests}ms`);
console.log(`- Appliance types: ${config.applianceTypes.join(', ')}`);

module.exports = config; 