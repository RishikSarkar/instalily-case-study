const path = require('path');
const fs = require('fs');
const { HierarchicalNSW } = require('hnswlib-node');
const { fileUtils } = require('./fileUtils');

// Creates embeddings and stores them in a vector database
async function createAndStoreEmbeddings(documents, embeddingFunction, indexPath, dimensions = 1536) {
  try {
    console.log(`Creating embeddings for ${documents.length} documents...`);
    
    // Create HNSW index
    const index = new HierarchicalNSW('cosine', dimensions);
    index.initIndex(documents.length);
    
    const batchSize = 50;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(documents.length / batchSize)}`);
      
      const texts = batch.map(doc => {
        return [
          doc.title || '',
          doc.partNumber || '',
          doc.description || '',
          doc.category || '',
          Array.isArray(doc.compatibleModels) ? doc.compatibleModels.join(' ') : '',
          doc.installationGuide || ''
        ].filter(Boolean).join(' ');
      });
      
      const embeddings = await embeddingFunction(texts);
      
      for (let j = 0; j < batch.length; j++) {
        const docIndex = i + j;
        index.addPoint(embeddings[j], docIndex);
      }
    }
    
    const indexDir = path.dirname(indexPath);
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }
    
    index.writeIndex(indexPath);
    console.log(`Vector index saved to ${indexPath}`);
    
    return true;
  } catch (error) {
    console.error('Error creating embeddings:', error);
    return false;
  }
}

//Searches the vector index for similar documents
async function searchVectors(query, embeddingFunction, indexPath, documents, numResults = 5) {
  try {
    if (!fs.existsSync(indexPath)) {
      console.error(`Vector index not found at ${indexPath}`);
      return [];
    }
    
    const queryEmbedding = await embeddingFunction([query]);
    
    const dimensions = queryEmbedding[0].length;
    const index = new HierarchicalNSW('cosine', dimensions);
    index.readIndex(indexPath, documents.length);
    
    const result = index.searchKnn(queryEmbedding[0], numResults);
    
    return result.neighbors.map((docIndex, i) => ({
      ...documents[docIndex],
      score: result.distances[i]
    }));
  } catch (error) {
    console.error('Error searching vectors:', error);
    return [];
  }
}

module.exports = {
  createAndStoreEmbeddings,
  searchVectors
}; 