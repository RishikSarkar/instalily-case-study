const fs = require('fs');
const path = require('path');

function ensureDataDirectories() {
  const dirs = [
    path.join(__dirname, '../data'),
    path.join(__dirname, '../data/vectors'),
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

function saveJsonToFile(data, filePath) {
  try {
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${filePath}`);
  } catch (error) {
    console.error(`Error saving data to ${filePath}:`, error);
  }
}

function loadJsonFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`File does not exist: ${filePath}`);
      return null;
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error loading data from ${filePath}:`, error);
    return null;
  }
}

function appendJsonToFile(data, filePath) {
  try {
    let existingData = [];
    
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      existingData = JSON.parse(fileContent);
    }
    
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    
    if (Array.isArray(existingData)) {
      if (Array.isArray(data)) {
        existingData = [...existingData, ...data];
      } else {
        existingData.push(data);
      }
    } else {
      existingData = { ...existingData, ...data };
    }
    
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2));
    console.log(`Data appended to ${filePath}`);
  } catch (error) {
    console.error(`Error appending data to ${filePath}:`, error);
  }
}

module.exports = {
  ensureDataDirectories,
  saveJsonToFile,
  loadJsonFromFile,
  appendJsonToFile
}; 