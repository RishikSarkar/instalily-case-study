#!/usr/bin/env node
/**
 * Command line interface for running the PartSelect scraper
 * Provides options to configure the scraper behavior
 */
const { runScraper, runComprehensiveScraper, config } = require('./index');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const argMap = {};

// Process arguments
args.forEach(arg => {
  if (arg.startsWith('--')) {
    const [key, value] = arg.slice(2).split('=');
    argMap[key] = value !== undefined ? value : true;
  }
});

// Set environment variables based on arguments
if (argMap.maxParts) {
  process.env.MAX_PARTS_PER_PAGE = argMap.maxParts;
}

if (argMap.maxPages) {
  process.env.MAX_PAGES_PER_CATEGORY = argMap.maxPages;
}

if (argMap.delay) {
  process.env.DELAY_BETWEEN_REQUESTS = argMap.delay;
}

// Display help
if (argMap.help || argMap.h) {
  console.log('PartSelect Scraper CLI');
  console.log('=====================');
  console.log('Available commands:');
  console.log('  --help, -h                 Show this help message');
  console.log('  --maxParts=<number>        Set maximum parts per page to extract');
  console.log('  --maxPages=<number>        Set maximum pages per category to scrape');
  console.log('  --delay=<milliseconds>     Set delay between requests');
  console.log('  --generateData             Only regenerate consolidated data from existing parts');
  console.log('  --fullScrape               Run a full scrape with no limits (may take a long time)');
  console.log('  --checkMissing             Check for missing brands and part types in the data');
  console.log('\nExamples:');
  console.log('  node cli.js --maxParts=10 --maxPages=2 --delay=2000');
  console.log('  node cli.js --generateData');
  console.log('  node cli.js --fullScrape');
  console.log('  node cli.js --checkMissing');
  process.exit(0);
}

// Display current configuration
console.log('PartSelect Scraper Configuration:');
console.log(`- Max parts per page: ${config.maxPartsPerPage}`);
console.log(`- Max pages per category: ${config.maxPagesPerCategory}`);
console.log(`- Delay between requests: ${config.delayBetweenRequests}ms`);
console.log(`- Appliance types: ${config.applianceTypes.join(', ')}`);
console.log('');

// Check for missing brands and part types
if (argMap.checkMissing) {
  console.log('Checking for missing brands and part types in the consolidated data...');
  const consolidatedDataPath = path.join(__dirname, '../data/consolidated-data.json');
  
  // Check if consolidated data file exists
  if (!fs.existsSync(consolidatedDataPath)) {
    console.error('Consolidated data file not found. Run --generateData first.');
    process.exit(1);
  }
  
  // Load the consolidated data
  const consolidatedData = JSON.parse(fs.readFileSync(consolidatedDataPath, 'utf8'));
  
  // Define all expected brands
  const expectedDishwasherBrands = [
    'Admiral', 'Amana', 'Beko', 'Blomberg', 'Bosch', 'Caloric', 'Crosley', 
    'Dacor', 'Electrolux', 'Estate', 'Frigidaire', 'Gaggenau', 'GE', 'Gibson', 
    'Haier', 'Hotpoint', 'Inglis', 'Jenn-Air', 'Kelvinator', 'Kenmore', 'KitchenAid', 
    'LG', 'Magic Chef', 'Maytag', 'Norge', 'Roper', 'Samsung', 'SMEG', 'Speed Queen', 
    'Tappan', 'Thermador', 'Uni', 'Whirlpool', 'White-Westinghouse'
  ];
  
  const expectedRefrigeratorBrands = [
    'Admiral', 'Amana', 'Beko', 'Blomberg', 'Bosch', 'Caloric', 'Crosley', 
    'Dacor', 'Dynasty', 'Electrolux', 'Estate', 'Frigidaire', 'Gaggenau', 
    'GE', 'Gibson', 'Haier', 'Hardwick', 'Hoover', 'Hotpoint', 'Inglis', 
    'International', 'Jenn-Air', 'Kelvinator', 'Kenmore', 'KitchenAid', 'LG', 
    'Litton', 'Magic Chef', 'Maytag', 'Norge', 'RCA', 'Roper', 'Samsung', 
    'Sharp', 'SMEG', 'Tappan', 'Thermador', 'Uni', 'Whirlpool', 'White-Westinghouse'
  ];
  
  // Define all expected part types
  const expectedDishwasherPartTypes = [
    'Dishracks', 'Wheels and Rollers', 'Seals and Gaskets', 'Spray Arms', 
    'Hardware', 'Pumps', 'Latches', 'Elements and Burners', 'Valves', 
    'Hoses and Tubes', 'Filters', 'Brackets and Flanges', 'Hinges', 'Racks', 
    'Springs and Shock Absorbers', 'Caps and Lids', 'Switches', 'Dispensers', 
    'Circuit Boards and Touch Pads', 'Bearings', 'Motors', 'Thermostats', 
    'Panels', 'Sensors', 'Trays and Shelves', 'Grilles and Kickplates', 
    'Handles', 'Drawers and Glides', 'Knobs', 'Insulation', 'Timers', 
    'Ducts and Vents', 'Wire Plugs and Connectors', 'Doors', 'Legs and Feet', 
    'Trim', 'Manuals and Literature'
  ];
  
  const expectedRefrigeratorPartTypes = [
    'Trays and Shelves', 'Drawers and Glides', 'Filters', 'Ice Makers', 
    'Hardware', 'Seals and Gaskets', 'Switches', 'Hinges', 'Lights and Bulbs', 
    'Valves', 'Motors', 'Caps and Lids', 'Thermostats', 'Door Shelves', 
    'Wheels and Rollers', 'Handles', 'Hoses and Tubes', 'Doors', 
    'Elements and Burners', 'Circuit Boards and Touch Pads', 'Dispensers', 
    'Electronics', 'Sensors', 'Fans and Blowers', 'Brackets and Flanges', 
    'Timers', 'Bearings', 'Compressors', 'Springs and Shock Absorbers', 
    'Grilles and Kickplates', 'Latches', 'Knobs', 'Trim', 
    'Wire Plugs and Connectors', 'Tanks and Containers', 'Legs and Feet', 
    'Drip Bowls', 'Panels', 'Ducts and Vents', 'Insulation', 'Grates', 
    'Racks', 'Power Cords', 'Blades', 'Deflectors and Chutes', 'Starters', 
    'Manuals and Literature', 'Transformers'
  ];
  
  // Check for existing brands in the data
  const existingBrands = Object.keys(consolidatedData.relationships.byBrand);
  
  // Check for missing dishwasher brands
  const missingDishwasherBrands = expectedDishwasherBrands.filter(brand => 
    !existingBrands.includes(brand)
  );
  
  // Check for missing refrigerator brands
  const missingRefrigeratorBrands = expectedRefrigeratorBrands.filter(brand => 
    !existingBrands.includes(brand)
  );
  
  // Check for existing part types in the data
  const existingPartTypes = Object.keys(consolidatedData.relationships.byType);
  
  // Check for missing dishwasher part types
  const missingDishwasherPartTypes = expectedDishwasherPartTypes.filter(type => 
    !existingPartTypes.some(existingType => 
      existingType.toLowerCase() === type.toLowerCase()
    )
  );
  
  // Check for missing refrigerator part types
  const missingRefrigeratorPartTypes = expectedRefrigeratorPartTypes.filter(type => 
    !existingPartTypes.some(existingType => 
      existingType.toLowerCase() === type.toLowerCase()
    )
  );
  
  // Print results
  console.log('\nMissing Dishwasher Brands:');
  if (missingDishwasherBrands.length === 0) {
    console.log('None - All dishwasher brands are present');
  } else {
    missingDishwasherBrands.forEach(brand => console.log(`- ${brand}`));
  }
  
  console.log('\nMissing Refrigerator Brands:');
  if (missingRefrigeratorBrands.length === 0) {
    console.log('None - All refrigerator brands are present');
  } else {
    missingRefrigeratorBrands.forEach(brand => console.log(`- ${brand}`));
  }
  
  console.log('\nMissing Dishwasher Part Types:');
  if (missingDishwasherPartTypes.length === 0) {
    console.log('None - All dishwasher part types are present');
  } else {
    missingDishwasherPartTypes.forEach(type => console.log(`- ${type}`));
  }
  
  console.log('\nMissing Refrigerator Part Types:');
  if (missingRefrigeratorPartTypes.length === 0) {
    console.log('None - All refrigerator part types are present');
  } else {
    missingRefrigeratorPartTypes.forEach(type => console.log(`- ${type}`));
  }
  
  // Summary
  console.log('\nSummary:');
  console.log(`Found ${existingBrands.length} brands in the data`);
  console.log(`Missing ${missingDishwasherBrands.length} dishwasher brands`);
  console.log(`Missing ${missingRefrigeratorBrands.length} refrigerator brands`);
  console.log(`Found ${existingPartTypes.length} part types in the data`);
  console.log(`Missing ${missingDishwasherPartTypes.length} dishwasher part types`);
  console.log(`Missing ${missingRefrigeratorPartTypes.length} refrigerator part types`);
  
  process.exit(0);
}

// Generate consolidated data only
else if (argMap.generateData) {
  console.log('Generating consolidated data from existing part files...');
  require('./generate-consolidated-data');
}
// Full scrape with no limits
else if (argMap.fullScrape) {
  console.log('Running FULL comprehensive scraper with no limits');
  console.log('WARNING: This may take a long time and will generate a large amount of data.');
  process.env.MAX_PARTS_PER_PAGE = '1000';
  process.env.MAX_PAGES_PER_CATEGORY = '1000';
  runScraper().catch(err => {
    console.error('Error running scraper:', err);
    process.exit(1);
  });
}
// Standard scrape with current config
else {
  console.log('Running scraper with current configuration...');
  runScraper().catch(err => {
    console.error('Error running scraper:', err);
    process.exit(1);
  });
} 