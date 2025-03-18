// Entity detection utilities for appliance parts

// Brand Definitions
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

const ALL_BRANDS = new Set([
  ...Array.from(REFRIGERATOR_BRANDS),
  ...Array.from(DISHWASHER_BRANDS)
]);

// Part Types
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

const ALL_PART_TYPES = new Set([
  ...Array.from(REFRIGERATOR_PART_TYPES),
  ...Array.from(DISHWASHER_PART_TYPES)
]);

// Model Number
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

const MODEL_PATTERNS = {
  refrigerator: [
    /[A-Z]{2,4}\d{3,7}[A-Z0-9]{0,5}/i, // LFSS2612TF0, WRS325FDAM04
    /\d{2,3}-\d{2,3}[A-Z0-9]*/i, // 12-345A
    /[A-Z]{1,2}\d{2,3}[A-Z]{0,2}/i // GS12X
  ],
  dishwasher: [
    /[A-Z]{3,4}\d{3,7}[A-Z0-9]{0,5}/i, // FPHD2491KF0, WDT750SAHZ0
    /[A-Z]{1,2}\d{2,4}[A-Z]{1,2}\d{1,2}/i // JDB6510AWP
  ]
};

// Entity Detection Functions
function detectEntities(text, options = {}) {
  const lowerText = text.toLowerCase();
  
  return {
    partNumbers: extractPartNumbers(text),
    modelNumbers: extractModelNumbers(text),
    brands: extractBrands(lowerText),
    categories: extractPartTypes(lowerText, options.applianceType)
  };
}

// Extract part numbers using optimized regex pattern
function extractPartNumbers(text) {
  const patterns = [
    /\bPS\d{5,9}\b/gi, // Standard format
    /\bPS\s+\d{5,9}\b/gi, // With space
    /part\s*(?:number|#|num|no|no\.)\s*:?\s*(?:PS)?\s*\d{5,9}/gi, // Various "part number" prefixes
    /\b(?:part|model|item)\s+(?:PS)?\s*\d{5,9}\b/gi // Part with identifier
  ];
  
  let allMatches = [];
  
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    allMatches = [...allMatches, ...matches];
  });
  
  // Extract just PS + digits from each match
  const cleanedMatches = allMatches.map(match => {
    // Extract PS followed by 5-9 digits
    const partNumMatch = match.match(/PS\s*\d{5,9}/i);
    if (partNumMatch) {
      // Remove spaces bw PS and the numbers
      return partNumMatch[0].replace(/\s+/g, '').toUpperCase();
    }
    const numbersOnlyMatch = match.match(/(?:part\s*(?:number|#|num|no|no\.)\s*:?\s*)(\d{5,9})/i);
    if (numbersOnlyMatch && numbersOnlyMatch[1]) {
      return `PS${numbersOnlyMatch[1]}`.toUpperCase();
    }
    return match.toUpperCase();
  });
  
  return [...new Set(cleanedMatches)].filter(match => /PS\d{5,9}/i.test(match));
}

// Extract model numbers using brand-specific prefixes and fallback regex
function extractModelNumbers(text) {
  const results = new Set();
  
  const lowerText = text.toLowerCase();
  let detectedBrand = null;
  
  for (const brand of ALL_BRANDS) {
    if (lowerText.includes(brand)) {
      detectedBrand = brand;
      const prefixes = COMMON_MODEL_PREFIXES[brand];
      
      if (prefixes) {
        for (const prefix of prefixes) {
          const prefixPattern = new RegExp(`\\b${prefix}\\d{3,7}[A-Z0-9]{0,5}\\b`, 'gi');
          const prefixMatches = text.match(prefixPattern) || [];
          prefixMatches.forEach(match => results.add(match.toUpperCase()));
        }
      }
    }
  }
  
  if (results.size === 0) {
    for (const pattern of MODEL_PATTERNS.refrigerator) {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        if (match.length >= 3 && /\d/.test(match)) {
          results.add(match.toUpperCase());
        }
      });
    }
    
    for (const pattern of MODEL_PATTERNS.dishwasher) {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        if (match.length >= 3 && /\d/.test(match)) {
          results.add(match.toUpperCase());
        }
      });
    }
  }
  
  return Array.from(results);
}

// Extract brands using optimized Set lookups
function extractBrands(lowerText) {
  const results = new Set();
  
  for (const brand of ALL_BRANDS) {
    if (lowerText.includes(brand) || 
        lowerText.includes(`${brand} refrigerator`) || 
        lowerText.includes(`${brand} dishwasher`) ||
        lowerText.includes(`${brand} fridge`)) {
      results.add(brand.charAt(0).toUpperCase() + brand.slice(1));
    }
  }
  
  return Array.from(results);
}

// Extract part types using optimized Set lookups
function extractPartTypes(lowerText, applianceType) {
  const results = new Set();
  
  let partSets = [ALL_PART_TYPES];
  if (applianceType === 'refrigerator') {
    partSets = [REFRIGERATOR_PART_TYPES];
  } else if (applianceType === 'dishwasher') {
    partSets = [DISHWASHER_PART_TYPES];
  }
  
  for (const partSet of partSets) {
    for (const partType of partSet) {
      if (lowerText.includes(partType)) {
        results.add(partType);
      }
    }
  }
  
  return Array.from(results);
}

// Detect the appliance type from query text
function detectApplianceType(text) {
  const lowerText = text.toLowerCase();
  
  const refrigeratorKeywords = [
    'refrigerator', 'fridge', 'freezer', 'ice maker', 'cooler', 
    'cooling', 'cold', 'freeze'
  ];
  
  const dishwasherKeywords = [
    'dishwasher', 'dish washer', 'washing dishes', 'clean dishes',
    'rinse', 'spray arm'
  ];
  
  for (const keyword of refrigeratorKeywords) {
    if (lowerText.includes(keyword)) {
      return 'refrigerator';
    }
  }
  
  for (const keyword of dishwasherKeywords) {
    if (lowerText.includes(keyword)) {
      return 'dishwasher';
    }
  }
  
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