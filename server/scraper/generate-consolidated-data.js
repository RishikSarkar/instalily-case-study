// Standalone script to generate consolidated data from existing part files

const { consolidateData } = require('../utils/consolidateData');

console.log('Starting consolidated data generation process...');
console.log('This will read all existing part files and create a comprehensive');
console.log('consolidated-data.json file with relationship trees.');
console.log('--------------------------------------------------------------');

// Run the consolidation
consolidateData()
  .then(data => {
    if (data) {
      console.log('Consolidated data generation completed successfully!');
    } else {
      console.log('No data was generated - check for errors or empty part files.');
    }
  })
  .catch(error => {
    console.error('Error generating consolidated data:', error);
    process.exit(1);
  }); 