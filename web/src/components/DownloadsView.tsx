/**
 * Component for displaying the list of active downloads and seeds.
 */
import React from 'react';
import type { DownloadItem } from '../types';

interface DownloadsViewProps {
  items: DownloadItem[];
  handleControl: (action: string, id: string) => Promise<void>;
}

const DownloadsView: React.FC<DownloadsViewProps> = ({ items, handleControl }) => {
  return (
    <div className="list-container">
      <div className="list">
        {items.map((item) => (
          <div key={item.id} className="item-card">
            <div className="item-info">
              <div className="item-name">{item.name}</div>
              <div className="item-details">
                 {item.status === 'downloading' ? (
                   <>
                     <div className="progress-bar">
                       <div className="progress-fill" style={{ width: `${item.progress}%` }} />
                     </div>
                     <div className="item-meta">
                       <span>Downloading</span> • <span>{item.speed ? (item.speed / 1024 / 1024).toFixed(2) + ' MB/s' : '0 MB/s'}</span>
                       <span className="item-sep"> • 
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                        {item.peers} peers
                      </span>
                    </div>
                  </>
                 ) : item.status === 'seeding' ? (
                   <div className="item-meta">
                     <span>Seeding</span> • <span>{item.uploadSpeed ? (item.uploadSpeed / 1024 / 1024).toFixed(2) + ' MB/s' : '0'}</span>
                     <span className="item-sep">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      {item.peers} peers
                    </span>
                  </div>
                 ) : (
                   <div className="item-meta error">{item.error || item.status}</div>
                 )}
              </div>
            </div>
            <div className="item-actions">
              {item.status === 'downloading' && (
                <button onClick={() => handleControl('pause', item.id)} className="btn-sm">Pause</button>
              )}
              {item.status === 'paused' && (
                <button onClick={() => handleControl('resume', item.id)} className="btn-sm btn-success">Resume</button>
              )}
              {item.status === 'failed' && (
                <button onClick={() => handleControl('retry', item.id)} className="btn-sm btn-success">Retry</button>
              )}
              {item.status === 'seeding' && (
                <button onClick={() => handleControl('stopSeeding', item.id)} className="btn-sm btn-danger">Stop</button>
              )}
              <button onClick={() => handleControl('cancel', item.id)} className="btn-sm btn-danger">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DownloadsView;