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
│   └── refrigerator/       # Refrigerator-specific data
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
│   └── vectorUtils.js      # Vector embedding utilities
│
├── .env                # Environment variables (not in repo)
├── .env.example        # Example environment variables
├── cli.js              # Command-line interface for scraper
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

Available options:
- `--maxParts=<number>` - Set maximum parts per page to extract
- `--maxPages=<number>` - Set maximum pages per category to scrape
- `--delay=<milliseconds>` - Set delay between requests
- `--generateData` - Only regenerate consolidated data from existing parts
- `--fullScrape` - Run a full scrape with no limits (may take a long time)
- `--checkMissing` - Check for missing brands and part types in the data

## API Endpoints

- `POST /api/chat` - Chat endpoint that accepts user messages and returns AI responses

## Data Structure

The consolidated data file contains:

- Parts organized by part number
- Relationships between parts, brands, and appliance types
- Meta information about the dataset

## Environment Variables

Copy `.env.example` to `.env` and set:

- `PORT` - Server port (default: 5000)
- `DEEPSEEK_API_KEY` - Your Deepseek API key 

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