// Scraper module index file

const { runComprehensiveScraper } = require('./comprehensive-scraper');
const config = require('../config/scraper-config');

function runScraper() {
  console.log('Running scraper with default configuration:');
  console.log(`- Max parts per page: ${config.maxPartsPerPage}`);
  console.log(`- Max pages per category: ${config.maxPagesPerCategory}`);
  console.log(`- Delay between requests: ${config.delayBetweenRequests}ms`);
  
  return runComprehensiveScraper();
}

module.exports = {
  runScraper,
  runComprehensiveScraper,
  config
}; 