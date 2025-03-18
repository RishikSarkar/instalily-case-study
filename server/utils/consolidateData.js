const fs = require('fs');
const path = require('path');
const { ensureDataDirectories, saveJsonToFile } = require('./fileUtils');
const stateManager = require('./stateManager');

// Constants for directory paths
const DATA_DIR = path.join(__dirname, '../data');
const PARTS_DIR = path.join(DATA_DIR, 'parts');
const CONSOLIDATED_FILE = path.join(DATA_DIR, 'consolidated-data.json');

// Consolidate all part data into a single comprehensive JSON file
async function consolidateData() {
  console.log('Starting data consolidation process...');
  
  ensureDataDirectories();
  
  // Read all part detail files
  const partFiles = fs.readdirSync(PARTS_DIR)
    .filter(file => file.endsWith('_detail.json'));
    
  console.log(`Found ${partFiles.length} part detail files to process`);
  
  if (partFiles.length === 0) {
    console.log('No part files found. Skipping consolidation.');
    return;
  }
  
  // Data structures
  const consolidatedData = {
    parts: {},
    relationships: {
      byAppliance: {
        refrigerator: { parts: [], brands: {}, types: {} },
        dishwasher: { parts: [], brands: {}, types: {} }
      },
      byBrand: {},
      byType: {}
    },
    meta: {
      totalParts: 0,
      applianceCounts: { refrigerator: 0, dishwasher: 0 },
      brandCounts: {},
      typeCounts: {},
      generatedAt: new Date().toISOString()
    }
  };
  
  // Initialize the byBrand section with known brands
  for (const brand of stateManager.knownBrands) {
    if (!consolidatedData.relationships.byBrand[brand]) {
      consolidatedData.relationships.byBrand[brand] = {
        appliances: {},
        types: {}
      };
    }
  }
  
  // Initialize with known part types from website
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

  const allPartTypes = [...new Set([...dishwasherPartTypes, ...refrigeratorPartTypes])];

  for (const type of allPartTypes) {
    if (!consolidatedData.relationships.byType[type]) {
      consolidatedData.relationships.byType[type] = {
        appliances: {},
        brands: {}
      };
    }
    
    stateManager.knownCategories.add(type.toLowerCase());
  }
  
  // Process each part file
  const processedPartNumbers = new Set();
  
  for (const file of partFiles) {
    try {
      const partData = JSON.parse(fs.readFileSync(path.join(PARTS_DIR, file), 'utf8'));
      
      // Skip files without partSelectNumber
      if (!partData.partSelectNumber || !partData.title) {
        continue;
      }
      
      const partNumber = partData.partSelectNumber;
      
      // Skip if already processed part
      if (processedPartNumbers.has(partNumber)) {
        console.log(`Skipping duplicate part in consolidation: ${partNumber}`);
        continue;
      }
      
      processedPartNumbers.add(partNumber);
      
      consolidatedData.parts[partNumber] = partData;
      consolidatedData.meta.totalParts++;
      
      stateManager.addPart(partData);
      
      // Determine appliance type from context field or URL or title
      let applianceType = 'other';
      if (partData.context) {
        applianceType = partData.context.toLowerCase();
      } else if (partData.partUrl) {
        if (partData.partUrl.toLowerCase().includes('refrigerator')) {
          applianceType = 'refrigerator';
        } else if (partData.partUrl.toLowerCase().includes('dishwasher')) {
          applianceType = 'dishwasher';
        }
      } else if (partData.title) {
        if (partData.title.toLowerCase().includes('refrigerator')) {
          applianceType = 'refrigerator';
        } else if (partData.title.toLowerCase().includes('dishwasher')) {
          applianceType = 'dishwasher';
        }
      }
      
      if (!consolidatedData.meta.applianceCounts[applianceType]) {
        consolidatedData.meta.applianceCounts[applianceType] = 0;
      }
      
      consolidatedData.meta.applianceCounts[applianceType]++;

      if (!consolidatedData.relationships.byAppliance[applianceType]) {
        consolidatedData.relationships.byAppliance[applianceType] = { 
          parts: [], brands: {}, types: {} 
        };
      }
      consolidatedData.relationships.byAppliance[applianceType].parts.push(partNumber);
      
      let brand = null;
      if (partData.title) {
        const titleParts = partData.title.split(' ');
        if (titleParts.length > 1) {
          const commonBrands = [
            // Dishwasher brands
            'Admiral', 'Amana', 'Beko', 'Blomberg', 'Bosch', 'Caloric', 'Crosley', 
            'Dacor', 'Electrolux', 'Estate', 'Frigidaire', 'Gaggenau', 'GE', 'Gibson', 
            'Haier', 'Hotpoint', 'Inglis', 'Jenn-Air', 'Kelvinator', 'Kenmore', 
            'KitchenAid', 'LG', 'Magic Chef', 'Maytag', 'Norge', 'Roper', 'Samsung', 
            'SMEG', 'Speed Queen', 'Tappan', 'Thermador', 'Uni', 'Whirlpool', 
            'White-Westinghouse',
            
            // Addnl refrigerator brands
            'Dynasty', 'Hardwick', 'Hoover', 'International', 'Litton', 
            'RCA', 'Sharp'
          ];
          
          const possibleBrand = titleParts[0];
          if (commonBrands.includes(possibleBrand)) {
            brand = possibleBrand;
          }
          
          if (!brand) {
            for (const brandName of commonBrands) {
              if (partData.title.includes(brandName)) {
                brand = brandName;
                break;
              }
            }
          }
        }
      }
      
      if (!brand && partData.partUrl) {
        const urlParts = partData.partUrl.split('-');
        if (urlParts.length > 2) {
          const possibleBrand = urlParts[1];
          
          const commonBrands = [
            // Dishwasher brands
            'admiral', 'amana', 'beko', 'blomberg', 'bosch', 'caloric', 'crosley', 
            'dacor', 'electrolux', 'estate', 'frigidaire', 'gaggenau', 'ge', 'gibson', 
            'haier', 'hotpoint', 'inglis', 'jenn-air', 'kelvinator', 'kenmore', 
            'kitchenaid', 'lg', 'magic-chef', 'maytag', 'norge', 'roper', 'samsung', 
            'smeg', 'speed-queen', 'tappan', 'thermador', 'uni', 'whirlpool', 
            'white-westinghouse',
            
            // Addnl refrigerator brands
            'dynasty', 'hardwick', 'hoover', 'international', 'litton', 
            'rca', 'sharp'
          ];
          
          const normalizedBrand = possibleBrand.toLowerCase();
          if (commonBrands.includes(normalizedBrand)) {
            const brandMap = {
              'admiral': 'Admiral',
              'amana': 'Amana',
              'beko': 'Beko',
              'blomberg': 'Blomberg',
              'bosch': 'Bosch',
              'caloric': 'Caloric',
              'crosley': 'Crosley',
              'dacor': 'Dacor',
              'electrolux': 'Electrolux',
              'estate': 'Estate',
              'frigidaire': 'Frigidaire',
              'gaggenau': 'Gaggenau',
              'ge': 'GE',
              'gibson': 'Gibson',
              'haier': 'Haier',
              'hotpoint': 'Hotpoint',
              'inglis': 'Inglis',
              'jenn-air': 'Jenn-Air',
              'kelvinator': 'Kelvinator',
              'kenmore': 'Kenmore',
              'kitchenaid': 'KitchenAid',
              'lg': 'LG',
              'magic-chef': 'Magic Chef',
              'maytag': 'Maytag',
              'norge': 'Norge',
              'roper': 'Roper',
              'samsung': 'Samsung',
              'smeg': 'SMEG',
              'speed-queen': 'Speed Queen',
              'tappan': 'Tappan',
              'thermador': 'Thermador',
              'uni': 'Uni',
              'whirlpool': 'Whirlpool',
              'white-westinghouse': 'White-Westinghouse',
              'dynasty': 'Dynasty',
              'hardwick': 'Hardwick',
              'hoover': 'Hoover',
              'international': 'International',
              'litton': 'Litton',
              'rca': 'RCA',
              'sharp': 'Sharp'
            };
            
            brand = brandMap[normalizedBrand] || possibleBrand;
          }
        }
      }
      
      if (brand) {
        // Save brand in part data for future
        partData.brand = brand;
        
        if (!consolidatedData.meta.brandCounts[brand]) {
          consolidatedData.meta.brandCounts[brand] = 0;
        }
        consolidatedData.meta.brandCounts[brand]++;
        
        // Add to brand->appliance relationship
        if (!consolidatedData.relationships.byBrand[brand]) {
          consolidatedData.relationships.byBrand[brand] = {
            appliances: {},
            types: {}
          };
        }
        
        if (!consolidatedData.relationships.byBrand[brand].appliances[applianceType]) {
          consolidatedData.relationships.byBrand[brand].appliances[applianceType] = [];
        }
        consolidatedData.relationships.byBrand[brand].appliances[applianceType].push(partNumber);
        
        // Add to appliance->brand relationship
        if (!consolidatedData.relationships.byAppliance[applianceType].brands[brand]) {
          consolidatedData.relationships.byAppliance[applianceType].brands[brand] = [];
        }
        consolidatedData.relationships.byAppliance[applianceType].brands[brand].push(partNumber);
        
        // Add brand to state manager
        stateManager.knownBrands.add(brand.toLowerCase());
      }
      
      let partType = extractPartTypeFromTitle(partData.title);
      
      if (partType) {
        // Save part type in part data for future
        partData.partType = partType;
        
        if (!consolidatedData.meta.typeCounts[partType]) {
          consolidatedData.meta.typeCounts[partType] = 0;
        }
        consolidatedData.meta.typeCounts[partType]++;
        
        if (!consolidatedData.relationships.byType[partType]) {
          consolidatedData.relationships.byType[partType] = {
            appliances: {},
            brands: {}
          };
        }
        
        // Add to type->appliance relationship
        if (!consolidatedData.relationships.byType[partType].appliances[applianceType]) {
          consolidatedData.relationships.byType[partType].appliances[applianceType] = [];
        }
        consolidatedData.relationships.byType[partType].appliances[applianceType].push(partNumber);
        
        // Add to appliance->type relationship
        if (!consolidatedData.relationships.byAppliance[applianceType].types[partType]) {
          consolidatedData.relationships.byAppliance[applianceType].types[partType] = [];
        }
        consolidatedData.relationships.byAppliance[applianceType].types[partType].push(partNumber);
        
        // Add to brand->type relationship
        if (brand) {
          if (!consolidatedData.relationships.byBrand[brand].types[partType]) {
            consolidatedData.relationships.byBrand[brand].types[partType] = [];
          }
          consolidatedData.relationships.byBrand[brand].types[partType].push(partNumber);
          
          // Add to type->brand relationship
          if (!consolidatedData.relationships.byType[partType].brands[brand]) {
            consolidatedData.relationships.byType[partType].brands[brand] = [];
          }
          consolidatedData.relationships.byType[partType].brands[brand].push(partNumber);
        }
        
        stateManager.knownCategories.add(partType.toLowerCase());
      }
      
    } catch (err) {
      console.error(`Error processing ${file}: ${err.message}`);
    }
  }
  
  stateManager.save();
  
  saveJsonToFile(consolidatedData, CONSOLIDATED_FILE);
  console.log(`Consolidated data written to ${CONSOLIDATED_FILE}`);
  console.log(`Total parts: ${consolidatedData.meta.totalParts}`);
  console.log(`Refrigerator parts: ${consolidatedData.meta.applianceCounts.refrigerator}`);
  console.log(`Dishwasher parts: ${consolidatedData.meta.applianceCounts.dishwasher}`);
  console.log(`Other parts: ${consolidatedData.meta.applianceCounts.other}`);
  console.log(`Total brands: ${Object.keys(consolidatedData.meta.brandCounts).length}`);
  console.log(`Total part types: ${Object.keys(consolidatedData.meta.typeCounts).length}`);
  
  return consolidatedData;
}

// Extract part type from title
function extractPartTypeFromTitle(title) {
  if (!title) return null;
  
  title = title.toLowerCase();
  
  const refrigeratorTypes = [
    // Basic parts
    'water filter', 'door shelf', 'shelf', 'drawer', 'bin', 'tray', 
    'handle', 'ice maker', 'compressor', 'fan', 'gasket', 'seal', 
    'thermostat', 'control board', 'dispenser', 'door', 'hinge',
    
    // Addnl part types
    'trays and shelves', 'drawers and glides', 'filters', 'ice makers', 
    'hardware', 'seals and gaskets', 'switches', 'hinges', 'lights and bulbs', 
    'valves', 'motors', 'caps and lids', 'thermostats', 'door shelves', 
    'wheels and rollers', 'handles', 'hoses and tubes', 'doors', 
    'elements and burners', 'circuit boards and touch pads', 'dispensers', 
    'electronics', 'sensors', 'fans and blowers', 'brackets and flanges', 
    'timers', 'bearings', 'compressors', 'springs and shock absorbers', 
    'grilles and kickplates', 'latches', 'knobs', 'trim', 
    'wire plugs and connectors', 'tanks and containers', 'legs and feet', 
    'drip bowls', 'panels', 'ducts and vents', 'insulation', 'grates', 
    'racks', 'power cords', 'blades', 'deflectors and chutes', 'starters', 
    'manuals and literature', 'transformers',
    
    // Singular forms
    'tray', 'shelf', 'drawer', 'filter', 'light', 'bulb', 'valve', 'motor',
    'cap', 'lid', 'door shelf', 'wheel', 'roller', 'handle', 'hose', 'tube',
    'element', 'burner', 'circuit board', 'touch pad', 'dispenser', 
    'sensor', 'fan', 'blower', 'bracket', 'flange', 'timer', 'bearing',
    'spring', 'shock absorber', 'grille', 'kickplate', 'latch', 'knob',
    'wire', 'plug', 'connector', 'tank', 'container', 'leg', 'foot',
    'drip bowl', 'panel', 'duct', 'vent', 'grate', 'rack', 'power cord',
    'blade', 'deflector', 'chute', 'starter', 'manual', 'transformer'
  ];
  
  const dishwasherTypes = [
    // Basic parts
    'pump', 'motor', 'rack', 'spray arm', 'basket', 'dispenser', 
    'door latch', 'gasket', 'seal', 'control board', 'timer', 
    'valve', 'tub', 'wheel', 'roller',
    
    // Addnl part types
    'dishracks', 'wheels and rollers', 'seals and gaskets', 'spray arms', 
    'hardware', 'pumps', 'latches', 'elements and burners', 'valves', 
    'hoses and tubes', 'filters', 'brackets and flanges', 'hinges', 'racks', 
    'springs and shock absorbers', 'caps and lids', 'switches', 'dispensers', 
    'circuit boards and touch pads', 'bearings', 'motors', 'thermostats', 
    'panels', 'sensors', 'trays and shelves', 'grilles and kickplates', 
    'handles', 'drawers and glides', 'knobs', 'insulation', 'timers', 
    'ducts and vents', 'wire plugs and connectors', 'doors', 'legs and feet', 
    'trim', 'manuals and literature',
    
    // Singular forms
    'dishrack', 'wheel', 'roller', 'seal', 'gasket', 'spray arm', 
    'pump', 'latch', 'element', 'burner', 'valve', 
    'hose', 'tube', 'filter', 'bracket', 'flange', 'hinge', 'rack', 
    'spring', 'shock absorber', 'cap', 'lid', 'switch', 'dispenser', 
    'circuit board', 'touch pad', 'bearing', 'motor', 'thermostat', 
    'panel', 'sensor', 'tray', 'shelf', 'grille', 'kickplate', 
    'handle', 'drawer', 'glide', 'knob', 'insulation', 'timer', 
    'duct', 'vent', 'wire', 'plug', 'connector', 'door', 'leg', 'foot', 'trim'
  ];
  
  for (const type of refrigeratorTypes) {
    if (title.includes(type)) {
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
  
  for (const type of dishwasherTypes) {
    if (title.includes(type)) {
      return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
  
  // Specific common part names
  const specificParts = [
    'door shelf bin', 'crisper drawer', 'upper rack adjuster', 'lower dishrack',
    'shelf retainer bar', 'water filter', 'ice maker assembly', 'humidity control',
    'lower spray arm', 'upper spray arm', 'dishrack wheel', 'door gasket',
    'door seal', 'rack roller', 'door latch assembly', 'drain pump'
  ];
  
  for (const part of specificParts) {
    if (title.toLowerCase().includes(part)) {
      return part.charAt(0).toUpperCase() + part.slice(1);
    }
  }
  
  // Generic part type
  const titleWords = title.split(' ');
  if (titleWords.length >= 3) {
    return titleWords[2].charAt(0).toUpperCase() + titleWords[2].slice(1);
  }
  
  return null;
}

module.exports = {
  consolidateData
}; 