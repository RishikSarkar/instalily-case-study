// Configuration for the comprehensive scraper

const config = {
  maxPartsPerPage: process.env.MAX_PARTS_PER_PAGE 
    ? parseInt(process.env.MAX_PARTS_PER_PAGE, 10) 
    : 1000,
  
  maxPagesPerCategory: process.env.MAX_PAGES_PER_CATEGORY 
    ? parseInt(process.env.MAX_PAGES_PER_CATEGORY, 10) 
    : 1000,
  
  delayBetweenRequests: process.env.DELAY_BETWEEN_REQUESTS 
    ? parseInt(process.env.DELAY_BETWEEN_REQUESTS, 10) 
    : 1500,
  
  applianceTypes: ['refrigerator', 'dishwasher']
};

console.log('Scraper configuration:');
console.log(`- Max parts per page: ${config.maxPartsPerPage}`);
console.log(`- Max pages per category: ${config.maxPagesPerCategory}`);
console.log(`- Delay between requests: ${config.delayBetweenRequests}ms`);
console.log(`- Appliance types: ${config.applianceTypes.join(', ')}`);

module.exports = config; 