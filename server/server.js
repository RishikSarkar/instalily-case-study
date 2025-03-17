require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  // Allow requests from localhost during development and Vercel in production
  origin: ['http://localhost:3000', 'https://instalily-case-study.vercel.app'],
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Add health endpoint for Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../build')));

// API Routes
app.use('/api/chat', require('./routes/chat'));

// Catch-all route to serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
