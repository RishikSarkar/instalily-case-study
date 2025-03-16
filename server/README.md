# PartSelect Data Scraper

This project contains scripts and data for scraping appliance parts information from PartSelect.com, with a focus on refrigerator and dishwasher parts.

## Directory Structure

```
server/
│
├── config/             # Configuration files
│   └── scraper-config.js  # Scraper configuration
│
├── data/               # Scraped data directory
│   ├── consolidated-data.json  # All parts in a single file
│   ├── parts/              # Individual part details
│   ├── dishwasher/         # Dishwasher-specific data
│   ├── refrigerator/       # Refrigerator-specific data
│   └── vectors/            # Vector embeddings for semantic search
│       ├── parts_index.bin    # Vector index binary file
│       └── parts_metadata.json # Associated metadata for vectors
│
├── routes/             # API routes
│   └── chat.js         # Chat API endpoint
│
├── scraper/            # Scraper modules
│   ├── comprehensive-scraper.js  # Main scraper implementation
│   ├── generate-consolidated-data.js  # Data consolidation script
│   └── index.js        # Scraper module exports
│
├── utils/              # Utility functions
│   ├── consolidateData.js  # Data consolidation utilities
│   ├── deepseekUtils.js    # Integration with Deepseek AI
│   ├── fileUtils.js        # File handling utilities
│   ├── htmlParser.js       # HTML parsing utilities
│   └── vectorizeData.js    # Vector embedding and search utilities
│
├── .env                # Environment variables (not in repo)
├── .env.example        # Example environment variables
├── cli.js              # Command-line interface for scraper and vectorization
├── package.json        # Project dependencies
└── server.js           # Express server entry point
```

## Available Scripts

The project includes several NPM scripts for convenience:

- `npm start` - Starts the Express server
- `npm run dev` - Starts the server with Nodemon for development
- `npm run scrape` - Runs the scraper with default settings
- `npm run scrape:basic` - Runs a limited scrape (10 parts, 2 pages)
- `npm run scrape:enhanced` - Runs a moderate scrape (20 parts, 5 pages)
- `npm run scrape:full` - Runs a full scrape with no limits (takes a long time)
- `npm run generate-data` - Generates consolidated data from existing part files
- `npm run check-missing` - Checks for missing brands and part types in the data

## CLI Options

The scraper can be run with various options:

```
node cli.js --help
```

### Scraper Options:
- `--maxParts=<number>` - Set maximum parts per page to extract
- `--maxPages=<number>` - Set maximum pages per category to scrape
- `--delay=<milliseconds>` - Set delay between requests
- `--generateData` - Only regenerate consolidated data from existing parts
- `--fullScrape` - Run a full scrape with no limits (may take a long time)
- `--checkMissing` - Check for missing brands and part types in the data

### Vectorization Options:
- `--vectorize` - Vectorize the consolidated data for semantic search
- `--resetVectors` - Reset the vector database before vectorization

## Vector Search System

The project includes a comprehensive vector search system for semantic searching of appliance parts based on user queries.

### Vector Storage

- **Technology**: The system uses `hnswlib-node` for vector storage and retrieval
- **Storage Location**: Vector data is stored in the `data/vectors/` directory:
  - `parts_index.bin` - Binary file containing the vector index
  - `parts_metadata.json` - JSON file containing metadata for each vector
- **Vector Dimensions**: 1536 dimensions (compatible with most embedding models)

### Embedding Generation

- **Embedding Source**: The system is configured to use Deepseek API for generating embeddings
- **Mock Implementation**: For testing without API access, the system includes a fallback to generate deterministic mock embeddings based on content hashing
- **Batch Processing**: Embeddings are generated in batches of 100 chunks to manage memory usage

### Vectorization Process

When running `node cli.js --vectorize`:

1. The consolidated data is loaded from `data/consolidated-data.json`
2. The data is split into chunks (currently 1,554 chunks from 1,014 parts)
3. Each chunk is converted to a vector embedding
4. The vectors and metadata are stored in the vector database
5. The process takes several minutes depending on data size

### Query Processing

The `queryVectors` method in `vectorizeData.js` handles search queries:

1. **Part Number Detection**: First checks for part numbers (PS12345678 format) in the query
2. **Exact Matching**: When a part number is detected, the system prioritizes exact matches
3. **Semantic Search**: For all queries, performs semantic search to find similar items
4. **Result Combination**: Exact matches are placed first, followed by semantically similar items
5. **Result Limit**: By default, returns the top 10 most relevant results

### Improved Search Algorithm

The search system includes several enhancements:

- **Exact Part Matching**: Prioritizes exact part number matches with a perfect score of 1.0
- **Part Number Detection**: Uses regex pattern matching (`/PS\d+/i`) to detect part numbers in queries
- **Result Grouping**: Groups results by type (exact matches, general parts, reviews, symptoms)
- **Enhanced Filtering**: Supports filtering by brand, appliance type, and other metadata properties

## Chat API System

The chat API integrates vector search with the Deepseek LLM to provide intelligent responses.

### API Endpoints

- `POST /api/chat` - Main chat endpoint that accepts user messages and returns AI responses
- `POST /api/chat/vectorize` - Admin endpoint to trigger vectorization (protected by API key)
- `GET /api/chat/vectorize/status` - Check vectorization status

### Chat Processing Flow

1. User sends a message through the chat API
2. The system performs vector search to find relevant parts
3. Retrieved parts are formatted into context for the LLM
4. The Deepseek LLM generates a response based on the context
5. The system returns both the LLM response and relevant part information

### Response Format

```json
{
  "response": "LLM-generated text response",
  "parts": [
    {
      "partNumber": "PS12345678",
      "title": "Part Title",
      "price": "12.34",
      "inStock": true,
      "type": "Part Type",
      "brand": "Brand Name",
      "appliance": "refrigerator",
      "exactMatch": true
    },
    ...
  ]
}
```

## Data Structure

The consolidated data file contains:

- Parts organized by part number
- Relationships between parts, brands, and appliance types
- Meta information about the dataset

## Environment Variables

Copy `.env.example` to `.env` and set:

- `PORT` - Server port (default: 5000)
- `DEEPSEEK_API_KEY` - Your Deepseek API key
- `MAX_PARTS_PER_PAGE` - Maximum parts per page to extract
- `MAX_PAGES_PER_CATEGORY` - Maximum pages per category to scrape
- `DELAY_BETWEEN_REQUESTS` - Delay between requests in milliseconds
- `ADMIN_API_KEY` - Admin API key for protected routes

## Supported Brands and Part Types

### Dishwasher Brands
Admiral, Amana, Beko, Blomberg, Bosch, Caloric, Crosley, Dacor, Electrolux, Estate, 
Frigidaire, Gaggenau, GE, Gibson, Haier, Hotpoint, Inglis, Jenn-Air, Kelvinator, 
Kenmore, KitchenAid, LG, Magic Chef, Maytag, Norge, Roper, Samsung, SMEG, Speed Queen, 
Tappan, Thermador, Uni, Whirlpool, White-Westinghouse

### Refrigerator Brands
Admiral, Amana, Beko, Blomberg, Bosch, Caloric, Crosley, Dacor, Dynasty, Electrolux, 
Estate, Frigidaire, Gaggenau, GE, Gibson, Haier, Hardwick, Hoover, Hotpoint, Inglis, 
International, Jenn-Air, Kelvinator, Kenmore, KitchenAid, LG, Litton, Magic Chef, 
Maytag, Norge, RCA, Roper, Samsung, Sharp, SMEG, Tappan, Thermador, Uni, Whirlpool, 
White-Westinghouse

### Dishwasher Part Types
Dishracks, Wheels and Rollers, Seals and Gaskets, Spray Arms, Hardware, Pumps, Latches, 
Elements and Burners, Valves, Hoses and Tubes, Filters, Brackets and Flanges, Hinges, 
Racks, Springs and Shock Absorbers, Caps and Lids, Switches, Dispensers, Circuit Boards 
and Touch Pads, Bearings, Motors, Thermostats, Panels, Sensors, Trays and Shelves, 
Grilles and Kickplates, Handles, Drawers and Glides, Knobs, Insulation, Timers, 
Ducts and Vents, Wire Plugs and Connectors, Doors, Legs and Feet, Trim, Manuals and Literature

### Refrigerator Part Types
Trays and Shelves, Drawers and Glides, Filters, Ice Makers, Hardware, Seals and Gaskets, 
Switches, Hinges, Lights and Bulbs, Valves, Motors, Caps and Lids, Thermostats, Door Shelves, 
Wheels and Rollers, Handles, Hoses and Tubes, Doors, Elements and Burners, Circuit Boards 
and Touch Pads, Dispensers, Electronics, Sensors, Fans and Blowers, Brackets and Flanges, 
Timers, Bearings, Compressors, Springs and Shock Absorbers, Grilles and Kickplates, Latches, 
Knobs, Trim, Wire Plugs and Connectors, Tanks and Containers, Legs and Feet, Drip Bowls, 
Panels, Ducts and Vents, Insulation, Grates, Racks, Power Cords, Blades, Deflectors and Chutes, 
Starters, Manuals and Literature, Transformers 