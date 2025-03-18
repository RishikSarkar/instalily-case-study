// State Manager for Scraper

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, '../data/scraper-state.json');
const DEFAULT_STATE = {
  processedParts: [],
  knownBrands: [],
  knownCategories: [],
  lastRun: null
};

class ScraperState {
  constructor() {
    this.processedParts = new Set();
    this.knownBrands = new Set();
    this.knownCategories = new Set();
    this.lastRun = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        console.log('Loading existing scraper state...');
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        
        this.processedParts = new Set(data.processedParts || []);
        this.knownBrands = new Set(data.knownBrands || []);
        this.knownCategories = new Set(data.knownCategories || []);
        this.lastRun = data.lastRun;
        
        console.log(`Loaded state: ${this.processedParts.size} parts, ${this.knownBrands.size} brands, ${this.knownCategories.size} categories`);
      } else {
        console.log('No existing state found, creating new state file');
        this.save();
      }
    } catch (err) {
      console.error('Error loading state:', err);
      this.save();
    }
  }

  save() {
    try {
      const dataDir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const state = {
        processedParts: [...this.processedParts],
        knownBrands: [...this.knownBrands],
        knownCategories: [...this.knownCategories],
        lastRun: new Date().toISOString()
      };
      
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (err) {
      console.error('Error saving state:', err);
    }
  }

  hasPart(partNumber) {
    return this.processedParts.has(partNumber);
  }

  addPart(partData) {
    if (!partData || !partData.partSelectNumber) return false;
    
    const partNumber = partData.partSelectNumber;
    const isNew = !this.processedParts.has(partNumber);
    
    if (isNew) {
      this.processedParts.add(partNumber);
      
      if (partData.brand) {
        this.knownBrands.add(partData.brand.toLowerCase());
      }
      
      if (partData.partType) {
        this.knownCategories.add(partData.partType.toLowerCase());
      }
      
      if (this.processedParts.size % 50 === 0) {
        this.save();
      }
    }
    
    return isNew;
  }

  getCounts() {
    return {
      parts: this.processedParts.size,
      brands: this.knownBrands.size,
      categories: this.knownCategories.size
    };
  }

  getMissingBrands(brandList) {
    return brandList.filter(brand => {
      const normalizedBrand = brand.toLowerCase();
      return ![...this.knownBrands].some(knownBrand => 
        knownBrand.toLowerCase() === normalizedBrand
      );
    });
  }

  getMissingCategories(categoryList) {
    return categoryList.filter(category => {
      const normalizedCategory = category.toLowerCase();
      return ![...this.knownCategories].some(knownCategory => 
        knownCategory.toLowerCase() === normalizedCategory
      );
    });
  }
}

module.exports = new ScraperState(); 