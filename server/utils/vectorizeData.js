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
        // Add image URL if available in the part data, otherwise generate one
        imageUrl: part.imageUrl || `https://www.partselect.com/assets/images/parts/${part.partSelectNumber}.jpg`,
        // Check if the part has installation video
        hasVideo: part.hasInstallationVideo || false,
        videoUrl: part.hasInstallationVideo ? 
          `https://www.partselect.com/Installation-Video-${part.partSelectNumber}.htm` : null
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
      
      // Check for direct part number match first (case insensitive)
      const partNumberMatch = query.match(/PS\d+/i);
      let exactMatches = [];
      
      if (partNumberMatch) {
        const partNumber = partNumberMatch[0].toUpperCase();
        console.log(`Found part number in query: ${partNumber}, checking for exact matches`);
        
        // Find exact matches first
        exactMatches = this.metadata
          .map((item, index) => ({ ...item, index }))
          .filter(item => 
            item.partNumber === partNumber || 
            (item.text && item.text.includes(partNumber))
          )
          .map(item => ({
            ...item,
            score: 1.0, // Give exact matches a perfect score
            exactMatch: true
          }));
        
        if (exactMatches.length > 0) {
          console.log(`Found ${exactMatches.length} exact matches for part number ${partNumber}`);
        }
      }
      
      // Convert query to embedding for semantic search
      const queryEmbedding = await this.embeddings.embedText(query);
      
      // Search for similar vectors
      const numResults = Math.min(limit * 3, this.metadata.length); // Get more results for filtering
      const result = this.index.searchKnn(queryEmbedding, numResults);
      
      // Map results and apply filters
      let semanticResults = result.neighbors.map((index, i) => ({
        ...this.metadata[index],
        score: 1 - result.distances[i], // Convert distance to similarity score
        index
      }));
      
      // Apply filters if any
      if (Object.keys(filters).length > 0) {
        semanticResults = semanticResults.filter(item => {
          return Object.entries(filters).every(([key, value]) => {
            if (typeof item[key] === 'string' && typeof value === 'string') {
              return item[key].toLowerCase() === value.toLowerCase();
            }
            return item[key] === value;
          });
        });
      }
      
      // Combine exact and semantic results, removing duplicates
      const seenIndices = new Set(exactMatches.map(item => item.index));
      const combinedResults = [
        ...exactMatches,
        ...semanticResults.filter(item => !seenIndices.has(item.index))
      ];
      
      // Limit results
      const finalResults = combinedResults.slice(0, limit);
      
      console.log(`Found ${exactMatches.length} exact matches and ${semanticResults.length} semantic matches, returning ${finalResults.length} total results`);
      
      // Log the results for debugging
      finalResults.forEach((result, i) => {
        console.log(`Result ${i+1}${result.exactMatch ? ' (EXACT MATCH)' : ''}:`);
        console.log(`  Part number: ${result.partNumber || 'unknown'}`);
        console.log(`  Title: ${result.text ? result.text.split(':')[0] : 'unknown'}`);
        console.log(`  Score: ${result.score.toFixed(4)}`);
      });
      
      return finalResults;
    } catch (err) {
      console.error('Error querying vector database:', err);
      throw err;
    }
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