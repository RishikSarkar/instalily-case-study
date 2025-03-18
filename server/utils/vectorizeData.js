// Vector Database Utility for PartSelect Data
const fs = require('fs');
const path = require('path');
const { HierarchicalNSW } = require('hnswlib-node');
const { DeepseekEmbeddings } = require('./deepseekUtils');
const { loadJsonFromFile, saveJsonToFile, ensureDataDirectories } = require('./fileUtils');

// Constants
const INDEX_PATH = path.join(__dirname, '../data/vectors/parts_index.bin');
const METADATA_PATH = path.join(__dirname, '../data/vectors/parts_metadata.json');
const CONSOLIDATED_DATA_PATH = path.join(__dirname, '../data/consolidated-data.json');
const EMBEDDING_DIMENSIONS = 1536;
const CHUNK_SIZE = 100;

class VectorDB {
  constructor() {
    this.embeddings = new DeepseekEmbeddings();
    this.index = null;
    this.metadata = [];
    
    ensureDataDirectories();
    
    const vectorsDir = path.dirname(INDEX_PATH);
    if (!fs.existsSync(vectorsDir)) {
      fs.mkdirSync(vectorsDir, { recursive: true });
    }
    
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

  prepareChunks(consolidatedData) {
    console.log('Preparing text chunks for vectorization...');
    const chunks = [];
    
    Object.entries(consolidatedData.parts).forEach(([partNum, part]) => {
      if (!part.partSelectNumber || !part.title) return;
      
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
        imageUrl: part.imageUrl || `https://www.partselect.com/assets/images/parts/${part.partSelectNumber}.jpg`,
        hasVideo: part.hasInstallationVideo || false,
        videoUrl: part.hasInstallationVideo ? 
          `https://www.partselect.com/Installation-Video-${part.partSelectNumber}.htm` : null,
        compatibleModels: part.compatibleWith || []
      };
      
      chunks.push({
        id: `part-${part.partSelectNumber}`,
        text: `${part.title} (${part.partSelectNumber}): ${part.description || ''}`,
        metadata
      });
      
      if (part.userReview && part.userReview.content) {
        chunks.push({
          id: `review-${part.partSelectNumber}`,
          text: `Review for ${part.title} (${part.partSelectNumber}): ${part.userReview.title || ''} - ${part.userReview.content}`,
          metadata: { ...metadata, chunkType: 'review' }
        });
      }
      
      if (part.symptoms && part.symptoms.length > 0) {
        chunks.push({
          id: `symptoms-${part.partSelectNumber}`,
          text: `Symptoms resolved by ${part.title} (${part.partSelectNumber}): ${part.symptoms.join(', ')}`,
          metadata: { ...metadata, chunkType: 'symptoms' }
        });
      }
    });
    
    if (consolidatedData.relationships && consolidatedData.relationships.byBrand) {
      console.log('Adding brand vectors...');
      
      Object.entries(consolidatedData.relationships.byBrand).forEach(([brand, brandInfo]) => {
        if (!brand) return;
        
        const partTypesByBrand = {};
        
        const brandParts = brandInfo.parts || [];
        
        brandParts.forEach(partNumber => {
          const part = consolidatedData.parts[partNumber];
          if (part && part.partType) {
            partTypesByBrand[part.partType] = (partTypesByBrand[part.partType] || 0) + 1;
          }
        });
        
        const specialties = Object.entries(partTypesByBrand)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(entry => entry[0]);
        
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
    
    if (consolidatedData.relationships && consolidatedData.relationships.byType) {
      console.log('Adding category vectors...');
      
      Object.entries(consolidatedData.relationships.byType).forEach(([category, categoryInfo]) => {
        if (!category) return;
        
        const categoryParts = categoryInfo.parts || [];
        
        const brandsByCategory = {};
        categoryParts.forEach(partNumber => {
          const part = consolidatedData.parts[partNumber];
          if (part && part.brand) {
            brandsByCategory[part.brand] = (brandsByCategory[part.brand] || 0) + 1;
          }
        });
        
        const topBrands = Object.entries(brandsByCategory)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(entry => entry[0]);
        
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
    if (consolidatedData.relationships && consolidatedData.relationships.byModel) {
      console.log('Adding model vectors...');
      
      Object.entries(consolidatedData.relationships.byModel).forEach(([model, modelInfo]) => {
        if (!model) return;
        
        const compatibleParts = modelInfo.parts || [];
        
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

  async vectorizeAllData() {
    try {
      console.log('Starting vectorization process...');
      
      const consolidatedData = this.loadConsolidatedData();
      
      const chunks = this.prepareChunks(consolidatedData);
      
      this.index = new HierarchicalNSW('cosine', EMBEDDING_DIMENSIONS);
      this.index.initIndex(chunks.length, 16, 200, 100);
      
      this.metadata = [];
      
      let totalProcessed = 0;
      for (let i = 0; i < chunks.length; i += CHUNK_SIZE) {
        const batchChunks = chunks.slice(i, i + CHUNK_SIZE);
        console.log(`Processing batch ${Math.floor(i/CHUNK_SIZE) + 1} of ${Math.ceil(chunks.length/CHUNK_SIZE)}, with ${batchChunks.length} chunks`);
        
        const texts = batchChunks.map(chunk => chunk.text);
        
        const embeddings = await this.embeddings.embedBatch(texts);
        
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
      
      await this.saveIndex();
      
      console.log('Vectorization complete!');
      console.log(`Total vectors in database: ${this.metadata.length}`);
      
      return true;
    } catch (err) {
      console.error('Error during vectorization:', err);
      throw err;
    }
  }

  async saveIndex() {
    try {
      console.log('Saving vector index and metadata...');
      
      this.index.writeIndex(INDEX_PATH);
      
      saveJsonToFile(this.metadata, METADATA_PATH);
      
      console.log('Vector index and metadata saved successfully');
      return true;
    } catch (err) {
      console.error('Error saving vector index:', err);
      throw err;
    }
  }

  async loadIndex() {
    try {
      if (!fs.existsSync(INDEX_PATH) || !fs.existsSync(METADATA_PATH)) {
        console.warn('Vector index or metadata not found, need to run vectorization first');
        return false;
      }
      
      console.log('Loading vector index and metadata...');
      
      this.metadata = loadJsonFromFile(METADATA_PATH);
      if (!this.metadata || !Array.isArray(this.metadata) || this.metadata.length === 0) {
        console.warn('Metadata is empty or invalid');
        return false;
      }
      
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

  async queryVectors(query, filters = {}, limit = 10) {
    try {
      console.log(`Querying vector database for: "${query}"`);
      
      if (!this.index) {
        const loaded = await this.loadIndex();
        if (!loaded) {
          throw new Error('Vector index not loaded, run vectorization first');
        }
      }
      
      if (!this.index || this.metadata.length === 0) {
        throw new Error('Search index has not been properly initialized or is empty');
      }
      
      const partNumberMatches = query.match(/PS\d{5,9}/gi) || [];
      const modelNumberMatches = query.match(/[A-Z]{2,3}\d{3,7}/gi) || [];
      
      const commonBrands = [
        'Whirlpool', 'GE', 'Samsung', 'LG', 'Maytag', 'Frigidaire', 'KitchenAid', 
        'Bosch', 'Kenmore', 'Amana', 'Electrolux', 'Jenn-Air'
      ];
      
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
      
      const queryComplexity = partNumberMatches.length + modelNumberMatches.length + brandMatches.length;
      const dynamicLimit = Math.max(3, Math.min(limit, queryComplexity > 0 ? 5 : 10));
      
      let exactMatches = [];
      let entityMatches = [];
      
      // STEP 1: Find exact part number matches (highest priority)
      if (partNumberMatches.length > 0) {
        const partNumbers = partNumberMatches.map(match => match.toUpperCase());
        console.log(`Searching for exact matches for part numbers: ${partNumbers.join(', ')}`);
        
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
            score: 1.0,
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
            score: 0.95,
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
            score: 0.9,
            brandMatch: true
          }));
        
        entityMatches = [...entityMatches, ...brandEntityMatches];
        console.log(`Found ${brandEntityMatches.length} brand matches`);
      }
      
      // STEP 4: If we have exact or entity matches, prioritize them
      if (exactMatches.length > 0 || entityMatches.length > 0) {
        const seenIndices = new Set(exactMatches.map(item => item.index));
        
        const filteredEntityMatches = entityMatches.filter(item => !seenIndices.has(item.index));
        filteredEntityMatches.forEach(item => seenIndices.add(item.index));
        
        const priorityResults = [...exactMatches, ...filteredEntityMatches];
        
        const filteredResults = this.applyFilters(priorityResults, filters);
        
        if (filteredResults.length >= dynamicLimit) {
          return filteredResults.slice(0, dynamicLimit);
        }
        
        return this.combineWithSemanticResults(query, filteredResults, seenIndices, filters, dynamicLimit);
      }
      
      // STEP 5: Fall back to semantic search if no entity matches found
      return this.performSemanticSearch(query, filters, dynamicLimit);
    } catch (err) {
      console.error('Error querying vectors:', err);
      return [];
    }
  }
  
  async performSemanticSearch(query, filters = {}, limit = 10) {
    const queryEmbedding = await this.embeddings.embedText(query);
    
    const numResults = Math.min(limit * 3, this.metadata.length);
    const result = this.index.searchKnn(queryEmbedding, numResults);
    
    let semanticResults = result.neighbors.map((index, i) => ({
      ...this.metadata[index],
      score: 1 - result.distances[i],
      index
    }));
    
    return this.applyFilters(semanticResults, filters).slice(0, limit);
  }
  
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
  
  async combineWithSemanticResults(query, priorityResults, seenIndices, filters, limit) {
    const semanticResults = await this.performSemanticSearch(query, filters, limit * 2);
    
    const filteredSemanticResults = semanticResults.filter(
      item => !seenIndices.has(item.index)
    );
    
    return [...priorityResults, ...filteredSemanticResults].slice(0, limit);
  }
  
  async resetVectors() {
    try {
      console.log('Resetting vector database...');
      
      if (fs.existsSync(INDEX_PATH)) {
        fs.unlinkSync(INDEX_PATH);
      }
      
      if (fs.existsSync(METADATA_PATH)) {
        fs.unlinkSync(METADATA_PATH);
      }
      
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