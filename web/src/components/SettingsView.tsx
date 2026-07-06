/**
 * Component for managing application settings.
 */
import React from 'react';
import type { Config, View } from '../types';

interface SettingsViewProps {
  config: Config;
  updateConfig: (newConfig: Config) => Promise<void>;
  setView: (view: View) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  updateConfig,
  setView
}) => {
  return (
    <div className="settings-pane">
      <h3>Settings</h3>
      <div className="setting-item">
        <label>Download Directory:</label>
        <input 
          type="text" 
          value={config.downloadDir} 
          readOnly 
        />
      </div>
      <div className="setting-item">
        <label>Trackers (comma separated):</label>
        <textarea 
          value={config.trackers.join(', ')} 
          onChange={(e) => {
            const newTrackers = e.target.value.split(',').map(t => t.trim()).filter(t => t !== '');
            updateConfig({ ...config, trackers: newTrackers });
          }} 
        />
      </div>
      <button className="btn-secondary" onClick={() => setView('downloads')}>Back</button>
    </div>
  );
};

export default SettingsView;