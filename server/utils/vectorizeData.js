/**
 * Vector Database Utility for PartSelect Data
 * 
 * This utility converts consolidated part data into vector embeddings
 * and stores them in a vector database for semantic retrieval.
 */
const fs = require('fs');
const path = require('path');
const { HierarchicalNSW } = require('hnswlib-node');
const { DeepseekEmbeddings } = require('./deepseekUtils');
const { loadJsonFromFile, saveJsonToFile, ensureDataDirectories } = require('./fileUtils');

// Constants
const INDEX_PATH = path.join(__dirname, '../data/vectors/parts_index.bin');
const METADATA_PATH = path.join(__dirname, '../data/vectors/parts_metadata.json');
const CONSOLIDATED_DATA_PATH = path.join(__dirname, '../data/consolidated-data.json');
const EMBEDDING_DIMENSIONS = 1536; // Deepseek embeddings dimension
const CHUNK_SIZE = 100; // Process in batches to avoid memory issues

class VectorDB {
  constructor() {
    this.embeddings = new DeepseekEmbeddings();
    this.index = null;
    this.metadata = [];
    
    // Ensure directories exist
    ensureDataDirectories();
    
    // Create data/vectors directory if it doesn't exist
    const vectorsDir = path.dirname(INDEX_PATH);
    if (!fs.existsSync(vectorsDir)) {
      fs.mkdirSync(vectorsDir, { recursive: true });
    }
    
    // Automatically load the index if it exists
    this.loadIndex().then(loaded => {
      if (loaded) {
        console.log('Vector index loaded successfully on startup');
      } else {
        console.warn('Vector index not found on startup, queries will fail until vectorization is run');
      }
    }).catch(err => {
      console.error('Error loading vector index on startup:', err);
    });
  }

  /**
   * Load consolidated data from file
   */
  loadConsolidatedData() {
    try {
      console.log('Loading consolidated data...');
      const data = loadJsonFromFile(CONSOLIDATED_DATA_PATH);
      if (!data) {
        throw new Error('Failed to load consolidated data');
      }
      console.log(`Loaded data with ${Object.keys(data.parts).length} parts`);
      return data;
    } catch (err) {
      console.error('Error loading consolidated data:', err);
      throw err;
    }
  }

  /**
   * Convert part data to text chunks for embedding
   */
  prepareChunks(consolidatedData) {
    console.log('Preparing text chunks for vectorization...');
    const chunks = [];
    
    // Process parts
    Object.entries(consolidatedData.parts).forEach(([partNum, part]) => {
      // Skip parts with missing critical data
      if (!part.partSelectNumber || !part.title) return;
      
      // Prepare metadata
      const metadata = {
        id: part.partSelectNumber,
        title: part.title,
        partNumber: part.partSelectNumber,
        type: part.partType || 'unknown',
        brand: part.brand || 'unknown',
        appliance: part.context || 'unknown',
        inStock: part.inStock || false,
        price: part.price || '0',
        rating: part.rating || 0,
        reviewCount: part.reviewCount || 0,
        chunkType: 'general',
        entityType: 'part',
        // Add image URL if available in the part data, otherwise generate one
        imageUrl: part.imageUrl || `https://www.partselect.com/assets/images/parts/${part.partSelectNumber}.jpg`,
        // Check if the part has installation video
        hasVideo: part.hasInstallationVideo || false,
        videoUrl: part.hasInstallationVideo ? 
          `https://www.partselect.com/Installation-Video-${part.partSelectNumber}.htm` : null,
        // Add compatible models if available
        compatibleModels: part.compatibleWith || []
      };
      
      // Prepare main part information
      chunks.push({
        id: `part-${part.partSelectNumber}`,
        text: `${part.title} (${part.partSelectNumber}): ${part.description || ''}`,
        metadata
      });
      
      // Add review text as separate chunk if available
      if (part.userReview && part.userReview.content) {
        chunks.push({
          id: `review-${part.partSelectNumber}`,
          text: `Review for ${part.title} (${part.partSelectNumber}): ${part.userReview.title || ''} - ${part.userReview.content}`,
          metadata: { ...metadata, chunkType: 'review' }
        });
      }
      
      // Add symptoms as separate chunk if available
      if (part.symptoms && part.symptoms.length > 0) {
        chunks.push({
          id: `symptoms-${part.partSelectNumber}`,
          text: `Symptoms resolved by ${part.title} (${part.partSelectNumber}): ${part.symptoms.join(', ')}`,
          metadata: { ...metadata, chunkType: 'symptoms' }
        });
      }
    });
    
    // Add brand vectors
    if (consolidatedData.relationships && consolidatedData.relationships.byBrand) {
      console.log('Adding brand vectors...');
      
      Object.entries(consolidatedData.relationships.byBrand).forEach(([brand, brandInfo]) => {
        if (!brand) return;
        
        // Count parts by type for this brand
        const partTypesByBrand = {};
        
        // Get parts for this brand
        const brandParts = brandInfo.parts || [];
        
        // Count parts by type
        brandParts.forEach(partNumber => {
          const part = consolidatedData.parts[partNumber];
          if (part && part.partType) {
            partTypesByBrand[part.partType] = (partTypesByBrand[part.partType] || 0) + 1;
          }
        });
        
        // Determine brand specialties (part types with most parts)
        const specialties = Object.entries(partTypesByBrand)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(entry => entry[0]);
        
        // Create a brand description
        const brandDescription = `${brand} is a manufacturer of ${brandInfo.appliance || 'appliance'} parts. ` +
          `They specialize in ${specialties.join(', ')}. ` +
          `They have ${brandParts.length} parts in our database.`;
        
        chunks.push({
          id: `brand-${brand.toLowerCase().replace(/\s+/g, '-')}`,
          text: brandDescription,
          metadata: {
            entityType: 'brand',
            brandName: brand,
            appliance: brandInfo.appliance || 'multiple',
            partCount: brandParts.length,
            specialties,
            chunkType: 'brand'
          }
        });
      });
    }
    
    // Add category vectors
    if (consolidatedData.relationships && consolidatedData.relationships.byType) {
      console.log('Adding category vectors...');
      
      Object.entries(consolidatedData.relationships.byType).forEach(([category, categoryInfo]) => {
        if (!category) return;
        
        // Get parts for this category
        const categoryParts = categoryInfo.parts || [];
        
        // Count brands for this category
        const brandsByCategory = {};
        categoryParts.forEach(partNumber => {
          const part = consolidatedData.parts[partNumber];
          if (part && part.brand) {
            brandsByCategory[part.brand] = (brandsByCategory[part.brand] || 0) + 1;
          }
        });
        
        // Determine top brands for this category
        const topBrands = Object.entries(brandsByCategory)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(entry => entry[0]);
        
        // Create a category description
        const categoryDescription = `${category} are parts used in ${categoryInfo.appliance || 'appliances'}. ` +
          `Popular brands include ${topBrands.join(', ')}. ` +
          `We have ${categoryParts.length} ${category.toLowerCase()} parts in our database.`;
        
        chunks.push({
          id: `category-${category.toLowerCase().replace(/\s+/g, '-')}`,
          text: categoryDescription,
          metadata: {
            entityType: 'category',
            categoryName: category,
            appliance: categoryInfo.appliance || 'multiple',
            partCount: categoryParts.length,
            topBrands,
            chunkType: 'category'
          }
        });
      });
    }
    
    // Add model vectors if available in the data
    // Note: This assumes there's model information in the data structure
    // You might need to adjust based on your actual data structure
    if (consolidatedData.relationships && consolidatedData.relationships.byModel) {
      console.log('Adding model vectors...');
      
      Object.entries(consolidatedData.relationships.byModel).forEach(([model, modelInfo]) => {
        if (!model) return;
        
        // Get parts compatible with this model
        const compatibleParts = modelInfo.parts || [];
        
        // Create model description
        const modelDescription = `${model} is a ${modelInfo.brand || ''} ${modelInfo.appliance || 'appliance'} model. ` +
          `It has ${compatibleParts.length} compatible parts in our database.`;
        
        chunks.push({
          id: `model-${model.toLowerCase().replace(/\s+/g, '-')}`,
          text: modelDescription,
          metadata: {
            entityType: 'model',
            modelNumber: model,
            brand: modelInfo.brand || 'unknown',
            appliance: modelInfo.appliance || 'unknown',
            compatiblePartCount: compatibleParts.length,
            chunkType: 'model'
          }
        });
      });
    }
    
    console.log(`Prepared ${chunks.length} chunks for vectorization`);
    return chunks;
  }

  /**
   * Vectorize all data chunks and store in the index
   */
  async vectorizeAllData() {
    try {
      console.log('Starting vectorization process...');
      
      // Load data
      const consolidatedData = this.loadConsolidatedData();
      
      // Prepare chunks
      const chunks = this.prepareChunks(consolidatedData);
      
      // Initialize the index
      this.index = new HierarchicalNSW('cosine', EMBEDDING_DIMENSIONS);
      this.index.initIndex(chunks.length, 16, 200, 100);
      
      // Store metadata separately
      this.metadata = [];
      
      // Process in batches to avoid memory issues
      let totalProcessed = 0;
      for (let i = 0; i < chunks.length; i += CHUNK_SIZE) {
        const batchChunks = chunks.slice(i, i + CHUNK_SIZE);
        console.log(`Processing batch ${Math.floor(i/CHUNK_SIZE) + 1} of ${Math.ceil(chunks.length/CHUNK_SIZE)}, with ${batchChunks.length} chunks`);
        
        // Extract texts for embedding
        const texts = batchChunks.map(chunk => chunk.text);
        
        // Generate embeddings for batch
        const embeddings = await this.embeddings.embedBatch(texts);
        
        // Add to index
        for (let j = 0; j < batchChunks.length; j++) {
          const indexPos = totalProcessed + j;
          this.index.addPoint(embeddings[j], indexPos);
          this.metadata[indexPos] = {
            ...batchChunks[j].metadata,
            text: batchChunks[j].text
          };
        }
        
        totalProcessed += batchChunks.length;
        console.log(`Completed batch, total processed: ${totalProcessed}`);
      }
      
      // Save the index and metadata
      await this.saveIndex();
      
      console.log('Vectorization complete!');
      console.log(`Total vectors in database: ${this.metadata.length}`);
      
      return true;
    } catch (err) {
      console.error('Error during vectorization:', err);
      throw err;
    }
  }

  /**
   * Save the index and metadata to disk
   */
  async saveIndex() {
    try {
      console.log('Saving vector index and metadata...');
      
      // Save the index
      this.index.writeIndex(INDEX_PATH);
      
      // Save metadata
      saveJsonToFile(this.metadata, METADATA_PATH);
      
      console.log('Vector index and metadata saved successfully');
      return true;
    } catch (err) {
      console.error('Error saving vector index:', err);
      throw err;
    }
  }

  /**
   * Load the index and metadata from disk
   */
  async loadIndex() {
    try {
      if (!fs.existsSync(INDEX_PATH) || !fs.existsSync(METADATA_PATH)) {
        console.warn('Vector index or metadata not found, need to run vectorization first');
        return false;
      }
      
      console.log('Loading vector index and metadata...');
      
      // Load metadata first
      this.metadata = loadJsonFromFile(METADATA_PATH);
      if (!this.metadata || !Array.isArray(this.metadata) || this.metadata.length === 0) {
        console.warn('Metadata is empty or invalid');
        return false;
      }
      
      // Initialize and load the index
      this.index = new HierarchicalNSW('cosine', EMBEDDING_DIMENSIONS);
      this.index.initIndex(this.metadata.length, 16, 200, 100);
      this.index.readIndex(INDEX_PATH);
      
      console.log(`Loaded vector index with ${this.metadata.length} vectors`);
      return true;
    } catch (err) {
      console.error('Error loading vector index:', err);
      return false;
    }
  }

  /**
   * Query the vector database for relevant parts
   * @param {string} query - The user's query
   * @param {Object} filters - Optional filters to apply
   * @param {number} limit - Maximum number of results to return
   * @returns {Array} - Array of matching parts
   */
  async queryVectors(query, filters = {}, limit = 10) {
    try {
      console.log(`Querying vector database for: "${query}"`);
      
      // Load index if not loaded
      if (!this.index) {
        const loaded = await this.loadIndex();
        if (!loaded) {
          throw new Error('Vector index not loaded, run vectorization first');
        }
      }
      
      // Ensure index is initialized
      if (!this.index || this.metadata.length === 0) {
        throw new Error('Search index has not been properly initialized or is empty');
      }
      
      // Use regex to detect various entity types in the query
      const partNumberMatches = query.match(/PS\d{5,9}/gi) || [];
      const modelNumberMatches = query.match(/[A-Z]{2,3}\d{3,7}/gi) || [];
      
      // Common brands in refrigerators and dishwashers
      const commonBrands = [
        'Whirlpool', 'GE', 'Samsung', 'LG', 'Maytag', 'Frigidaire', 'KitchenAid', 
        'Bosch', 'Kenmore', 'Amana', 'Electrolux', 'Jenn-Air'
      ];
      
      // Check for brand mentions
      const brandMatches = [];
      const lowerQuery = query.toLowerCase();
      
      commonBrands.forEach(brand => {
        if (lowerQuery.includes(brand.toLowerCase())) {
          brandMatches.push(brand);
        }
      });
      
      console.log(`Detected entities in query:`, {
        parts: partNumberMatches,
        models: modelNumberMatches,
        brands: brandMatches
      });
      
      // Calculate query complexity to determine how many results to return
      const queryComplexity = partNumberMatches.length + modelNumberMatches.length + brandMatches.length;
      // Adjust result limit based on complexity, but ensure at least 3 results
      const dynamicLimit = Math.max(3, Math.min(limit, queryComplexity > 0 ? 5 : 10));
      
      let exactMatches = [];
      let entityMatches = [];
      
      // STEP 1: Find exact part number matches (highest priority)
      if (partNumberMatches.length > 0) {
        const partNumbers = partNumberMatches.map(match => match.toUpperCase());
        console.log(`Searching for exact matches for part numbers: ${partNumbers.join(', ')}`);
        
        // Find all documents with matching part numbers
        exactMatches = this.metadata
          .map((item, index) => ({ ...item, index }))
          .filter(item => 
            partNumbers.some(partNumber => 
              item.partNumber === partNumber || 
              (item.text && item.text.includes(partNumber))
            )
          )
          .map(item => ({
            ...item,
            score: 1.0, // Perfect score for exact matches
            exactMatch: true
          }));
        
        console.log(`Found ${exactMatches.length} exact part number matches`);
      }
      
      // STEP 2: Find model number matches (second priority)
      if (modelNumberMatches.length > 0 && exactMatches.length === 0) {
        const modelNumbers = modelNumberMatches.map(match => match.toUpperCase());
        console.log(`Searching for model matches: ${modelNumbers.join(', ')}`);
        
        const modelMatches = this.metadata
          .map((item, index) => ({ ...item, index }))
          .filter(item => {
            // Check if this item is a model or if it's compatible with the model
            if (item.entityType === 'model') {
              return modelNumbers.some(model => 
                item.modelNumber && item.modelNumber.toUpperCase().includes(model)
              );
            } else if (item.compatibleModels && Array.isArray(item.compatibleModels)) {
              return modelNumbers.some(model => 
                item.compatibleModels.some(compatModel => 
                  compatModel.toUpperCase().includes(model)
                )
              );
            }
            return false;
          })
          .map(item => ({
            ...item,
            score: 0.95, // High score but not perfect
            modelMatch: true
          }));
        
        entityMatches = [...entityMatches, ...modelMatches];
        console.log(`Found ${modelMatches.length} model matches`);
      }
      
      // STEP 3: Find brand matches (third priority)
      if (brandMatches.length > 0 && exactMatches.length === 0) {
        console.log(`Searching for brand matches: ${brandMatches.join(', ')}`);
        
        const brandEntityMatches = this.metadata
          .map((item, index) => ({ ...item, index }))
          .filter(item => {
            if (item.entityType === 'brand') {
              return brandMatches.some(brand => 
                item.brandName && item.brandName.toLowerCase() === brand.toLowerCase()
              );
            } else {
              return brandMatches.some(brand => 
                item.brand && item.brand.toLowerCase() === brand.toLowerCase()
              );
            }
          })
          .map(item => ({
            ...item,
            score: 0.9, // Good score but not as high as exact or model matches
            brandMatch: true
          }));
        
        entityMatches = [...entityMatches, ...brandEntityMatches];
        console.log(`Found ${brandEntityMatches.length} brand matches`);
      }
      
      // STEP 4: If we have exact or entity matches, prioritize them
      if (exactMatches.length > 0 || entityMatches.length > 0) {
        // Combine exact and entity matches, removing duplicates
        const seenIndices = new Set(exactMatches.map(item => item.index));
        
        // Add entity matches that aren't already in exact matches
        const filteredEntityMatches = entityMatches.filter(item => !seenIndices.has(item.index));
        filteredEntityMatches.forEach(item => seenIndices.add(item.index));
        
        const priorityResults = [...exactMatches, ...filteredEntityMatches];
        
        // Apply any additional filters
        const filteredResults = this.applyFilters(priorityResults, filters);
        
        // If we have enough priority matches, return them without semantic search
        if (filteredResults.length >= dynamicLimit) {
          return filteredResults.slice(0, dynamicLimit);
        }
        
        // Store the seen indices to avoid duplicates in semantic results
        return this.combineWithSemanticResults(query, filteredResults, seenIndices, filters, dynamicLimit);
      }
      
      // STEP 5: Fall back to semantic search if no entity matches found
      return this.performSemanticSearch(query, filters, dynamicLimit);
    } catch (err) {
      console.error('Error querying vectors:', err);
      return [];
    }
  }
  
  /**
   * Perform semantic search based on query embedding
   */
  async performSemanticSearch(query, filters = {}, limit = 10) {
    // Convert query to embedding for semantic search
    const queryEmbedding = await this.embeddings.embedText(query);
    
    // Search for similar vectors
    const numResults = Math.min(limit * 3, this.metadata.length); // Get more results for filtering
    const result = this.index.searchKnn(queryEmbedding, numResults);
    
    // Map results
    let semanticResults = result.neighbors.map((index, i) => ({
      ...this.metadata[index],
      score: 1 - result.distances[i], // Convert distance to similarity score
      index
    }));
    
    // Apply filters
    return this.applyFilters(semanticResults, filters).slice(0, limit);
  }
  
  /**
   * Apply filters to search results
   */
  applyFilters(results, filters = {}) {
    if (Object.keys(filters).length === 0) {
      return results;
    }
    
    return results.filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (typeof item[key] === 'string' && typeof value === 'string') {
          return item[key].toLowerCase() === value.toLowerCase();
        }
        return item[key] === value;
      });
    });
  }
  
  /**
   * Combine priority results with semantic search results
   */
  async combineWithSemanticResults(query, priorityResults, seenIndices, filters, limit) {
    // Get semantic results
    const semanticResults = await this.performSemanticSearch(query, filters, limit * 2);
    
    // Filter out any results that are already in priority results
    const filteredSemanticResults = semanticResults.filter(
      item => !seenIndices.has(item.index)
    );
    
    // Combine and limit
    return [...priorityResults, ...filteredSemanticResults].slice(0, limit);
  }
  
  /**
   * Delete the index and metadata files
   */
  async resetVectors() {
    try {
      console.log('Resetting vector database...');
      
      // Delete files if they exist
      if (fs.existsSync(INDEX_PATH)) {
        fs.unlinkSync(INDEX_PATH);
      }
      
      if (fs.existsSync(METADATA_PATH)) {
        fs.unlinkSync(METADATA_PATH);
      }
      
      // Reset instance variables
      this.index = null;
      this.metadata = [];
      
      console.log('Vector database reset complete');
      return true;
    } catch (err) {
      console.error('Error resetting vector database:', err);
      throw err;
    }
  }
}

module.exports = new VectorDB(); 