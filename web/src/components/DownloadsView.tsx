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
  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatSpeed = (bytesPerSec?: number) => {
    if (!bytesPerSec) return '0 MB/s';
    return (bytesPerSec / 1024 / 1024).toFixed(2) + ' MB/s';
  };

  const formatEta = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  };

  const PeerIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );

  return (
    <div className="list-container">
      <div className="list">
        {items.map((item) => (
          <div key={item.id} className="item-card">
            <div className="item-info">
              <div className="item-name">{item.name}</div>
              <div className="item-details">
                {item.status === 'downloading' ? (
                  <div className="item-container">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${item.progress}%` }} />
                      <div className="progress-text-overlay">{item.progress}%</div>
                    </div>
                    <div className="item-meta">
                      <span className="badge badge-downloading">{item.status}</span>
                      <span className="item-sep">•</span>
                      <span className="speed-text">{formatSpeed(item.speed)}</span>
                      <span className="item-sep">•</span>
                      <span className="size-text">{formatSize(item.sizeBytes)}</span>
                      <span className="item-sep">•</span>
                      <span className="progress-text">{item.progress}%</span>
                      <span className="item-sep">•</span>
                      <span className="peers-text">
                        <PeerIcon />
                        {item.peers} peers
                      </span>
                      {item.eta && (
                        <>
                          <span className="item-sep">•</span>
                          <span className="eta-text">ETA: {formatEta(item.eta)}</span>
                        </>
                      )}
                    </div>
                    <div className="item-downloaded dim">
                      {formatSize(item.downloadedBytes)} of {formatSize(item.totalBytes)}
                    </div>
                  </div>
                ) : item.status === 'seeding' ? (
                  <div className="item-meta">
                    <span className="badge badge-seeding">Seeding</span>
                    <span className="item-sep">•</span>
                    <span className="speed-text">{formatSpeed(item.uploadSpeed)}</span>
                    <span className="item-sep">•</span>
                    <span className="size-text">{formatSize(item.sizeBytes)}</span>
                    <span className="item-sep">•</span>
                    <span className="peers-text">
                      <PeerIcon />
                      {item.peers} peers
                    </span>
                  </div>
                ) : (
                  <div className="item-meta error">
                    <span className="badge badge-error">{item.status}</span>
                    <span className="item-sep">•</span>
                    <span>{item.error || item.status}</span>
                  </div>
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