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

## LLM and Chat Interface Implementation

The chat interface uses a combination of vector search and the Deepseek LLM to provide helpful, accurate responses about appliance parts. 

### LLM Integration

The system integrates with Deepseek AI through the `deepseekUtils.js` module:

- **Model**: Uses the `deepseek-chat` model for conversational responses
- **API Configuration**: 
  - Temperature: 0.7 (balanced between creativity and consistency)
  - Max tokens: 800 (sufficient for detailed responses)
  - Connection established via API key in .env file

### System Prompt

The LLM is guided by a carefully crafted system prompt that establishes its behavior:

```
You are a helpful appliance parts assistant for PartSelect, specializing in refrigerator and dishwasher parts.

IMPORTANT GUIDELINES:
1. Always reference part numbers in your responses when discussing specific parts (format: PS followed by numbers, e.g. PS12345678)
2. Maintain context from previous messages in the conversation
3. Accurately report inventory status of parts when relevant to the user's query
4. Only mention stock status when it's relevant to the conversation or explicitly asked about
5. Focus on providing helpful information about part specifications, compatibility, and installation
6. For installation queries, provide clear step-by-step instructions
7. Focus only on refrigerator and dishwasher parts - politely decline other topics
8. Be conversational and natural in your responses
```

### Context Formatting

When providing parts information to the LLM, the system organizes it into these sections:

1. **Inventory Information**: Simple list of part numbers with availability status
2. **Exact Part Matches**: Detailed information about exact matching parts
3. **Related Parts**: Information about semantically related parts
4. **Customer Reviews**: Optional section with review excerpts
5. **Symptoms Information**: Details about symptoms resolved by parts

Example of formatted context:
```
INVENTORY INFORMATION:
Part PS11752778 availability: In Stock
Part PS12345678 availability: In Stock

EXACT PART MATCHES:
Refrigerator Door Shelf Bin
Part Number: PS11752778
Price: $36.18
Availability: In Stock
Brand: Whirlpool
Type: Door shelf
For: refrigerator

RELATED PARTS:
[Additional parts information...]
```

### Conversation Management

The system maintains conversation history to provide context-aware responses:

- User queries and assistant responses are stored in an array
- Each message includes a `role` (user/assistant) and `content`
- History is passed to the LLM with each new query
- The LLM uses this history to maintain context across multiple turns

### Part Cards Implementation

The frontend displays product "part cards" based on the chat interaction:

1. **Display Logic**: Controlled by the `shouldShowPartCards()` function, which analyzes:
   - Presence of part numbers in query or response
   - Keywords suggesting the user is looking for parts
   - Part type mentions in the conversation
   - Avoiding display for simple follow-up messages

2. **Part Selection Logic**: The `filterRelevantParts()` function determines which parts to show:
   - Prioritizes parts mentioned by part number
   - Considers exact matches next
   - Looks for part types mentioned in the conversation
   - Limits to 5 most relevant parts
   - Sorts by exact match status, stock availability, and relevance score

3. **Data Formatting**: Each part card includes:
   - Part number
   - Title/description
   - Price
   - Availability status
   - Brand and type
   - Appliance compatibility
   - Rating and review count (when available)
   - Image URL
   - Installation video URL (when available)

### Hallucination Prevention

The system implements several techniques to reduce LLM hallucinations:

1. **Knowledge Grounding**: All responses are grounded in real part data from the PartSelect database
2. **Explicit Stock Status**: Inventory information is clearly formatted to prevent stock status confusion
3. **Part Number Extraction**: Uses regex patterns to detect and extract actual part numbers
4. **Domain Restriction**: The `isApplianceRelatedQuery()` function filters out irrelevant topics
5. **Specific Context Format**: Structured context helps the LLM focus on factual information
6. **Request Enrichment**: Contextual information about parts is provided with every query
7. **Enhanced Response Validation**: Extracts part numbers from LLM responses to include referenced parts

### Stock Status Handling

A key improvement in the system is accurate stock status reporting:

1. **Default to In Stock**: Parts are considered in stock unless explicitly marked otherwise
2. **Clear Inventory Reporting**: Stock status is formatted clearly in context
3. **Stock-Related Guidelines**: System prompt instructs the LLM to accurately report stock status
4. **Pre-processing**: Context includes a dedicated inventory information section

### Query Processing Pipeline

The complete flow for handling a user query:

1. **Request Validation**: Ensures required data is present
2. **Domain Check**: Verifies query is about refrigerators or dishwashers using `isApplianceRelatedQuery()`
3. **Part Number Detection**: Checks for part numbers in the query using regex
4. **Vector Search**: Retrieves relevant parts from the vector database
5. **Context Formatting**: Formats part information into structured context
6. **Conversation History**: Prepares conversation history for the LLM
7. **LLM Response Generation**: Sends query, context, and history to the DeepseekChat instance
8. **Part Filtering**: Selects the most relevant parts for display using `filterRelevantParts()`
9. **Additional Part Discovery**: Finds parts mentioned in the response but not in the initial results
10. **Response Formatting**: Formats the final response with LLM text and part information

### API Response Format

The chat API endpoint returns responses in this format:

```json
{
  "response": "Text response from the LLM",
  "parts": [
    {
      "partNumber": "PS11752778",
      "title": "Refrigerator Door Shelf Bin",
      "price": "$36.18",
      "inStock": true,
      "type": "Door shelf",
      "brand": "Whirlpool",
      "appliance": "refrigerator",
      "exactMatch": true,
      "rating": 4.85,
      "reviewCount": 308,
      "imageUrl": "https://www.partselect.com/assets/images/parts/PS11752778.jpg",
      "videoUrl": "https://www.partselect.com/Installation-Video-PS11752778.htm"
    },
    ...
  ],
  "shouldShowParts": true
}
```

### API Endpoints

- `POST /api/chat` - Main chat endpoint that accepts user messages and returns AI responses
- `POST /api/chat/vectorize` - Admin endpoint to trigger vectorization (protected by API key)
- `GET /api/chat/vectorize/status` - Check vectorization status

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