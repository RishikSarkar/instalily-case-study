#!/usr/bin/env node
/**
 * Command line interface for running the PartSelect scraper
 * Provides options to configure the scraper behavior
 */
const { runScraper, runComprehensiveScraper, config } = require('./scraper');
const { checkMissingData } = require('./scraper/comprehensive-scraper');
const stateManager = require('./utils/stateManager');
const { consolidateData } = require('./utils/consolidateData');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  help: args.includes('--help') || args.includes('-h'),
  scrapeAll: args.includes('--scrapeAll'),
  scrapeRecent: args.includes('--scrapeRecent'),
  checkMissing: args.includes('--checkMissing'),
  consolidate: args.includes('--consolidate'),
  showConfig: args.includes('--showConfig'),
  maxPartsPerPage: getArgValue(args, '--maxPartsPerPage'),
  maxPagesPerCategory: getArgValue(args, '--maxPagesPerCategory'),
  delayBetweenRequests: getArgValue(args, '--delayBetweenRequests'),
  applianceTypes: getArgValue(args, '--applianceTypes'),
  vectorize: args.includes('--vectorize'),
  resetVectors: args.includes('--resetVectors')
};

// Helper to get argument value
function getArgValue(args, name) {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

// Apply any configuration overrides from command line
if (options.maxPartsPerPage) {
  config.maxPartsPerPage = parseInt(options.maxPartsPerPage, 10);
}

if (options.maxPagesPerCategory) {
  config.maxPagesPerCategory = parseInt(options.maxPagesPerCategory, 10);
}

if (options.delayBetweenRequests) {
  config.delayBetweenRequests = parseInt(options.delayBetweenRequests, 10);
}

if (options.applianceTypes) {
  config.applianceTypes = options.applianceTypes.split(',').map(type => type.trim());
}

// Display the current configuration
console.log('Scraper configuration:');
console.log(`- Max parts per page: ${config.maxPartsPerPage}`);
console.log(`- Max pages per category: ${config.maxPagesPerCategory}`);
console.log(`- Delay between requests: ${config.delayBetweenRequests}ms`);
console.log(`- Appliance types: ${config.applianceTypes.join(', ')}`);

// Show help if requested
if (options.help) {
  console.log('\nUsage: node cli.js [options]');
  console.log('\nOptions:');
  console.log('  --help, -h                 Show this help message');
  console.log('  --scrapeAll                Run the full scraper for all appliance types');
  console.log('  --scrapeRecent             Run scraper but skip already processed parts');
  console.log('  --checkMissing             Check for missing brands and part types');
  console.log('  --consolidate              Just consolidate existing part data');
  console.log('  --showConfig               Display the current configuration');
  console.log('  --maxPartsPerPage <num>    Maximum parts to process per page');
  console.log('  --maxPagesPerCategory <num> Maximum pages to process per category');
  console.log('  --delayBetweenRequests <ms> Delay between HTTP requests in milliseconds');
  console.log('  --applianceTypes <types>   Comma-separated list of appliance types to scrape');
  console.log('  --vectorize                Vectorize consolidated data for semantic search');
  console.log('  --resetVectors             Reset vector database before vectorization');
  console.log('\nExample: node cli.js --scrapeRecent --maxPartsPerPage 100 --delayBetweenRequests 2000');
  process.exit(0);
}

// Show current state if requested
if (options.showConfig) {
  const counts = stateManager.getCounts();
  console.log('\nCurrent state:');
  console.log(`- Total parts processed: ${counts.parts}`);
  console.log(`- Known brands: ${counts.brands}`);
  console.log(`- Known part types: ${counts.categories}`);
  console.log(`- Last run: ${stateManager.lastRun || 'Never'}`);
  process.exit(0);
}

// Main execution
async function run() {
  try {
    if (options.vectorize) {
      console.log('\nVectorizing consolidated data for semantic search...');
      const vectorDB = require('./utils/vectorizeData');
      
      if (options.resetVectors) {
        console.log('Resetting vector database before vectorization...');
        await vectorDB.resetCollection();
      }
      
      await vectorDB.vectorizeAllData();
      console.log('Vectorization completed successfully');
    } 
    else if (options.checkMissing) {
      console.log('\nChecking for missing brands and part types...');
      await checkMissingData();
    } else if (options.consolidate) {
      console.log('\nJust consolidating existing part data...');
      await consolidateData();
    } else if (options.scrapeAll || options.scrapeRecent) {
      console.log(`\nRunning scraper with ${options.scrapeAll ? 'complete' : 'incremental'} mode...`);
      await runComprehensiveScraper();
    } else {
      console.log('\nRunning scraper with default configuration:');
      console.log(`- Max parts per page: ${config.maxPartsPerPage}`);
      console.log(`- Delay between requests: ${config.delayBetweenRequests}ms`);
      await runComprehensiveScraper();
    }
  } catch (error) {
    console.error('Error running scraper:', error);
    process.exit(1);
  }
}

// Run the program
run(); 