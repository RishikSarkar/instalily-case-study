# PartSelect Appliance Parts Search

This application provides a semantic search interface for finding refrigerator and dishwasher parts. It uses vector embeddings for intelligent search and a Deepseek LLM for natural language responses.

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Chat Agent Implementation](#chat-agent-implementation)
- [Technical Components](#technical-components)
- [Recent Enhancements](#recent-enhancements)
- [Installation and Setup](#installation-and-setup)
- [Available Scripts](#available-scripts)
- [Additional Resources](#additional-resources)

## Overview

The PartSelect Appliance Parts Search application helps users find refrigerator and dishwasher parts through:
- Natural language queries processed by an AI chat interface
- Semantic search capabilities for understanding part requirements
- Exact part number matching for direct lookups
- Comprehensive database covering 1000+ parts across 40+ brands

For detailed server implementation, including the scraper, vector search system, and API endpoints, see the [server README](./server/README.md).

## Features

- **Semantic Search**: Find parts based on natural language descriptions
- **Part Number Search**: Exact matching for part numbers in format PS12345678
- **Intelligent Chat Interface**: Get recommendations and installation advice
- **Comprehensive Parts Database**: 1000+ parts across 40+ brands
- **Part Cards Display**: Visual presentation of relevant parts based on conversation context
- **Installation Guidance**: Detailed steps for part replacement procedures

## System Architecture

- **Frontend**: React application with chat interface
- **Backend**: Node.js Express server with API endpoints
- **Vector Database**: HNSW vector index for semantic search
- **LLM Integration**: Deepseek AI for natural language processing
- **Data Storage**: Structured JSON format for parts, brands, and appliance information

## Chat Agent Implementation

The application features an AI-powered chat agent with several enhancements:

### Key Features

- **Accurate Stock Status**: Correctly reports in-stock/out-of-stock status for all parts
- **Part Number Detection**: Advanced regex patterns to extract and highlight part numbers
- **Intelligent Part Card Display**: Shows relevant parts based on conversation context
- **Context-Aware Responses**: Maintains conversation history for coherent multi-turn interactions
- **Installation Instructions**: Provides step-by-step installation guidance for parts
- **Hallucination Prevention**: Multiple techniques to ensure factual accuracy
- **Optimized Entity Detection**: High-performance Set-based lookups for brands and categories 
- **Exact-Match Prioritization**: Ensures users see the most relevant parts first
- **Deduplication System**: Prevents duplicate part cards from appearing in results

## Technical Components

- **Vector Search**: HNSW-based semantic search for finding relevant parts
- **LLM Integration**: Deepseek AI with carefully crafted system prompts
- **Structured Context**: Organized part information for improved response quality
- **Domain Filtering**: Restricts conversations to refrigerator and dishwasher topics
- **Enhanced Part Detection**: Identifies part numbers, brands, and part types in natural language
- **Set-Based Entity Lookup**: O(1) lookups for 40+ brands and 80+ part categories
- **Entity-Aware Query Enhancement**: Dynamically adjusts search queries with detected entities

## Recent Enhancements

### Improved Entity Detection

The system now features a sophisticated entity detection system that identifies:
- Part numbers in various formats 
- Model numbers with brand-specific pattern matching
- 40+ refrigerator and dishwasher brands
- 80+ part types across both appliance categories

The implementation uses Set-based lookups for O(1) time complexity and multi-stage detection for optimal performance.

### Enhanced Part Filtering

The part filtering system now prioritizes:
- Exact part number matches when detected in user queries
- Compatible parts based on model numbers
- Brand and part category combinations
- In-stock items over out-of-stock items

### Deduplication System

A new deduplication system prevents duplicate part cards from appearing in results, ensuring a cleaner user experience and more accurate part recommendations.

### Context Format Improvements

The context format for the LLM has been enhanced to:
- Prominently display stock status with explicit reporting instructions
- Provide clear part number reference guidance
- Format information consistently for better LLM understanding

### High-Performance Entity Detection

Now uses Set-based data structures for O(1) lookups instead of regex matching, resulting in faster query processing.

### Comprehensive Brand & Part Database

Added support for 40+ appliance brands and 80+ part categories with direct lookups.

### Improved Part Number Detection

Enhanced regex pattern matching to handle variations like "PS 12345678", "part number PS12345678", etc.

### Context-Driven Entity Detection

Added extraction of entities from conversation history for better context awareness.

### Exact Match Prioritization

When users mention specific part numbers, the system now prioritizes exact matches over semantic results.

### Enhanced Stock Status Reporting

Added explicit formatting and verification to ensure accurate stock status reporting.

### Duplicate Part Prevention

Implemented deduplication system to prevent identical parts from appearing multiple times in results.

## Installation and Setup

1. Clone the repository
2. Install dependencies with `npm install` in both root and server directories
3. Configure environment variables (see the [server README](./server/README.md) for details)
4. Run the development server with `npm start`
5. Access the application at http://localhost:3000

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Additional Resources

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
