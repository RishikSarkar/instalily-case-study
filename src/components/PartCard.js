import React from 'react';
import './PartCard.css';

// Single part card component
function PartCard({ part }) {
  const { 
    partNumber, 
    title, 
    price = '0.00', 
    inStock, 
    type, 
    brand, 
    appliance, 
    exactMatch,
    rating,
    reviewCount,
    videoUrl
  } = part;

  // Fix price formatting
  const formattedPrice = typeof price === 'string' && price.startsWith('$') 
    ? price 
    : `$${price}`;
  
  // Build product page URL
  const productUrl = `https://www.partselect.com/${partNumber}-${brand || 'Appliance'}-${title.replace(/[^a-zA-Z0-9]/g, '-')}.htm`;

  return (
    <div className={`part-card ${exactMatch ? 'exact-match' : ''}`}>
      {exactMatch && <div className="exact-match-badge">Exact Match</div>}
      <div className="part-header">
        <div className="part-icon">
          <span className="material-icons">
            {type?.toLowerCase().includes('filter') ? 'filter_alt' : 
             type?.toLowerCase().includes('door') ? 'door_front' :
             type?.toLowerCase().includes('shelf') ? 'shelf' :
             appliance?.toLowerCase().includes('refrigerator') ? 'kitchen' :
             appliance?.toLowerCase().includes('dishwasher') ? 'countertops' :
             'hardware'}
          </span>
        </div>
        <div className="part-title-section">
          <div className="part-title">{title}</div>
          {(rating !== undefined && rating > 0) && (
            <div className="part-rating">
              <div className="stars" style={{ '--rating': rating }}></div>
              <span className="review-count">({reviewCount || 0} reviews)</span>
            </div>
          )}
        </div>
      </div>

      <div className="part-details">
        <div className="part-info">
          <span className="part-label">Part #:</span> 
          <span className="part-value">{partNumber}</span>
        </div>
        <div className="part-info">
          <span className="part-label">Price:</span> 
          <span className="part-value">{formattedPrice}</span>
        </div>
        <div className="part-info">
          <span className="part-label">Status:</span> 
          <span className={`part-value ${inStock ? 'in-stock' : 'out-of-stock'}`}>
            {inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>
        {type && (
          <div className="part-info">
            <span className="part-label">Type:</span> 
            <span className="part-value">{type}</span>
          </div>
        )}
        {brand && (
          <div className="part-info">
            <span className="part-label">Brand:</span> 
            <span className="part-value">{brand}</span>
          </div>
        )}
        {appliance && (
          <div className="part-info">
            <span className="part-label">For:</span> 
            <span className="part-value">{appliance}</span>
          </div>
        )}
      </div>
      
      {videoUrl && (
        <div className="video-link">
          <a 
            href={videoUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="video-button"
          >
            Watch Installation Video
          </a>
        </div>
      )}
      
      <a 
        href={productUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="view-details-button"
      >
        View Details
      </a>
    </div>
  );
}

export default PartCard; 