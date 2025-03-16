/**
 * Scraper module index file
 * Provides easy access to the scraper functionality
 */

const { runComprehensiveScraper } = require('./comprehensive-scraper');
const config = require('../config/scraper-config');

/**
 * Run the scraper with default configuration
 */
function runScraper() {
  console.log('Running scraper with default configuration:');
  console.log(`- Max parts per page: ${config.maxPartsPerPage}`);
  console.log(`- Max pages per category: ${config.maxPagesPerCategory}`);
  console.log(`- Delay between requests: ${config.delayBetweenRequests}ms`);
  
  return runComprehensiveScraper();
}

// Export the scraper functionality
module.exports = {
  runScraper,
  runComprehensiveScraper,
  config
}; 