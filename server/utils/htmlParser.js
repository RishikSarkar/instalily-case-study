const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const axios = require('axios');

// Define BASE_URL constant
const BASE_URL = 'https://www.partselect.com';

// Array of user agents to rotate between requests
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
];

// Get a random user agent from the array
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Sleep function to add delay between requests
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Clean text to remove excessive whitespace and special characters
 */
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .replace(/\n+/g, ' ') // Replace newlines with spaces
    .trim();
}

/**
 * Clean price data to extract just the first price
 * @param {string} priceText - Raw price text that might contain multiple prices
 * @returns {string} - Cleaned price value
 */
function cleanPrice(priceText) {
  if (!priceText) return '';
  
  // Remove currency symbols and whitespace first
  const cleanedText = priceText.replace(/[$\s]/g, '');
  
  // Look for repeating price patterns (like "39.8949.8639.8949.86")
  // Extract only the first valid price value
  const priceMatch = cleanedText.match(/^(\d+\.\d{2})/);
  if (priceMatch && priceMatch[1]) {
    return priceMatch[1];
  }
  
  // If no clear pattern match, just return the cleaned text
  return cleanedText;
}

/**
 * Fetch HTML content from a URL with custom user agent and retry logic
 * @param {string} url - URL to fetch
 * @param {number} retries - Number of retries (default: 3)
 * @param {number} delayMs - Delay between retries in milliseconds (default: 2000)
 * @returns {Promise<string>} - HTML content
 */
async function fetchHtmlWithUserAgent(url, retries = 3, delayMs = 2000) {
  let attempt = 0;
  
  while (attempt < retries) {
    try {
      const userAgent = getRandomUserAgent();
      console.log(`Fetching ${url} with user agent: ${userAgent}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/',
          'Cache-Control': 'no-cache'
        },
        timeout: 10000
      });
      
      if (response.status === 200) {
        return response.data;
      }
    } catch (error) {
      console.error(`Attempt ${attempt + 1}/${retries} failed for ${url}:`, error.message);
    }
    
    attempt++;
    console.log(`Waiting ${delayMs}ms before retry...`);
    await sleep(delayMs);
  }
  
  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

/**
 * Extract data from HTML content based on CSS selectors
 * @param {string} html - HTML content
 * @param {object} selectors - CSS selectors for extracting data
 * @returns {object} - Extracted data
 */
function extractDataFromHtml(html, selectors = {}) {
  const $ = cheerio.load(html);
  const result = {
    brands: [],
    parts: []
  };
  
  // Extract brands from main appliance or brand page
  const brandSelector = selectors.brands || '.semi-bold a, .brand_links a, .nf__links a';
  $(brandSelector).each((index, element) => {
    const brandName = $(element).text().trim();
    const brandUrl = $(element).attr('href');
    
    if (brandName && brandUrl && !brandName.includes('See all')) {
      result.brands.push({
        name: brandName,
        url: brandUrl
      });
    }
  });
  
  // Extract parts from a brand page or main popular parts section
  const partsSelector = selectors.parts || '.nf__part, .part-item, .product-item';
  const partTitleSelector = selectors.partTitle || '.nf__part__title, .part-title, .product-title';
  const partImageSelector = selectors.partImage || '.nf__part__img img, .part-image img, .product-image img';
  const partPriceSelector = selectors.partPrice || '.nf__part__price, .part-price, .price';
  const readMoreSelector = selectors.readMoreLink || '.nf__part__detail a[href*="PS"], a.part-detail-link, a[href*=".htm"]';
  
  $(partsSelector).each((index, element) => {
    const partElement = $(element);
    const part = {};
    
    // Extract part title
    const titleElement = partElement.find(partTitleSelector);
    if (titleElement.length) {
      part.title = cleanText(titleElement.text());
    }
    
    // Extract part image
    const imgElement = partElement.find(partImageSelector);
    if (imgElement.length) {
      part.imageUrl = imgElement.attr('data-src') || imgElement.attr('src');
      if (part.imageUrl && !part.imageUrl.startsWith('http')) {
        part.imageUrl = `https://www.partselect.com${part.imageUrl.startsWith('/') ? '' : '/'}${part.imageUrl}`;
      }
    }
    
    // Extract part price
    const priceElement = partElement.find(partPriceSelector);
    if (priceElement.length) {
      // Use cleanPrice to handle cases with multiple prices
      part.price = cleanPrice(priceElement.text());
    }
    
    // Extract the "Read more" or detail link
    const readMoreElement = partElement.find(readMoreSelector);
    if (readMoreElement.length) {
      let detailUrl = readMoreElement.attr('href');
      
      // Make relative URLs absolute
      if (detailUrl && !detailUrl.startsWith('http')) {
        detailUrl = `https://www.partselect.com${detailUrl.startsWith('/') ? '' : '/'}${detailUrl}`;
      }
      
      part.detailUrl = detailUrl;
    } else {
      // If no direct link is found, try to construct it from other elements
      
      // First look for any link in the part container
      let foundDetailLink = false;
      partElement.find('a').each((i, link) => {
        const href = $(link).attr('href');
        if (href && (href.includes('PS') || href.includes('-') && href.includes('.htm'))) {
          part.detailUrl = href.startsWith('http') ? href : `https://www.partselect.com${href.startsWith('/') ? '' : '/'}${href}`;
          foundDetailLink = true;
          return false; // break the loop
        }
      });
      
      // If still no link, check if we can construct it from part number or title
      if (!foundDetailLink && part.title) {
        // Search for a part number in the title (like PS12345678)
        const psMatch = part.title.match(/PS\d+/);
        if (psMatch) {
          part.detailUrl = `https://www.partselect.com/${psMatch[0]}.htm`;
        }
      }
    }
    
    // Only add parts with titles and detail URLs
    if (part.title && part.detailUrl) {
      result.parts.push(part);
    }
  });
  
  // If we're on a part detail page, extract all the detailed information
  if (selectors === SELECTORS.partDetailPage) {
    // For part detail pages, extract using the extractPartDetailPage function
    const details = extractPartDetailPage(html, selectors);
    
    // Merge the details with the result
    return { ...result, ...details };
  }
  
  return result;
}

/**
 * Process HTML content and extract structured data based on selectors
 * @param {string} html - HTML content
 * @param {object} selectors - Object containing CSS selectors for different data elements
 * @returns {object} - Extracted data
 */
function extractDataFromHtml(html, selectors = {}) {
  const $ = cheerio.load(html);
  const defaultSelectors = {
    partContainer: '.nf__part',
    partTitle: '.nf__part__detail__title span',
    partSelectNumber: '.nf__part__detail__part-number strong:first-child',
    manufacturerPartNumber: '.nf__part__detail__part-number:eq(1) strong',
    price: '.price:not(.original-price)', // Don't get the crossed-out prices
    description: '.nf__part__detail',
    symptoms: '.nf__part__detail__symptoms li',
    image: '.nf__part__left-col__img img',
    brands: '.semi-bold a',
    readMoreLink: '.nf__part__detail a[href*="PS"]',
    installationInstructions: '.nf__part__detail__instruction__quote span',
    customerReviews: '.nf__part__detail__instruction'
  };
  
  const activeSelectors = { ...defaultSelectors, ...selectors };
  
  // Extract brands data (if this is a brand listing page)
  const brands = [];
  $(activeSelectors.brands).each((index, element) => {
    const name = $(element).text().trim();
    const url = $(element).attr('href');
    
    if (name && url) {
      brands.push({ name, url });
    }
  });
  
  // Extract parts data
  const parts = [];
  $(activeSelectors.partContainer).each((index, element) => {
    const part = {
      title: $(element).find(activeSelectors.partTitle).text().trim(),
      partSelectNumber: '',
      manufacturerPartNumber: '',
      price: '',
      description: '',
      symptoms: [],
      imageUrl: '',
      detailUrl: ''
    };
    
    // Extract PartSelect Number
    const psNumber = $(element).find(activeSelectors.partSelectNumber).text().trim();
    if (psNumber) {
      part.partSelectNumber = psNumber;
    }
    
    // Extract Manufacturer Part Number
    const mfrNumber = $(element).find(activeSelectors.manufacturerPartNumber).text().trim();
    if (mfrNumber) {
      part.manufacturerPartNumber = mfrNumber;
    }
    
    // Extract price - only the current price, not crossed-out ones
    const priceEl = $(element).find(activeSelectors.price).first();
    if (priceEl.length) {
      // Use cleanPrice to handle multiple prices
      part.price = cleanPrice(priceEl.text().trim());
    }
    
    // Extract description - carefully extract text between part numbers and symptoms/instructions
    const detailEl = $(element).find(activeSelectors.description);
    if (detailEl.length) {
      // Get all text nodes directly under the detail element
      // This might need refinement as it's trying to extract text between elements
      const descriptionNodes = [];
      detailEl.contents().each((i, node) => {
        if (node.type === 'text' && $(node).text().trim()) {
          descriptionNodes.push($(node).text().trim());
        }
      });
      
      if (descriptionNodes.length > 0) {
        part.description = cleanText(descriptionNodes.join(' '));
      }
    }
    
    // Extract symptoms
    $(element).find(activeSelectors.symptoms).each((i, symptomEl) => {
      const symptomText = $(symptomEl).text().trim();
      // Skip "See more" links
      if (symptomText && !symptomText.includes('See more')) {
        part.symptoms.push(symptomText);
      }
    });
    
    // Extract image URL
    const imgEl = $(element).find(activeSelectors.image);
    if (imgEl.length) {
      part.imageUrl = imgEl.attr('src');
    }
    
    // Extract "Read more" link to get the full part detail page URL
    // Try multiple approaches to find the link
    let readMoreLink = null;
    
    // Method 1: Look for links with PS in the URL
    $(element).find('a[href*="PS"]').each((i, linkEl) => {
      const href = $(linkEl).attr('href');
      // Make sure it looks like a part detail page URL
      if (href && (href.includes('/PS') && href.includes('.htm'))) {
        readMoreLink = href;
        return false; // break the loop
      }
    });
    
    // Method 2: Try title link if no explicit "Read more" link found
    if (!readMoreLink) {
      const titleLink = $(element).find('.nf__part__detail__title').attr('href');
      if (titleLink) {
        readMoreLink = titleLink;
      }
    }
    
    if (readMoreLink) {
      // Make sure it's an absolute URL
      part.detailUrl = readMoreLink.startsWith('http') ? 
        readMoreLink : `${BASE_URL}${readMoreLink.startsWith('/') ? '' : '/'}${readMoreLink}`;
      
      // Add SourceCode parameter if missing
      if (!part.detailUrl.includes('SourceCode=')) {
        part.detailUrl = part.detailUrl.includes('?') ? 
          `${part.detailUrl}&SourceCode=18` : 
          `${part.detailUrl}?SourceCode=18`;
      }
    }
    
    parts.push(part);
  });
  
  return { brands, parts };
}

/**
 * Process a URL and extract structured data into JSON
 * @param {string} url - URL to process
 * @param {string} outputJsonPath - Path where the JSON output will be saved
 * @param {object} selectors - CSS selectors for different data elements
 * @returns {Object|null} - The extracted data or null if there was an error
 */
async function processUrlToJson(url, outputJsonPath, selectors = {}) {
  try {
    console.log(`Processing URL: ${url}`);
    
    // Fetch HTML with user agent
    const html = await fetchHtmlWithUserAgent(url);
    
    // Extract data from HTML
    const outputData = extractDataFromHtml(html, selectors);
    
    // Write to JSON file
    fs.writeFileSync(outputJsonPath, JSON.stringify(outputData, null, 2));
    console.log(`Successfully processed ${url} to ${outputJsonPath}`);
    
    return outputData;
  } catch (error) {
    console.error(`Error processing ${url}:`, error.message);
    return null;
  }
}

/**
 * Process an HTML file and extract structured data into JSON
 * @param {string} htmlFilePath - Path to the HTML file
 * @param {string} outputJsonPath - Path where the JSON output will be saved
 * @param {object} selectors - CSS selectors for different data elements
 * @returns {Object|null} - The extracted data or null if there was an error
 */
async function processHtmlToJson(htmlFilePath, outputJsonPath, selectors = {}) {
  try {
    // Read HTML file
    const html = fs.readFileSync(htmlFilePath, 'utf8');
    
    // Extract data from HTML
    const outputData = extractDataFromHtml(html, selectors);
    
    // Write to JSON file
    fs.writeFileSync(outputJsonPath, JSON.stringify(outputData, null, 2));
    console.log(`Successfully processed ${htmlFilePath} to ${outputJsonPath}`);
    
    return outputData;
  } catch (error) {
    console.error(`Error processing ${htmlFilePath}:`, error);
    return null;
  }
}

/**
 * Process all HTML files in a directory and convert them to JSON
 * @param {string} directory - Directory containing HTML files
 * @param {string} outputDirectory - Directory where JSON files will be saved
 * @param {object} selectors - CSS selectors for different data elements
 */
async function processAllHtmlFiles(directory, outputDirectory, selectors = {}) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }
  
  // Get all HTML files
  const files = fs.readdirSync(directory)
    .filter(file => file.endsWith('.htm') || file.endsWith('.html'));
  
  console.log(`Found ${files.length} HTML files in ${directory}`);
  
  for (const file of files) {
    const htmlPath = path.join(directory, file);
    const jsonFilename = file.replace(/\.html?$/, '.json');
    const jsonPath = path.join(outputDirectory, jsonFilename);
    
    await processHtmlToJson(htmlPath, jsonPath, selectors);
    
    // Add delay between processing files to avoid overwhelming resources
    await sleep(1000);
  }
}

/**
 * Process multiple URLs and convert them to JSON
 * @param {string[]} urls - Array of URLs to process
 * @param {string} outputDirectory - Directory where JSON files will be saved
 * @param {object} selectors - CSS selectors for different data elements
 * @param {number} delayBetweenRequestsMs - Delay between requests in milliseconds
 */
async function processMultipleUrls(urls, outputDirectory, selectors = {}, delayBetweenRequestsMs = 3000) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }
  
  console.log(`Processing ${urls.length} URLs...`);
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const urlObj = new URL(url);
    const filename = path.basename(urlObj.pathname).replace(/\.html?$/, '') || 'index';
    const jsonPath = path.join(outputDirectory, `${filename}.json`);
    
    await processUrlToJson(url, jsonPath, selectors);
    
    // Add delay between requests to avoid hitting rate limits
    if (i < urls.length - 1) {
      console.log(`Waiting ${delayBetweenRequestsMs}ms before next request...`);
      await sleep(delayBetweenRequestsMs);
    }
  }
}

/**
 * Ensure data directories exist
 * @param {string[]} dirPaths - Array of directory paths to ensure
 */
function ensureDirectories(dirPaths) {
  dirPaths.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Update the selectors for part detail pages
const SELECTORS = {
  brandPage: {
    brands: '.semi-bold a, .brand_links a, .nf__links a',
    parts: '.nf__part, .part-item, .product-item',
    partTitle: '.nf__part__title, .part-title, .product-title',
    partImage: '.nf__part__img img, .part-image img, .product-image img',
    partPrice: '.nf__part__price, .part-price, .price',
    readMoreLink: '.nf__part__detail a[href*="PS"], a.part-detail-link, a[href*=".htm"]',
    pagination: '.pagination a, .next a, a:contains("Next")',
  },
  partDetailPage: {
    title: 'h1, .product-title, .part-title, .page-title',
    partSelectNumber: '.nf__part__detail__part-number strong:contains("PartSelect Number"), .ps-number-label + strong',
    manufacturerPartNumber: '.nf__part__detail__part-number strong:contains("Manufacturer Part Number"), .mfr-number-label + strong',
    price: '.price:not(.original-price), .current-price, .your-price',
    originalPrice: '.price.original-price, .original-price, .was-price',
    stockStatus: '.stock-status, .availability, .in-stock',
    description: '.product-description, .part-description, .description-text',
    installationInstructions: '.installation-instructions, .install-instructions',
    reviews: '.customer-reviews, .review-container',
    compatibleModels: '.compatible-models, .fits-models',
    relatedParts: '.related-parts, .similar-parts',
    symptoms: '.symptoms, .fixes-symptoms, .fixes-these-symptoms'
  },
};

/**
 * Extract part details from a part detail page
 * @param {string} html - HTML content of the part detail page
 * @param {object} selectors - Optional selectors for extracting data
 * @returns {object} - Part details
 */
function extractPartDetailPage(html, selectors = SELECTORS.partDetailPage) {
  const $ = cheerio.load(html);
  const details = {};
  
  // Extract basic part information
  details.sourceUrl = ''; // Will be filled by the caller
  
  // Print all h1 elements to debug
  console.log("All H1 elements:");
  $('h1').each((i, el) => {
    console.log($(el).text().trim());
  });
  
  // Extract title - try multiple selectors to find the product title
  const titleSelectors = ['h1', '.product-title h1', '.product-title', '.page-title', 'h1.product-heading'];
  for (const selector of titleSelectors) {
    const el = $(selector);
    if (el.length) {
      details.title = cleanText(el.first().text());
      console.log(`Found title using selector '${selector}': ${details.title}`);
      break;
    }
  }
  
  // Extract part numbers
  // Try to find the PartSelect Number
  const psSelectors = [
    '.product-specs:contains("PartSelect Number")', 
    'span:contains("PartSelect Number")',
    '.pd__part-number',
    '.nf__part__detail__part-number'
  ];
  
  for (const selector of psSelectors) {
    const el = $(selector);
    if (el.length) {
      const psMatch = el.text().match(/PS\d+/);
      if (psMatch) {
        details.partSelectNumber = psMatch[0];
        console.log(`Found PartSelect Number: ${details.partSelectNumber}`);
        break;
      }
    }
  }
  
  // If still not found, try to extract it from the URL in the sourceUrl field
  if (!details.partSelectNumber && details.sourceUrl) {
    const urlMatch = details.sourceUrl.match(/PS\d+/);
    if (urlMatch) {
      details.partSelectNumber = urlMatch[0];
      console.log(`Extracted PartSelect Number from URL: ${details.partSelectNumber}`);
    }
  }
  
  // Try to find the Manufacturer Part Number
  const mfrSelectors = [
    '.product-specs:contains("Manufacturer Part Number")', 
    'span:contains("Manufacturer Part Number")',
    '.nf__part__detail__part-number:contains("Manufacturer")'
  ];
  
  for (const selector of mfrSelectors) {
    const el = $(selector);
    if (el.length) {
      const text = el.text();
      console.log(`Found text for manufacturer part: ${text}`);
      
      // Different patterns to match the manufacturer part number
      const patterns = [
        /Number\s+([A-Za-z0-9-]+)/,
        /Manufacturer\s+Part\s+Number\s+([A-Za-z0-9-]+)/,
        /Manufacturer:\s+([A-Za-z0-9-]+)/
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          details.manufacturerPartNumber = match[1].trim();
          console.log(`Found Manufacturer Part Number: ${details.manufacturerPartNumber}`);
          break;
        }
      }
      if (details.manufacturerPartNumber) break;
    }
  }
  
  // Extract price - find the current price, not the crossed-out price
  const priceSelectors = [
    '.price:not(.original-price)', 
    '.your-price:contains("Your Price")',
    '.price',
    '.pd__price'
  ];
  
  for (const selector of priceSelectors) {
    const el = $(selector);
    if (el.length) {
      const rawPrice = el.first().text();
      details.price = cleanPrice(rawPrice);
      console.log(`Found price using selector '${selector}': ${details.price} (raw: ${rawPrice})`);
      break;
    }
  }
  
  // Extract stock status
  const stockSelectors = [
    'span:contains("In Stock")', 
    '.stock-status',
    '.availability'
  ];
  
  for (const selector of stockSelectors) {
    const el = $(selector);
    if (el.length) {
      details.stockStatus = cleanText(el.first().text());
      console.log(`Found stock status: ${details.stockStatus}`);
      break;
    }
  }
  
  if (!details.stockStatus) {
    details.stockStatus = 'Unknown';
  }
  
  // Extract description - this is usually a paragraph following the part numbers
  const descSelectors = [
    '.product-description', 
    '.part-description', 
    '.pd__description',
    'p.description',
    '.nf__part__detail > p'
  ];
  
  for (const selector of descSelectors) {
    const el = $(selector);
    if (el.length) {
      details.description = cleanText(el.first().text());
      console.log(`Found description using selector '${selector}': ${details.description.substring(0, 50)}...`);
      break;
    }
  }
  
  // If still no description, look for any paragraph that seems substantial
  if (!details.description) {
    $('p').each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 100 && !details.description) {
        details.description = cleanText(text);
        console.log(`Found description in generic paragraph: ${details.description.substring(0, 50)}...`);
      }
    });
  }
  
  // Extract installation instructions
  const installSelectors = [
    '.installation-instructions', 
    '.install-instructions', 
    '.customer-instruction',
    '.pd__cust-review__submitted-review'
  ];
  
  for (const selector of installSelectors) {
    const el = $(selector);
    if (el.length) {
      details.installationInstructions = cleanText(el.first().text());
      console.log(`Found installation instructions using selector '${selector}'`);
      break;
    }
  }
  
  // Extract reviews
  const reviewSelectors = [
    '.reviews', 
    '.customer-reviews', 
    '.ratings-container',
    '.pd__cust-review'
  ];
  
  for (const selector of reviewSelectors) {
    const section = $(selector);
    if (section.length) {
      console.log(`Found reviews section using selector '${selector}'`);
      
      let averageRating = 0;
      let reviewCount = 0;
      
      // Try to extract rating info
      const ratingText = section.find('.rating, .star-rating, .rating__stars').text();
      const ratingMatch = ratingText.match(/[\d.]+/);
      if (ratingMatch) {
        averageRating = parseFloat(ratingMatch[0]);
      }
      
      // Try to extract review count
      const countText = section.find('.review-count, .ratings-count, .rating__count').text();
      const countMatch = countText.match(/\d+/);
      if (countMatch) {
        reviewCount = parseInt(countMatch[0], 10);
      }
      
      details.reviews = {
        averageRating,
        count: reviewCount,
        items: []
      };
      
      // Extract individual reviews
      const reviewItemSelectors = [
        '.review-item', 
        '.customer-review', 
        '.pd__cust-review__submitted-review'
      ];
      
      for (const itemSelector of reviewItemSelectors) {
        section.find(itemSelector).each((i, el) => {
          const reviewEl = $(el);
          
          // Different selectors for review components
          const titleSelectors = ['.review-title', '.review-heading', '.bold:not(.pd__cust-review__submitted-review__header)'];
          const textSelectors = ['.review-text', '.review-content', '.js-searchKeys'];
          const authorSelectors = ['.review-author', '.reviewer-name', '.pd__cust-review__submitted-review__header'];
          
          let title = '';
          let text = '';
          let author = '';
          let date = '';
          
          // Extract title
          for (const s of titleSelectors) {
            const titleEl = reviewEl.find(s);
            if (titleEl.length) {
              title = cleanText(titleEl.text());
              break;
            }
          }
          
          // Extract text
          for (const s of textSelectors) {
            const textEl = reviewEl.find(s);
            if (textEl.length) {
              text = cleanText(textEl.text());
              break;
            }
          }
          
          // Extract author and date
          for (const s of authorSelectors) {
            const authorEl = reviewEl.find(s);
            if (authorEl.length) {
              const authorText = authorEl.text().trim();
              // Try to separate author and date (often in format "Author - Date")
              const authorMatch = authorText.match(/([^-]+)-\s*(.*)/);
              if (authorMatch) {
                author = authorMatch[1].trim();
                date = authorMatch[2].trim();
              } else {
                author = authorText;
              }
              break;
            }
          }
          
          if (text && text.length > 0) {
            details.reviews.items.push({
              title,
              text,
              author: author || 'Anonymous',
              date: date || ''
            });
            console.log(`Found review: "${title}" by ${author}`);
          }
        });
        
        if (details.reviews.items.length > 0) break;
      }
      
      break;
    }
  }
  
  // Extract compatible models
  const modelSelectors = [
    '.compatible-models', 
    '.models-list',
    '.fits-models',
    '.nf__part__detail__compatibility'
  ];
  
  for (const selector of modelSelectors) {
    const section = $(selector);
    if (section.length) {
      details.compatibleModels = [];
      section.find('li, .model-item').each((i, el) => {
        const model = cleanText($(el).text());
        if (model && !model.includes('See more')) {
          details.compatibleModels.push(model);
        }
      });
      
      if (details.compatibleModels.length > 0) {
        console.log(`Found ${details.compatibleModels.length} compatible models`);
        break;
      }
    }
  }
  
  // Extract symptoms fixed
  const symptomSelectors = [
    '.fixes-symptoms', 
    '.symptoms-list', 
    '.symptoms',
    '.nf__part__detail__symptoms'
  ];
  
  for (const selector of symptomSelectors) {
    const section = $(selector);
    if (section.length) {
      details.symptoms = [];
      section.find('li, .symptom-item').each((i, el) => {
        const symptom = cleanText($(el).text());
        if (symptom && !symptom.includes('See more')) {
          details.symptoms.push(symptom);
        }
      });
      
      if (details.symptoms.length > 0) {
        console.log(`Found ${details.symptoms.length} symptoms`);
        break;
      }
    }
  }
  
  // If we still don't have any data, try to parse from the URL
  if ((!details.title || !details.partSelectNumber) && details.sourceUrl) {
    console.log("Attempting to extract details from URL:", details.sourceUrl);
    try {
      const urlPath = details.sourceUrl.split('?')[0];
      const urlParts = urlPath.split('/').pop().split('.')[0].split('-');
      
      // URL format is typically: /PS12345678-Brand-PartNumber-Title.htm
      if (urlParts.length >= 4 && urlParts[0].includes('PS')) {
        if (!details.partSelectNumber) {
          details.partSelectNumber = urlParts[0];
          console.log(`Extracted PartSelect Number from URL: ${details.partSelectNumber}`);
        }
        
        if (!details.manufacturerPartNumber && urlParts[2]) {
          details.manufacturerPartNumber = urlParts[2];
          console.log(`Extracted Manufacturer Part Number from URL: ${details.manufacturerPartNumber}`);
        }
        
        if (!details.title && urlParts.length > 3) {
          details.title = urlParts.slice(3).join(' ').replace(/-/g, ' ');
          console.log(`Extracted title from URL: ${details.title}`);
        }
      }
    } catch (error) {
      console.error("Error extracting details from URL:", error.message);
    }
  }
  
  // Extract image URL - look for the main product image
  const imageSelectors = [
    '.product-image img',
    '.nf__part__left-col__img img',
    '.main-image img',
    '.pd__img img',
    'img.js-imgTagHelper',
    'img.b-lazy',
    '.product-page-image img'
  ];
  
  // Create an array to store all images
  details.images = [];
  
  // Extract the main product image
  for (const selector of imageSelectors) {
    const el = $(selector);
    if (el.length) {
      // Try various image attributes - modern sites use data-src or srcset for lazy loading
      const imgSrc = el.attr('data-src') || el.attr('src') || el.attr('data-original');
      if (imgSrc) {
        const fullImageUrl = imgSrc.startsWith('http') ? imgSrc : `https://www.partselect.com${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`;
        details.imageUrl = fullImageUrl;
        details.images.push({
          url: fullImageUrl,
          isPrimary: true,
          caption: el.attr('alt') || 'Main Product Image',
          type: 'product'
        });
        console.log(`Found main image URL: ${fullImageUrl}`);
        break;
      }
    }
  }
  
  // Extract additional product images
  $('.product-images img, .thumbnail-images img, .additional-images img, .product-thumbnails img').each((i, el) => {
    const imgEl = $(el);
    const imgSrc = imgEl.attr('data-src') || imgEl.attr('src') || imgEl.attr('data-original');
    
    if (imgSrc && !details.images.some(img => img.url.includes(imgSrc))) {
      const fullImageUrl = imgSrc.startsWith('http') ? imgSrc : `https://www.partselect.com${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`;
      details.images.push({
        url: fullImageUrl,
        isPrimary: false,
        caption: imgEl.attr('alt') || 'Additional Product Image',
        type: 'product'
      });
      console.log(`Found additional image: ${fullImageUrl}`);
    }
  });
  
  // If still no image, look for background images in style attributes
  if (!details.imageUrl) {
    $('[style*="background"]').each((i, el) => {
      const style = $(el).attr('style');
      if (style && style.includes('url(')) {
        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match && match[1]) {
          const fullImageUrl = match[1].startsWith('http') ? match[1] : `https://www.partselect.com${match[1].startsWith('/') ? '' : '/'}${match[1]}`;
          details.imageUrl = fullImageUrl;
          details.images.push({
            url: fullImageUrl,
            isPrimary: true,
            caption: 'Product Image (Background)',
            type: 'product'
          });
          console.log(`Found background image URL: ${fullImageUrl}`);
          return false; // break the loop
        }
      }
    });
  }
  
  // Extract video tutorials
  details.videoTutorials = [];
  $('.yt-video, [data-yt-init], .youtube-video, .video-container').each((i, el) => {
    const videoEl = $(el);
    const videoId = videoEl.attr('data-yt-init') || videoEl.attr('data-video-id') || '';
    
    // Try to extract from iframe src if no data attribute
    if (!videoId) {
      const iframe = videoEl.find('iframe');
      if (iframe.length) {
        const src = iframe.attr('src') || '';
        const srcMatch = src.match(/\/embed\/([^\/\?]+)/);
        if (srcMatch && srcMatch[1]) {
          videoId = srcMatch[1];
        }
      }
    }
    
    if (videoId) {
      // Get video title and thumbnail
      const videoImg = videoEl.find('img');
      const videoTitle = videoImg.attr('title') || videoImg.attr('alt') || 'Installation Video';
      let thumbnailUrl = videoImg.attr('src') || '';
      
      // If no thumbnail, construct the default YouTube thumbnail URL
      if (!thumbnailUrl && videoId) {
        thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
      
      // Add to video tutorials
      details.videoTutorials.push({
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: videoTitle,
        thumbnailUrl,
        description: videoEl.closest('.row').find('h4').text().trim() || 'Installation Tutorial'
      });
      
      // Also add as an image
      details.images.push({
        url: thumbnailUrl,
        isPrimary: false,
        caption: videoTitle,
        type: 'video',
        videoId
      });
      
      console.log(`Found video tutorial: ${videoTitle} (${videoId})`);
    }
  });
  
  // Extract installation help/guides
  details.installationGuides = [];
  $('.installation-guide, .installation-help, .install-steps, .how-to-install').each((i, el) => {
    const guideEl = $(el);
    const guideTitle = guideEl.find('h3, h4, .title').text().trim() || 'Installation Guide';
    const guideText = guideEl.find('p, .text, .steps').text().trim();
    const guideImg = guideEl.find('img');
    
    if (guideText) {
      const guide = {
        title: guideTitle,
        text: guideText,
        imageUrl: ''
      };
      
      if (guideImg.length) {
        const imgSrc = guideImg.attr('data-src') || guideImg.attr('src') || guideImg.attr('data-original');
        if (imgSrc) {
          guide.imageUrl = imgSrc.startsWith('http') ? imgSrc : `https://www.partselect.com${imgSrc.startsWith('/') ? '' : '/'}${imgSrc}`;
          
          // Add to images array if not already there
          if (!details.images.some(img => img.url === guide.imageUrl)) {
            details.images.push({
              url: guide.imageUrl,
              isPrimary: false,
              caption: guideTitle,
              type: 'guide'
            });
          }
        }
      }
      
      details.installationGuides.push(guide);
      console.log(`Found installation guide: ${guideTitle}`);
    }
  });
  
  console.log(`Extracted details for ${details.title || 'unknown part'}: partSelectNumber=${details.partSelectNumber}, manufacturerPartNumber=${details.manufacturerPartNumber}, price=${details.price}`);
  
  return details;
}

module.exports = {
  getRandomUserAgent,
  fetchHtmlWithUserAgent,
  extractDataFromHtml,
  processUrlToJson,
  processHtmlToJson,
  processAllHtmlFiles,
  processMultipleUrls,
  extractPartDetailPage,
  cleanText,
  cleanPrice,
  ensureDirectories
}; 