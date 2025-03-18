// Comprehensive scraper for PartSelect that recursively extracts all parts

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { fetchHtmlWithUserAgent, ensureDirectories, extractPartDetailPage } = require('../utils/htmlParser');
const { consolidateData } = require('../utils/consolidateData');
const config = require('../config/scraper-config');
const stateManager = require('../utils/stateManager');

// Base URLs and directories
const BASE_URL = 'https://www.partselect.com';
const DISHWASHER_URL = `${BASE_URL}/Dishwasher-Parts.htm`;
const REFRIGERATOR_URL = `${BASE_URL}/Refrigerator-Parts.htm`;

// Output directories
const DATA_DIR = path.join(__dirname, '../data');
const PARTS_DIR = path.join(DATA_DIR, 'parts');
const DISHWASHER_DIR = path.join(DATA_DIR, 'dishwasher');
const REFRIGERATOR_DIR = path.join(DATA_DIR, 'refrigerator');

// Set to track visited URLs to prevent duplicates
const visitedUrls = new Set();
const visitedPartUrls = new Set();

function setupDirectories() {
  ensureDirectories([
    DATA_DIR,
    PARTS_DIR,
    DISHWASHER_DIR,
    REFRIGERATOR_DIR,
    path.join(DISHWASHER_DIR, 'brands'),
    path.join(DISHWASHER_DIR, 'part-types'),
    path.join(DISHWASHER_DIR, 'models'),
    path.join(REFRIGERATOR_DIR, 'brands'),
    path.join(REFRIGERATOR_DIR, 'part-types'),
    path.join(REFRIGERATOR_DIR, 'models')
  ]);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

// Extract first price from possibly multiple prices
function cleanPrice(priceText) {
  if (!priceText) return '';
  
  // Try to extract first price that matches pattern $XX.XX
  const priceMatch = priceText.match(/\$\d+\.\d+/);
  if (priceMatch) {
    return priceMatch[0];
  }
  
  return priceText.trim();
}

// Normalize URL by ensuring it starts with base URL
function normalizeUrl(url) {
  if (!url) return '';
  
  // If already a full URL return
  if (url.startsWith('http')) {
    return url;
  }
  
  // If relative URL add base URL
  if (url.startsWith('/')) {
    return `${BASE_URL}${url}`;
  }
  
  // Otherwise add base URL with slash
  return `${BASE_URL}/${url}`;
}

// Determine if a URL is for a part detail page
function isPartDetailUrl(url) {
  return url && url.includes('/PS') && url.endsWith('.htm');
}

// Extract part data from a part element (.nf__part)
function extractPartData($, partElement) {
  const $part = $(partElement);
  
  // Part title
  const titleElement = $part.find('.nf__part__detail__title');
  const title = titleElement.text().trim();
  
  // Part URL
  const partUrl = normalizeUrl(titleElement.attr('href'));
  
  // Image URL
  const imgElement = $part.find('.nf__part__left-col__img img');
  const imageUrl = imgElement.attr('src') || imgElement.attr('data-src') || '';
  
  // Price
  const priceElement = $part.find('.price:not(.original-price)');
  const price = cleanPrice(priceElement.text());
  
  // Original price
  const originalPriceElement = $part.find('.price.original-price');
  const originalPrice = originalPriceElement.length ? cleanPrice(originalPriceElement.text()) : '';
  
  // Stock status
  const inStockElement = $part.find('.nf__part__left-col__basic-info__stock');
  const inStock = inStockElement.text().includes('In Stock');
  
  // Part numbers
  const partSelectNumber = $part.find('.nf__part__detail__part-number strong').first().text().trim();
  const manufacturerPartNumber = $part.find('.nf__part__detail__part-number').eq(1).find('strong').text().trim();
  
  // Description
  let description = '';
  const detailElement = $part.find('.nf__part__detail');
  const detailText = detailElement.clone().children('.nf__part__detail__symptoms, .nf__part__detail__instruction').remove().end().text();
  
  // Extract descr by removing the part numbers text
  if (detailText) {
    const partNumbersText = $part.find('.nf__part__detail__part-number').text();
    description = cleanText(detailText.replace(partNumbersText, ''));
  }
  
  // Ratings
  const ratingElement = $part.find('.nf__part__detail__rating');
  const ratingText = ratingElement.attr('alt') || '';
  const ratingMatch = ratingText.match(/(\d+\.\d+) out of 5/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
  
  const reviewCountElement = $part.find('.rating__count');
  const reviewCountText = reviewCountElement.text().trim();
  const reviewCountMatch = reviewCountText.match(/(\d+) Reviews?/);
  const reviewCount = reviewCountMatch ? parseInt(reviewCountMatch[1], 10) : 0;
  
  // Reviews
  let userReview = null;
  const instructionUser = $part.find('.nf__part__detail__instruction__creator').text().trim();
  const instructionTitle = $part.find('.nf__part__detail__instruction__quote .bold').text().trim();
  const instructionContent = $part.find('.nf__part__detail__instruction__quote span').text().trim();
  
  if (instructionUser || instructionTitle || instructionContent) {
    const locationMatch = instructionUser.match(/from (.+)$/);
    
    userReview = {
      user: instructionUser.replace(/from .+$/, '').trim(),
      location: locationMatch ? locationMatch[1].trim() : '',
      title: instructionTitle,
      content: instructionContent,
      date: ''
    };
  }
  
  // Symptoms
  const symptoms = [];
  $part.find('.nf__part__detail__symptoms li').each((i, el) => {
    const symptom = $(el).text().trim();
    if (symptom && !symptom.includes('See more')) {
      symptoms.push(symptom);
    }
  });
  
  const readMoreLinks = {};
  $part.find('a[href*="PS"]').each((i, el) => {
    const linkText = $(el).text().trim();
    const href = $(el).attr('href');
    
    if (linkText.includes('more') && href) {
      if (href.includes('#Instructions')) {
        readMoreLinks.instructions = normalizeUrl(href);
      } else if (href.includes('#Troubleshooting')) {
        readMoreLinks.symptoms = normalizeUrl(href);
      } else if (href.includes('#CustomerReview')) {
        readMoreLinks.reviews = normalizeUrl(href);
      } else {
        readMoreLinks.details = normalizeUrl(href);
      }
    }
  });
  
  return {
    title,
    partUrl,
    imageUrl,
    price,
    originalPrice,
    inStock,
    partSelectNumber,
    manufacturerPartNumber,
    description,
    rating,
    reviewCount,
    userReview,
    symptoms,
    readMoreLinks
  };
}

// Extract all parts from a page
async function extractPartsFromPage(html, context) {
  const $ = cheerio.load(html);
  const parts = [];
  
  $('.nf__part').each((i, el) => {
    if (i < config.maxPartsPerPage) {
      const partData = extractPartData($, el);
      partData.context = context;
      parts.push(partData);
    }
  });
  
  console.log(`Found ${parts.length} parts on page (limited to ${config.maxPartsPerPage})`);
  
  // Process part detail links - fetch and save each part
  let newPartsCount = 0;
  for (const part of parts) {
    if (part.partUrl && !visitedPartUrls.has(part.partUrl)) {
      visitedPartUrls.add(part.partUrl);
      
      if (stateManager.hasPart(part.partSelectNumber)) {
        console.log(`Skipping already processed part: ${part.partSelectNumber}`);
        continue;
      }
      
      // Save this part information
      const filename = `${part.partSelectNumber}_detail.json`;
      const outputPath = path.join(PARTS_DIR, filename);
      
      if (stateManager.addPart(part)) {
        fs.writeFileSync(outputPath, JSON.stringify(part, null, 2));
        console.log(`Saved part data: ${filename}`);
        newPartsCount++;
      }
      
      await delay(config.delayBetweenRequests);
    }
  }
  
  console.log(`Added ${newPartsCount} new parts out of ${parts.length} found on page`);
  return parts;
}

// Fetch and process a brand page
async function processBrandPage(url, context, pageNum = 1) {
  if (visitedUrls.has(url) || pageNum > config.maxPagesPerCategory) {
    console.log(`Skipping: ${url} (${pageNum > config.maxPagesPerCategory ? 'max pages reached' : 'already visited'})`);
    return;
  }
  
  visitedUrls.add(url);
  console.log(`Processing brand page: ${url} (page ${pageNum})`);
  
  try {
    const html = await fetchHtmlWithUserAgent(url);
    
    await extractPartsFromPage(html, context);
    
    const $ = cheerio.load(html);
    
    const nextPageLink = $('a:contains("Next")').attr('href');
    if (nextPageLink) {
      const nextPageUrl = normalizeUrl(nextPageLink);
      console.log(`Found next page: ${nextPageUrl}`);
      await processBrandPage(nextPageUrl, context, pageNum + 1);
    }
    
  } catch (error) {
    console.error(`Error processing brand page ${url}:`, error);
  }
}

// Process a part type page (e.g., Dishwasher Spray Arms)
async function processPartTypePage(url, context, pageNum = 1) {
  if (visitedUrls.has(url) || pageNum > config.maxPagesPerCategory) {
    console.log(`Skipping: ${url} (${pageNum > config.maxPagesPerCategory ? 'max pages reached' : 'already visited'})`);
    return;
  }
  
  visitedUrls.add(url);
  console.log(`Processing part type page: ${url} (page ${pageNum})`);
  
  try {
    const html = await fetchHtmlWithUserAgent(url);
    
    await extractPartsFromPage(html, context);
    
    const $ = cheerio.load(html);
    
    const nextPageLink = $('a:contains("Next")').attr('href');
    if (nextPageLink) {
      const nextPageUrl = normalizeUrl(nextPageLink);
      console.log(`Found next page: ${nextPageUrl}`);
      await processPartTypePage(nextPageUrl, context, pageNum + 1);
    }
    
  } catch (error) {
    console.error(`Error processing part type page ${url}:`, error);
  }
}

// Process a model page
async function processModelPage(url, context, pageNum = 1) {
  if (visitedUrls.has(url) || pageNum > config.maxPagesPerCategory) {
    console.log(`Skipping: ${url} (${pageNum > config.maxPagesPerCategory ? 'max pages reached' : 'already visited'})`);
    return;
  }
  
  visitedUrls.add(url);
  console.log(`Processing model page: ${url} (page ${pageNum})`);
  
  try {
    const html = await fetchHtmlWithUserAgent(url);
    
    await extractPartsFromPage(html, context);
    
    const $ = cheerio.load(html);
    
    const nextPageLink = $('a:contains("Next")').attr('href');
    if (nextPageLink) {
      const nextPageUrl = normalizeUrl(nextPageLink);
      console.log(`Found next page: ${nextPageUrl}`);
      await processModelPage(nextPageUrl, context, pageNum + 1);
    }
    
  } catch (error) {
    console.error(`Error processing model page ${url}:`, error);
  }
}

// Process the main appliance category page and extract all parts and links
async function processAppliancePage(url, context) {
  console.log(`Processing main ${context} page: ${url}`);
  
  try {
    const html = await fetchHtmlWithUserAgent(url);
    
    // 1. Extract parts directly from the main page
    await extractPartsFromPage(html, context);
    
    const $ = cheerio.load(html);
    
    // 2. Process brand links
    console.log(`\nExtracting ${context} brand links...`);
    const brandLinks = [];
    
    $('#ShopByBrand').next('ul.nf__links').find('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && text) {
        brandLinks.push({ text, href: normalizeUrl(href) });
      }
    });
    
    console.log(`Found ${brandLinks.length} brand links`);
    
    // 3. Process part type links
    console.log(`\nExtracting ${context} part type links...`);
    const partTypeLinks = [];
    
    $('#ShopByPartType').next('ul.nf__links').find('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && text) {
        partTypeLinks.push({ text, href: normalizeUrl(href) });
      }
    });
    
    if (partTypeLinks.length === 0) {
      $('h2:contains("Related")').next('ul.nf__links').find('a').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (href && text) {
          partTypeLinks.push({ text, href: normalizeUrl(href) });
        }
      });
    }
    
    console.log(`Found ${partTypeLinks.length} part type links`);
    
    // 4. Process model links
    console.log(`\nExtracting ${context} model links...`);
    const modelLinks = [];
    
    $('#TopModelsSectionTitle').next('ul.nf__links').find('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && text) {
        modelLinks.push({ text, href: normalizeUrl(href) });
      }
    });
    
    console.log(`Found ${modelLinks.length} model links`);
    
    const outputDir = context === 'dishwasher' ? DISHWASHER_DIR : REFRIGERATOR_DIR;
    
    fs.writeFileSync(
      path.join(outputDir, 'brand-links.json'),
      JSON.stringify(brandLinks, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'part-type-links.json'),
      JSON.stringify(partTypeLinks, null, 2)
    );
    
    fs.writeFileSync(
      path.join(outputDir, 'model-links.json'),
      JSON.stringify(modelLinks, null, 2)
    );
    
    console.log(`\nProcessing links for ${context}...`);
    console.log(`Using configuration: max ${config.maxPartsPerPage} parts per page, max ${config.maxPagesPerCategory} pages per category`);
    
    // Process brand pages (limited by maxPagesPerCategory)
    console.log('\nProcessing brand pages...');
    const maxBrands = Math.min(brandLinks.length, config.maxPagesPerCategory);
    for (let i = 0; i < maxBrands; i++) {
      await processBrandPage(brandLinks[i].href, context);
      await delay(config.delayBetweenRequests);
    }
    
    // Process part type pages (limited by maxPagesPerCategory)
    console.log('\nProcessing part type pages...');
    const maxPartTypes = Math.min(partTypeLinks.length, config.maxPagesPerCategory);
    for (let i = 0; i < maxPartTypes; i++) {
      await processPartTypePage(partTypeLinks[i].href, context);
      await delay(config.delayBetweenRequests);
    }
    
    // Process model pages (limited by maxPagesPerCategory)
    console.log('\nProcessing model pages...');
    const maxModels = Math.min(modelLinks.length, config.maxPagesPerCategory);
    for (let i = 0; i < maxModels; i++) {
      await processModelPage(modelLinks[i].href, context);
      await delay(config.delayBetweenRequests);
    }
    
    console.log(`Completed processing ${context} page and its links`);
    
  } catch (error) {
    console.error(`Error processing ${context} page:`, error);
  }
}

// Main function to run the comprehensive scraper
async function runComprehensiveScraper() {
  console.log('Starting comprehensive scraper...');
  console.log('Configuration:');
  console.log(`- Max parts per page: ${config.maxPartsPerPage}`);
  console.log(`- Max pages per category: ${config.maxPagesPerCategory}`);
  console.log(`- Delay between requests: ${config.delayBetweenRequests}ms`);
  
  const counts = stateManager.getCounts();
  console.log(`Current state: ${counts.parts} parts, ${counts.brands} brands, ${counts.categories} categories`);
  
  setupDirectories();
  
  // Process dishwasher parts
  await processAppliancePage(DISHWASHER_URL, 'dishwasher');
  
  // Process refrigerator parts
  await processAppliancePage(REFRIGERATOR_URL, 'refrigerator');
  
  console.log('Generating consolidated data file with relationship trees...');
  await consolidateData();
  
  stateManager.save();
  
  console.log('Comprehensive scraping completed.');
  console.log(`Final state: ${stateManager.getCounts().parts} total parts processed`);
}

// Check which brands and categories are missing from our database
async function checkMissingData() {
  console.log('Checking for missing brands and categories...');
  
  const dishwasherBrands = [
    'Admiral', 'Amana', 'Beko', 'Blomberg', 'Bosch', 'Caloric', 'Crosley', 
    'Dacor', 'Electrolux', 'Estate', 'Frigidaire', 'Gaggenau', 'GE', 'Gibson', 
    'Haier', 'Hotpoint', 'Inglis', 'Jenn-Air', 'Kelvinator', 'Kenmore', 
    'KitchenAid', 'LG', 'Magic Chef', 'Maytag', 'Norge', 'Roper', 'Samsung', 
    'SMEG', 'Speed Queen', 'Tappan', 'Thermador', 'Uni', 'Whirlpool', 
    'White-Westinghouse'
  ];
  
  const refrigeratorBrands = [
    'Admiral', 'Amana', 'Beko', 'Blomberg', 'Bosch', 'Caloric', 'Crosley', 
    'Dacor', 'Dynasty', 'Electrolux', 'Estate', 'Frigidaire', 'Gaggenau', 'GE', 
    'Gibson', 'Haier', 'Hardwick', 'Hoover', 'Hotpoint', 'Inglis', 'International', 
    'Jenn-Air', 'Kelvinator', 'Kenmore', 'KitchenAid', 'LG', 'Litton', 
    'Magic Chef', 'Maytag', 'Norge', 'RCA', 'Roper', 'Samsung', 'Sharp', 
    'SMEG', 'Tappan', 'Thermador', 'Uni', 'Whirlpool', 'White-Westinghouse'
  ];
  
  const dishwasherPartTypes = [
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
  
  const refrigeratorPartTypes = [
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
  
  // Combine part types
  const allPartTypes = [...new Set([...dishwasherPartTypes, ...refrigeratorPartTypes])];
  
  // Check missing brands
  const allBrands = [...new Set([...dishwasherBrands, ...refrigeratorBrands])];
  const missingBrands = stateManager.getMissingBrands(allBrands);
  
  // Check missing categories
  const missingCategories = stateManager.getMissingCategories(allPartTypes);
  
  console.log('\nMissing Brands:');
  console.log(missingBrands.join(', ') || 'None');
  
  console.log('\nMissing Part Types:');
  console.log(missingCategories.join(', ') || 'None');
  
  return {
    missingBrands,
    missingCategories
  };
}

// For running directly
if (require.main === module) {
  runComprehensiveScraper().catch(console.error);
}

module.exports = {
  runComprehensiveScraper,
  checkMissingData
}; 