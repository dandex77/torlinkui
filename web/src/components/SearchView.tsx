/**
 * Component for searching torrents via the search bar and displaying results.
 */
import React from 'react';
import type { View, Category } from '../types';

interface SearchViewProps {
  isSearching: boolean;
  searchResults: any[];
  setView: (view: View) => void;
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
  setView,
  handleDownload,
  selectedCategory,
  onCategoryChange
}) => {
  return (
    <div className="list-container" style={{ padding: '1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="list-header" style={{ marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <div className="list-header-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--accent-color, #00d2ff)', textShadow: '0 0 10px var(--accent-color, #00d2ff)' }}>Search Results</h3>
            <div className="category-filters" style={{ display: 'flex', gap: '0.5rem' }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  className={`btn-filter ${selectedCategory === cat.key ? 'active' : ''}`}
                  onClick={() => onCategoryChange(cat.key)}
                  style={{
                    padding: '4px 12px',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    backgroundColor: selectedCategory === cat.key ? 'rgba(0, 210, 255, 0.2)' : 'transparent',
                    color: selectedCategory === cat.key ? 'var(--accent-color, #00d2ff)' : 'rgba(255,255,255,0.5)',
                    border: selectedCategory === cat.key ? '1px solid var(--accent-color, #00d2ff)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '2px',
                    boxShadow: selectedCategory === cat.key ? '0 0 8px var(--accent-color, #00d2ff)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div >
          </div >
          <button className="btn-secondary" onClick={() => setView('downloads')} style={{ opacity: 0.7 }}>Back</button>
        </div >
      </div >

      {isSearching && searchResults.length === 0 ? (
        <div className="loading" style={{ textAlign: 'center', padding: '3rem' }}>Searching...</div >
      ) : searchResults.length === 0 ? (
        <div className="empty-state" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '1.2rem' }}>No data found in this sector.</p>
          <p className="dim">Scanning the network for matches...</p>
        </div >
      ) : (
        <div className="list" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '0.5rem' 
        }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '4fr 1fr 1fr 1fr 100px', 
            padding: '0.5rem 1.5rem', 
            color: 'rgba(255,255,255,0.4)', 
            fontSize: '0.7rem', 
            textTransform: 'uppercase', 
            letterSpacing: '1px',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <span>Manifest</span>
            <span style={{ textAlign: 'center' }}>Source</span>
            <span style={{ textAlign: 'center' }}>Peers</span>
            <span style={{ textAlign: 'center' }}>Size</span>
            <span style={{ textAlign: 'right' }}>Action</span>
          </div >

          {[...searchResults]
            .sort((a, b) => (b.seeders || 0) - (a.seeders || 0))
            .map((item: any) => {
              const sourceInfo = SOURCE_MAP[item.source] || { color: '#7f8c8d' };
              return (
                <div key={item.infoHash} className="item-row" style={{ 
                  display: 'grid',
                  gridTemplateColumns: '4fr 1fr 1fr 1fr 100px',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderLeft: `2px solid ${sourceInfo.color}`,
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  backdropFilter: 'blur(5px)',
                  transition: 'background 0.2s ease',
                }}>
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: '500', 
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.3'
                    }}>
                      {item.name}
                    </div >
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: sourceInfo.color,
                    fontSize: '0.8rem',
                    textTransform: 'uppercase',
                    fontWeight: 'bold'
                  }}>
                    <span>{item.source}</span>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
                    {item.seeders}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', textAlign: 'center' }}>
                    {item.sizeBytes ? (item.sizeBytes / 1024 / 1024 / 1024).toFixed(2) + ' GB' : '--'}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <button 
                      onClick={() => handleDownload(item)} 
                      className="btn-sm btn-success"
                      style={{ 
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        boxShadow: '0 0 8px rgba(46, 213, 117, 0.2)'
                      }}
                    >
                      Get
                    </button>
                  </div >
                </div >
              );
            })
          }
          {isSearching && (
            <div className="loading-small" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
              Updating data stream...
            </div>
          )}
        </div >
      )}
    </div >
  );
};

export default SearchView;