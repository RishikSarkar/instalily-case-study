#!/usr/bin/env node
// PartSelect scraper command line tool
const { runScraper, runComprehensiveScraper, config } = require('./scraper');
const { checkMissingData } = require('./scraper/comprehensive-scraper');
const stateManager = require('./utils/stateManager');
const { consolidateData } = require('./utils/consolidateData');

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

function getArgValue(args, name) {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return null;
}

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

console.log('Scraper configuration:');
console.log(`- Max parts per page: ${config.maxPartsPerPage}`);
console.log(`- Max pages per category: ${config.maxPagesPerCategory}`);
console.log(`- Delay between requests: ${config.delayBetweenRequests}ms`);
console.log(`- Appliance types: ${config.applianceTypes.join(', ')}`);

if (options.help) {
  console.log('\nUsage: node cli.js [options]');
  console.log('\nOptions:');
  console.log('  --help, -h                 Show help');
  console.log('  --scrapeAll                Full scrape all appliance types');
  console.log('  --scrapeRecent             Skip processed parts');
  console.log('  --checkMissing             Find missing brands/types');
  console.log('  --consolidate              Merge existing part data');
  console.log('  --showConfig               Show current settings');
  console.log('  --maxPartsPerPage <num>    Parts per page limit');
  console.log('  --maxPagesPerCategory <num> Page limit per category');
  console.log('  --delayBetweenRequests <ms> Request delay in ms');
  console.log('  --applianceTypes <types>   Appliances to scrape');
  console.log('  --vectorize                Create search vectors');
  console.log('  --resetVectors             Clear existing vectors');
  console.log('\nExample: node cli.js --scrapeRecent --maxPartsPerPage 100');
  process.exit(0);
}

if (options.showConfig) {
  const counts = stateManager.getCounts();
  console.log('\nCurrent state:');
  console.log(`- Total parts: ${counts.parts}`);
  console.log(`- Brands: ${counts.brands}`);
  console.log(`- Part types: ${counts.categories}`);
  console.log(`- Last run: ${stateManager.lastRun || 'Never'}`);
  process.exit(0);
}

// Main scraper workflow
async function run() {
  try {
    if (options.vectorize) {
      console.log('\nCreating search vectors...');
      const vectorDB = require('./utils/vectorizeData');
      
      if (options.resetVectors) {
        console.log('Resetting vector database...');
        await vectorDB.resetVectors();
      }
      
      await vectorDB.vectorizeAllData();
      console.log('Vectorization complete');
    } 
    else if (options.checkMissing) {
      console.log('\nChecking for missing data...');
      await checkMissingData();
    } else if (options.consolidate) {
      console.log('\nMerging part data...');
      await consolidateData();
    } else if (options.scrapeAll || options.scrapeRecent) {
      console.log(`\nStarting ${options.scrapeAll ? 'full' : 'incremental'} scrape...`);
      await runComprehensiveScraper();
    } else {
      console.log('\nRunning default scraper:');
      console.log(`- Parts/page: ${config.maxPartsPerPage}`);
      console.log(`- Request delay: ${config.delayBetweenRequests}ms`);
      await runComprehensiveScraper();
    }
  } catch (error) {
    console.error('Scraper error:', error);
    process.exit(1);
  }
}

run(); 