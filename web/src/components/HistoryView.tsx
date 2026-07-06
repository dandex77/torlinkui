/**
 * Component for displaying the download history.
 */
import React from 'react';

interface HistoryViewProps {
  items: any[];
  handleClearHistory: () => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ items, handleClearHistory }) => {
  return (
    <div className="list-container">
      <div className="list-header">
        <h3>History</h3>
        <button className="btn-danger-sm" onClick={handleClearHistory}>Clear All</button>
      </div>
      {items.length === 0 ? <p className="empty">No history found.</p> : (
        <div className="list">
          {items.map((item: any) => (
            <div key={item.id} className="item-card">
              <div className="item-info">
                <div className="item-name">{item.name}</div>
                <div className="item-meta">Completed: {new Date(item.completedAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryView;