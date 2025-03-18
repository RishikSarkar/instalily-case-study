import React, { useState } from 'react';
import PartCard from './PartCard';
import './PartCard.css'; // Reusing the styles from PartCard.css

// Parts list container
function PartsContainer({ parts }) {
  const [showAllParts, setShowAllParts] = useState(false);
  
  if (!parts || parts.length === 0) {
    return null;
  }

  // Remove duplicate exact matches
  const uniqueParts = [];
  const addedPartNumbers = new Set();
  
  parts.forEach(part => {
    if (part.exactMatch) {
      if (!addedPartNumbers.has(part.partNumber)) {
        uniqueParts.push(part);
        addedPartNumbers.add(part.partNumber);
      }
    } else {
      uniqueParts.push(part);
    }
  });

  const exactMatches = uniqueParts.filter(part => part.exactMatch).length;
  
  // Sort by exact match, stock status, then name
  uniqueParts.sort((a, b) => {
    if (a.exactMatch !== b.exactMatch) {
      return a.exactMatch ? -1 : 1;
    }
    if (a.inStock !== b.inStock) {
      return a.inStock ? -1 : 1;
    }
    return a.title.localeCompare(b.title);
  });
  
  // Show first 3 parts or all if expanded
  const displayedParts = showAllParts ? uniqueParts : uniqueParts.slice(0, 3);
  const hiddenPartsCount = uniqueParts.length - displayedParts.length;

  return (
    <div className="parts-container">
      <div className="parts-heading">
        Found {uniqueParts.length} relevant parts
        {exactMatches > 0 && ` (including ${exactMatches} exact ${exactMatches === 1 ? 'match' : 'matches'})`}
      </div>
      <div className="parts-list">
        {displayedParts.map((part, index) => (
          <PartCard key={`${part.partNumber}-${index}`} part={part} />
        ))}
      </div>
      {hiddenPartsCount > 0 && (
        <button 
          className="show-more-button" 
          onClick={() => setShowAllParts(true)}
        >
          Show {hiddenPartsCount} more parts
        </button>
      )}
      {showAllParts && uniqueParts.length > 3 && (
        <button 
          className="show-less-button" 
          onClick={() => setShowAllParts(false)}
        >
          Show fewer parts
        </button>
      )}
    </div>
  );
}

export default PartsContainer; 