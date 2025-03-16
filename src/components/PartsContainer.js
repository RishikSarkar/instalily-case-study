import React, { useState } from 'react';
import PartCard from './PartCard';
import './PartCard.css'; // Reusing the styles from PartCard.css

/**
 * Component to display a list of parts
 */
function PartsContainer({ parts }) {
  const [showAllParts, setShowAllParts] = useState(false);
  
  if (!parts || parts.length === 0) {
    return null;
  }

  // Deduplicate exact matches by partNumber
  const uniqueParts = [];
  const addedPartNumbers = new Set();
  
  parts.forEach(part => {
    if (part.exactMatch) {
      // For exact matches, only add if the part number hasn't been seen
      if (!addedPartNumbers.has(part.partNumber)) {
        uniqueParts.push(part);
        addedPartNumbers.add(part.partNumber);
      }
    } else {
      // For non-exact matches, add them all
      uniqueParts.push(part);
    }
  });

  // Count exact matches
  const exactMatches = uniqueParts.filter(part => part.exactMatch).length;
  
  // If there are exact matches, prioritize them at the top
  uniqueParts.sort((a, b) => {
    // First by exactMatch (true comes before false)
    if (a.exactMatch !== b.exactMatch) {
      return a.exactMatch ? -1 : 1;
    }
    // Then by inStock (true comes before false)
    if (a.inStock !== b.inStock) {
      return a.inStock ? -1 : 1;
    }
    // Then alphabetically by title
    return a.title.localeCompare(b.title);
  });
  
  // Limit displayed parts to top 3 unless "Show All" is clicked
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