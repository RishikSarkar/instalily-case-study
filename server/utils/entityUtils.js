/**
 * Entity detection utilities for appliance parts
 * 
 * This module provides optimized data structures and functions for
 * detecting entities in user queries (brands, models, part types)
 */

// ====================================================================
// BRAND DEFINITIONS
// ====================================================================

// All brands organized by appliance type for O(1) lookups
const REFRIGERATOR_BRANDS = new Set([
  'admiral', 'amana', 'beko', 'blomberg', 'bosch', 'caloric', 'crosley', 
  'dacor', 'dynasty', 'electrolux', 'estate', 'frigidaire', 'gaggenau', 
  'ge', 'gibson', 'haier', 'hardwick', 'hoover', 'hotpoint', 'inglis', 
  'international', 'jenn-air', 'kelvinator', 'kenmore', 'kitchenaid', 
  'lg', 'litton', 'magic chef', 'maytag', 'norge', 'rca', 'roper', 
  'samsung', 'sharp', 'smeg', 'tappan', 'thermador', 'uni', 'whirlpool', 
  'white-westinghouse'
]);

const DISHWASHER_BRANDS = new Set([
  'admiral', 'amana', 'beko', 'blomberg', 'bosch', 'caloric', 'crosley', 
  'dacor', 'electrolux', 'estate', 'frigidaire', 'gaggenau', 'ge', 'gibson', 
  'haier', 'hotpoint', 'inglis', 'jenn-air', 'kelvinator', 'kenmore', 
  'kitchenaid', 'lg', 'magic chef', 'maytag', 'norge', 'roper', 'samsung', 
  'smeg', 'speed queen', 'tappan', 'thermador', 'uni', 'whirlpool', 
  'white-westinghouse'
]);

// Combined brand set for general lookups
const ALL_BRANDS = new Set([
  ...Array.from(REFRIGERATOR_BRANDS),
  ...Array.from(DISHWASHER_BRANDS)
]);

// ====================================================================
// PART TYPE DEFINITIONS
// ====================================================================

// Refrigerator part types for fast lookups
const REFRIGERATOR_PART_TYPES = new Set([
  'tray', 'shelf', 'drawer', 'glide', 'filter', 'ice maker', 'hardware', 
  'seal', 'gasket', 'switch', 'hinge', 'light', 'bulb', 'valve', 'motor', 
  'cap', 'lid', 'thermostat', 'door shelf', 'wheel', 'roller', 'handle', 
  'hose', 'tube', 'door', 'element', 'burner', 'circuit board', 'touch pad', 
  'dispenser', 'electronic', 'sensor', 'fan', 'blower', 'bracket', 'flange', 
  'timer', 'bearing', 'compressor', 'spring', 'shock absorber', 'grille', 
  'kickplate', 'latch', 'knob', 'trim', 'wire plug', 'connector', 'tank', 
  'container', 'leg', 'foot', 'drip bowl', 'panel', 'duct', 'vent', 
  'insulation', 'grate', 'rack', 'power cord', 'blade', 'deflector', 
  'chute', 'starter', 'manual', 'literature', 'transformer'
]);

// Dishwasher part types for fast lookups
const DISHWASHER_PART_TYPES = new Set([
  'dishrack', 'wheel', 'roller', 'seal', 'gasket', 'spray arm', 'hardware', 
  'pump', 'latch', 'element', 'burner', 'valve', 'hose', 'tube', 'filter', 
  'bracket', 'flange', 'hinge', 'rack', 'spring', 'shock absorber', 'cap', 
  'lid', 'switch', 'dispenser', 'circuit board', 'touch pad', 'bearing', 
  'motor', 'thermostat', 'panel', 'sensor', 'tray', 'shelf', 'grille', 
  'kickplate', 'handle', 'drawer', 'glide', 'knob', 'insulation', 'timer', 
  'duct', 'vent', 'wire plug', 'connector', 'door', 'leg', 'foot', 'trim',
  'manual', 'literature'
]);

// Combined part types for general lookups
const ALL_PART_TYPES = new Set([
  ...Array.from(REFRIGERATOR_PART_TYPES),
  ...Array.from(DISHWASHER_PART_TYPES)
]);

// ====================================================================
// MODEL NUMBER PATTERNS
// ====================================================================

// Common model number prefixes for quick matching
const COMMON_MODEL_PREFIXES = {
  // Refrigerator model prefixes by brand
  'frigidaire': ['FGHS', 'FGHC', 'FFHS', 'FGSS', 'FPHB', 'FFSS', 'LFSS'],
  'whirlpool': ['WRS', 'WRF', 'WRX', 'WRB', 'WRT', 'WRV', 'WRF'],
  'ge': ['GSH', 'GSL', 'GSS', 'GTH', 'GTS', 'GNE', 'GFE', 'PSS', 'PFS'],
  'lg': ['LFX', 'LMXS', 'LMXC', 'LFCS', 'LFCC', 'LRFDS', 'LRFXC'],
  'samsung': ['RF', 'RS', 'RT'],
  'kitchenaid': ['KRFF', 'KRFC', 'KRMF', 'KRSF', 'KBFS', 'KFFS'],
  'maytag': ['MFI', 'MFF', 'MFT', 'MSS', 'MSF', 'MSC'],
  'kenmore': ['KSCS', 'KSRS', 'KSFS', 'KSBP'],
  
  // Dishwasher model prefixes by brand
  'frigidaire': ['FPHD', 'FGID', 'FGHD', 'FFID', 'FFBD', 'FGCD'],
  'whirlpool': ['WDT', 'WDF', 'WDP', 'WDL'],
  'ge': ['GDF', 'GDT', 'GSD', 'PDT', 'PDW'],
  'lg': ['LDF', 'LDS', 'LDTS', 'LDFN', 'LSDF'],
  'samsung': ['DW', 'DMT', 'DMS'],
  'kitchenaid': ['KDTM', 'KDTE', 'KDFE', 'KDPE'],
  'maytag': ['MDB', 'MDC']
};

// Model number regex patterns by appliance type
const MODEL_PATTERNS = {
  refrigerator: [
    /[A-Z]{2,4}\d{3,7}[A-Z0-9]{0,5}/i,  // LFSS2612TF0, WRS325FDAM04
    /\d{2,3}-\d{2,3}[A-Z0-9]*/i,        // 12-345A
    /[A-Z]{1,2}\d{2,3}[A-Z]{0,2}/i      // GS12X
  ],
  dishwasher: [
    /[A-Z]{3,4}\d{3,7}[A-Z0-9]{0,5}/i,  // FPHD2491KF0, WDT750SAHZ0
    /[A-Z]{1,2}\d{2,4}[A-Z]{1,2}\d{1,2}/i // JDB6510AWP
  ]
};

// ====================================================================
// ENTITY DETECTION FUNCTIONS
// ====================================================================

/**
 * Master entity detection function
 * @param {string} text - Text to analyze
 * @param {Object} options - Detection options
 * @returns {Object} - Detected entities
 */
function detectEntities(text, options = {}) {
  const lowerText = text.toLowerCase();
  
  return {
    partNumbers: extractPartNumbers(text),
    modelNumbers: extractModelNumbers(text),
    brands: extractBrands(lowerText),
    categories: extractPartTypes(lowerText, options.applianceType)
  };
}

/**
 * Extract part numbers using optimized regex pattern
 * @param {string} text - Text to extract from
 * @returns {Array} - Array of part numbers
 */
function extractPartNumbers(text) {
  // Comprehensive pattern for part numbers
  // This improved pattern handles various formats:
  // - PS12345678 (standard)
  // - PS 12345678 (with space)
  // - Part #PS12345678 (with prefix)
  // - part number PS12345678 (with descriptive text)
  const patterns = [
    /\bPS\d{5,9}\b/gi,                    // Standard format
    /\bPS\s+\d{5,9}\b/gi,                 // With space
    /part\s*(?:number|#|num|no|no\.)\s*:?\s*(?:PS)?\s*\d{5,9}/gi, // Various "part number" prefixes
    /\b(?:part|model|item)\s+(?:PS)?\s*\d{5,9}\b/gi // Part with identifier
  ];
  
  let allMatches = [];
  
  // Apply each pattern
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    allMatches = [...allMatches, ...matches];
  });
  
  // Extract just the PS + digits from each match
  const cleanedMatches = allMatches.map(match => {
    // Extract PS followed by 5-9 digits
    const partNumMatch = match.match(/PS\s*\d{5,9}/i);
    if (partNumMatch) {
      // Remove any spaces between PS and the numbers
      return partNumMatch[0].replace(/\s+/g, '').toUpperCase();
    }
    // If we have just a number after part number reference, add PS prefix
    const numbersOnlyMatch = match.match(/(?:part\s*(?:number|#|num|no|no\.)\s*:?\s*)(\d{5,9})/i);
    if (numbersOnlyMatch && numbersOnlyMatch[1]) {
      return `PS${numbersOnlyMatch[1]}`.toUpperCase();
    }
    return match.toUpperCase();
  });
  
  // Remove duplicates and non-matching items
  return [...new Set(cleanedMatches)].filter(match => /PS\d{5,9}/i.test(match));
}

/**
 * Extract model numbers using brand-specific prefixes and fallback regex
 * @param {string} text - Text to extract from
 * @returns {Array} - Array of model numbers
 */
function extractModelNumbers(text) {
  const results = new Set();
  
  // First try to find brand contexts to use prefix matching
  const lowerText = text.toLowerCase();
  let detectedBrand = null;
  
  // Try to detect brand context first for more accurate model extraction
  for (const brand of ALL_BRANDS) {
    if (lowerText.includes(brand)) {
      detectedBrand = brand;
      const prefixes = COMMON_MODEL_PREFIXES[brand];
      
      // If we have prefixes for this brand, search for them
      if (prefixes) {
        for (const prefix of prefixes) {
          const prefixPattern = new RegExp(`\\b${prefix}\\d{3,7}[A-Z0-9]{0,5}\\b`, 'gi');
          const prefixMatches = text.match(prefixPattern) || [];
          prefixMatches.forEach(match => results.add(match.toUpperCase()));
        }
      }
    }
  }
  
  // If no models found with brand context, try generic patterns
  if (results.size === 0) {
    // Try refrigerator patterns
    for (const pattern of MODEL_PATTERNS.refrigerator) {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        // Validate the match meets minimum criteria (3+ characters, contains numbers)
        if (match.length >= 3 && /\d/.test(match)) {
          results.add(match.toUpperCase());
        }
      });
    }
    
    // Try dishwasher patterns
    for (const pattern of MODEL_PATTERNS.dishwasher) {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        // Validate the match meets minimum criteria (3+ characters, contains numbers)
        if (match.length >= 3 && /\d/.test(match)) {
          results.add(match.toUpperCase());
        }
      });
    }
  }
  
  return Array.from(results);
}

/**
 * Extract brands using optimized Set lookups
 * @param {string} lowerText - Lowercase text to extract from
 * @returns {Array} - Array of brand names
 */
function extractBrands(lowerText) {
  const results = new Set();
  
  // Direct lookup is faster than regex matching
  for (const brand of ALL_BRANDS) {
    // Check for exact brand mention or with "brand" qualifier
    if (lowerText.includes(brand) || 
        lowerText.includes(`${brand} refrigerator`) || 
        lowerText.includes(`${brand} dishwasher`) ||
        lowerText.includes(`${brand} fridge`)) {
      results.add(brand.charAt(0).toUpperCase() + brand.slice(1)); // Capitalize brand name
    }
  }
  
  return Array.from(results);
}

/**
 * Extract part types using optimized Set lookups
 * @param {string} lowerText - Lowercase text to extract from
 * @param {string} applianceType - Optional appliance type to filter results
 * @returns {Array} - Array of part types
 */
function extractPartTypes(lowerText, applianceType) {
  const results = new Set();
  
  // Determine which part sets to search based on appliance type
  let partSets = [ALL_PART_TYPES];
  if (applianceType === 'refrigerator') {
    partSets = [REFRIGERATOR_PART_TYPES];
  } else if (applianceType === 'dishwasher') {
    partSets = [DISHWASHER_PART_TYPES];
  }
  
  // Search each applicable part set
  for (const partSet of partSets) {
    for (const partType of partSet) {
      if (lowerText.includes(partType)) {
        results.add(partType);
      }
    }
  }
  
  return Array.from(results);
}

/**
 * Detect the appliance type from query text
 * @param {string} text - Query text
 * @returns {string|null} - Detected appliance type or null
 */
function detectApplianceType(text) {
  const lowerText = text.toLowerCase();
  
  // Refrigerator keywords
  const refrigeratorKeywords = [
    'refrigerator', 'fridge', 'freezer', 'ice maker', 'cooler', 
    'cooling', 'cold', 'freeze'
  ];
  
  // Dishwasher keywords
  const dishwasherKeywords = [
    'dishwasher', 'dish washer', 'washing dishes', 'clean dishes',
    'rinse', 'spray arm'
  ];
  
  // Check for refrigerator keywords
  for (const keyword of refrigeratorKeywords) {
    if (lowerText.includes(keyword)) {
      return 'refrigerator';
    }
  }
  
  // Check for dishwasher keywords
  for (const keyword of dishwasherKeywords) {
    if (lowerText.includes(keyword)) {
      return 'dishwasher';
    }
  }
  
  // No specific appliance detected
  return null;
}

module.exports = {
  detectEntities,
  extractPartNumbers,
  extractModelNumbers,
  extractBrands,
  extractPartTypes,
  detectApplianceType,
  ALL_BRANDS,
  REFRIGERATOR_BRANDS,
  DISHWASHER_BRANDS,
  REFRIGERATOR_PART_TYPES,
  DISHWASHER_PART_TYPES
}; 