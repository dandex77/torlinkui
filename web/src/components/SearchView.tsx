/**
 * Component for searching torrents via the search bar and displaying results.
 */
import React from 'react';
import type { Category } from '../types';
import './SearchView.css';

interface SearchViewProps {
  isSearching: boolean;
  searchResults: any[];
  handleDownload: (item: any) => Promise<void>;
  selectedCategory: Category;
  onCategoryChange: (category: Category) => void;
}

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'games', label: 'Games' },
  { key: 'movies', label: 'Movies' },
  { key: 'tv', label: 'TV' },
  { key: 'anime', label: 'Anime' },
];

const SOURCE_MAP: Record<string, { color: string }> = {
  'fitgirl': { color: '#ff4757' },
  'yts': { color: '#ffa502' },
  'tpb-movies': { color: '#2ed573' },
  'x1337-movies': { color: '#1e90ff' },
  'eztv': { color: '#ff6b81' },
  'tpb-tv': { color: '#3742fa' },
  'x1337-tv': { color: '#ff4757' },
  'nyaa': { color: '#2f3542' },
  'subsplease': { color: '#ffa502' },
};

const SearchView: React.FC<SearchViewProps> = ({
  isSearching,
  searchResults,
  handleDownload,
  selectedCategory,
  onCategoryChange
}) => {
  return (
    <div className="list-container">
      <div className="list-header search-header-container">
        <div className="search-header-content">
           <div className="search-header-title-group">
             <h3 className="search-results-title">Search Results</h3>
             <div className="category-filters">
               {CATEGORIES.map((cat) => (
                 <button
                   key={cat.key}
                   className={`btn-filter ${selectedCategory === cat.key ? 'active' : ''}`}
                   onClick={() => onCategoryChange(cat.key)}
                 >
                   {cat.label}
                 </button>
               ))}
             </div>
           </div>
         </div>
       </div>

      {isSearching && searchResults.length === 0 ? (
        <div className="loading">Searching...</div>
      ) : searchResults.length === 0 ? (
        <div className="empty-state">
          <p className="search-empty-text">No data found in this sector.</p>
          <p className="dim">Scanning the network for matches...</p>
        </div>
      ) : (
        <div className="list">
          <div className="search-header-row">
            <span className="header-manifest">Manifest</span>
            <span className="header-details">Details</span>
            <span className="header-action">Action</span>
          </div>

          {[...searchResults]
            .sort((a, b) => (b.seeders || 0) - (a.seeders || 0))
            .map((item: any) => {
              const sourceInfo = SOURCE_MAP[item.source] || { color: '#7f8c8d' };
              return (
                <div key={item.infoHash} className="item-row" style={{ 
                  borderLeft: `2px solid ${sourceInfo.color}`
                }}>
                  <div className="item-name-container">
                    <div className="item-name-text">
                      {item.name}
                    </div>
                  </div>

                  <div className="item-details-wrapper">
                    <span className="item-source" style={{ color: sourceInfo.color }}>{item.source}</span>
                    <span className="item-sep">•</span>
                    <span className="item-peers">{item.seeders}</span>
                    <span className="item-sep">•</span>
                    <span className="item-size">{item.sizeBytes ? (item.sizeBytes / 1024 / 1024 / 1024).toFixed(2) + ' GB' : '--'}</span>
                  </div>

                  <div className="item-action-container">
                    <button 
                      onClick={() => handleDownload(item)} 
                      className="btn-sm btn-success"
                    >
                      Get
                    </button>
                  </div>
                </div>
              );
            })
          }
          {isSearching && (
            <div className="loading-small">
              Updating data stream...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchView;