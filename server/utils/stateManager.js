/**
 * State Manager for Scraper
 * Tracks processed parts, brands, and categories to avoid duplicates
 * Persists state between scraper runs
 */
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

  /**
   * Load state from disk
   */
  load() {
    try {
      if (fs.existsSync(STATE_FILE)) {
        console.log('Loading existing scraper state...');
        const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        
        // Convert arrays to Sets for faster lookups
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
      this.save(); // Create initial file if there was an error
    }
  }

  /**
   * Save state to disk
   */
  save() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(STATE_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      // Convert Sets back to arrays for serialization
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

  /**
   * Check if a part has already been processed
   */
  hasPart(partNumber) {
    return this.processedParts.has(partNumber);
  }

  /**
   * Add a part to the tracked state
   * Returns true if the part was new (not previously tracked)
   */
  addPart(partData) {
    if (!partData || !partData.partSelectNumber) return false;
    
    const partNumber = partData.partSelectNumber;
    const isNew = !this.processedParts.has(partNumber);
    
    if (isNew) {
      this.processedParts.add(partNumber);
      
      // Track brand if available
      if (partData.brand) {
        this.knownBrands.add(partData.brand.toLowerCase());
      }
      
      // Track categories/types if available
      if (partData.partType) {
        this.knownCategories.add(partData.partType.toLowerCase());
      }
      
      // Periodically save to avoid losing state on crashes
      if (this.processedParts.size % 50 === 0) {
        this.save();
      }
    }
    
    return isNew;
  }

  /**
   * Get counts of tracked items
   */
  getCounts() {
    return {
      parts: this.processedParts.size,
      brands: this.knownBrands.size,
      categories: this.knownCategories.size
    };
  }

  /**
   * Get missing brands from a provided list
   */
  getMissingBrands(brandList) {
    return brandList.filter(brand => {
      const normalizedBrand = brand.toLowerCase();
      // Check if we have this brand in any case format
      return ![...this.knownBrands].some(knownBrand => 
        knownBrand.toLowerCase() === normalizedBrand
      );
    });
  }

  /**
   * Get missing categories from a provided list
   */
  getMissingCategories(categoryList) {
    return categoryList.filter(category => {
      const normalizedCategory = category.toLowerCase();
      // Check if we have this category in any case format
      return ![...this.knownCategories].some(knownCategory => 
        knownCategory.toLowerCase() === normalizedCategory
      );
    });
  }
}

// Export a singleton instance
module.exports = new ScraperState(); 