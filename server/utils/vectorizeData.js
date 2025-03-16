/**
 * Vector Database Utility for PartSelect Data
 * 
 * This utility converts consolidated part data into vector embeddings
 * and stores them in a Chroma vector database for semantic retrieval.
 */
const fs = require('fs');
const path = require('path');
const { Chroma } = require('chromadb');
const { DeepseekEmbeddings } = require('./deepseekUtils');

// Constants
const COLLECTION_NAME = 'partselect_parts';
const CONSOLIDATED_DATA_PATH = path.join(__dirname, '../data/consolidated-data.json');
const CHUNK_SIZE = 1000; // Process in batches to avoid memory issues

class PartSelectVectorDB {
  constructor() {
    // Initialize Chroma client
    this.client = new Chroma({
      path: path.join(__dirname, '../data/vector-db')
    });
    
    // Initialize embeddings client from existing utility
    this.embeddings = new DeepseekEmbeddings();
    
    // Create or get collection
    this.collection = this.client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { 
        description: 'PartSelect appliance parts data',
        created: new Date().toISOString()
      }
    });
  }

  /**
   * Load consolidated data from file
   */
  loadConsolidatedData() {
    try {
      console.log('Loading consolidated data...');
      const data = JSON.parse(fs.readFileSync(CONSOLIDATED_DATA_PATH, 'utf8'));
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
        partNumber: part.partSelectNumber,
        type: part.partType || 'unknown',
        brand: part.brand || 'unknown',
        appliance: part.context || 'unknown',
        inStock: part.inStock || false,
        price: part.price || '0',
        rating: part.rating || 0,
        reviewCount: part.reviewCount || 0
      };
      
      // Prepare main part information
      chunks.push({
        id: `part-${part.partSelectNumber}`,
        text: `${part.title} (${part.partSelectNumber}): ${part.description || ''}`,
        metadata: { ...metadata, chunkType: 'general' }
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
   * Vectorize all data chunks and store in Chroma
   */
  async vectorizeAllData() {
    try {
      console.log('Starting vectorization process...');
      
      // Load data
      const consolidatedData = this.loadConsolidatedData();
      
      // Prepare chunks
      const chunks = this.prepareChunks(consolidatedData);
      
      // Process in batches to avoid memory issues
      for (let i = 0; i < chunks.length; i += CHUNK_SIZE) {
        const batchChunks = chunks.slice(i, i + CHUNK_SIZE);
        console.log(`Processing batch ${i/CHUNK_SIZE + 1} of ${Math.ceil(chunks.length/CHUNK_SIZE)}, with ${batchChunks.length} chunks`);
        
        // Generate embeddings for batch
        const embeddings = await Promise.all(
          batchChunks.map(chunk => this.embeddings.embedText(chunk.text))
        );
        
        // Add to Chroma
        await this.collection.add({
          ids: batchChunks.map(chunk => chunk.id),
          embeddings: embeddings,
          metadatas: batchChunks.map(chunk => chunk.metadata),
          documents: batchChunks.map(chunk => chunk.text)
        });
        
        console.log(`Completed batch ${i/CHUNK_SIZE + 1}`);
      }
      
      console.log('Vectorization complete!');
      console.log(`Total vectors in database: ${await this.collection.count()}`);
      
      return true;
    } catch (err) {
      console.error('Error during vectorization:', err);
      throw err;
    }
  }

  /**
   * Query the vector database for relevant parts
   */
  async queryVectors(query, filters = {}, limit = 5) {
    try {
      console.log(`Querying vector database for: "${query}"`);
      
      // Convert query to embedding
      const queryEmbedding = await this.embeddings.embedText(query);
      
      // Prepare filter expression if needed
      let filterExpression = null;
      if (Object.keys(filters).length > 0) {
        filterExpression = Object.entries(filters)
          .map(([key, value]) => `metadata.${key} == "${value}"`)
          .join(' && ');
      }
      
      // Query the collection
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit,
        where: filterExpression
      });
      
      console.log(`Found ${results.ids[0].length} matching results`);
      
      // Format results for easy consumption
      return results.ids[0].map((id, idx) => ({
        id: id,
        text: results.documents[0][idx],
        metadata: results.metadatas[0][idx],
        distance: results.distances[0][idx]
      }));
    } catch (err) {
      console.error('Error querying vector database:', err);
      throw err;
    }
  }
  
  /**
   * Delete and recreate the collection
   */
  async resetCollection() {
    try {
      console.log('Resetting vector collection...');
      await this.client.deleteCollection({ name: COLLECTION_NAME });
      this.collection = await this.client.createCollection({ 
        name: COLLECTION_NAME,
        metadata: { 
          description: 'PartSelect appliance parts data',
          created: new Date().toISOString()
        }
      });
      console.log('Collection reset complete');
      return true;
    } catch (err) {
      console.error('Error resetting collection:', err);
      throw err;
    }
  }
}

module.exports = new PartSelectVectorDB(); 