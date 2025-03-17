# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

# PartSelect Appliance Parts Search

This application provides a semantic search interface for finding refrigerator and dishwasher parts. It uses vector embeddings for intelligent search and a Deepseek LLM for natural language responses.

## Features

- **Semantic Search**: Find parts based on natural language descriptions
- **Part Number Search**: Exact matching for part numbers in format PS12345678
- **Intelligent Chat Interface**: Get recommendations and installation advice
- **Comprehensive Parts Database**: 1000+ parts across 40+ brands

## Chat Agent Implementation

The application features an AI-powered chat agent with several enhancements:

### Key Features

- **Accurate Stock Status**: Correctly reports in-stock/out-of-stock status for all parts
- **Part Number Detection**: Advanced regex patterns to extract and highlight part numbers
- **Intelligent Part Card Display**: Shows relevant parts based on conversation context
- **Context-Aware Responses**: Maintains conversation history for coherent multi-turn interactions
- **Installation Instructions**: Provides step-by-step installation guidance for parts
- **Hallucination Prevention**: Multiple techniques to ensure factual accuracy

### Technical Components

- **Vector Search**: HNSW-based semantic search for finding relevant parts
- **LLM Integration**: Deepseek AI with carefully crafted system prompts
- **Structured Context**: Organized part information for improved response quality
- **Domain Filtering**: Restricts conversations to refrigerator and dishwasher topics
- **Enhanced Part Detection**: Identifies part numbers, brands, and part types in natural language

For detailed implementation information, see the [server README](./server/README.md#llm-and-chat-interface-implementation).

## System Architecture

- **Frontend**: React application with chat interface
- **Backend**: Node.js Express server with API endpoints
- **Vector Database**: HNSW vector index for semantic search
- **LLM Integration**: Deepseek AI for natural language processing

## Server Documentation

Detailed documentation about the server implementation, including the scraper, vector search system, and API endpoints, is available in the [server README](./server/README.md).

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

## Learn More

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
