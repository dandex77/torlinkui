/**
 * Main application component for the torlink web interface.
 */
import { useState, useEffect, useCallback } from 'react';
import './App.css';
import type { DownloadItem, State, View, Category } from './types';
import SearchView from './components/SearchView';
import SettingsView from './components/SettingsView';
import HistoryView from './components/HistoryView';
import DownloadsView from './components/DownloadsView';
import Terminal from './components/Terminal';
import Sidebar from './components/Sidebar';
import { useWebSocket } from './hooks/useWebSocket';
import { useAppActions } from './hooks/useAppActions';

function App() {
  const [state, setState] = useState<State | null>(null);
  const [view, setView] = useState<View>('downloads');
  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const wsUrl = import.meta.env.VITE_WS_URL || (() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  })();

  const handleWebSocketMessage = useCallback((event: MessageEvent) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'update') {
      setState(prev => prev ? { ...prev, ...msg.data } : msg.data);
    } else if (msg.type === 'search_start') {
      setIsSearching(true);
      setSearchResults([]);
    } else if (msg.type === 'search_result') {
      setSearchResults(prev => [...prev, ...msg.results]);
    } else if (msg.type === 'search_end') {
      setIsSearching(false);
    }
  }, [setState, setIsSearching, setSearchResults]);

  const { readyState, sendMessage } = useWebSocket({
    url: wsUrl,
    onMessage: handleWebSocketMessage,
    onClose: useCallback(() => console.log('WebSocket closed'), []),
    onError: useCallback((err: Event) => console.error('WebSocket error', err), []),
  });

  const isConnected = readyState === WebSocket.OPEN;

  const {
    fetchState,
    handleSearch,
    handleDownload,
    handleControl,
    handleClearHistory,
    handleUpdateConfig,
    handleCategoryChange,
  } = useAppActions({
    setState,
    setQuery,
    setView,
    setSearchResults,
    setIsSearching,
    setSelectedCategory,
    setLoading,
    setError,
    isConnected,
    sendMessage,
    query,
    selectedCategory,
  });

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  if (loading) return <div className="loading">Loading torlink...</div>;
  if (error && !state) return <div className="error">{error} <button onClick={fetchState}>Retry</button></div>;
  if (!state) return <div className="error">Initializing state...</div>;

  const renderContent = () => {
    let items: DownloadItem[] = [];
    if (view === 'downloads') items = state.queue;
    else if (view === 'seeding') items = state.seeds;
    else if (view === 'history') items = state.history;

    if (view === 'search') {
      return (
        <SearchView 
          isSearching={isSearching}
          searchResults={searchResults}
          handleDownload={handleDownload}
          selectedCategory={selectedCategory}
          onCategoryChange={handleCategoryChange}
        />
      );
    }

    if (view === 'settings') {
      return (
        <SettingsView 
          config={state.config}
          updateConfig={handleUpdateConfig}
          setView={setView}
        />
      );
    }

    if (view === 'history') {
      return (
        <HistoryView 
          items={state.history}
          handleClearHistory={handleClearHistory}
        />
      );
    }

    return (
      <DownloadsView 
        items={items}
        handleControl={handleControl}
      />
    );
  };

  return (
    <div className="app-container">
      <Sidebar 
        isSidebarOpen={isSidebarOpen} 
        setIsSidebarOpen={setIsSidebarOpen} 
        view={view} 
        setView={setView} 
      />

      <div className="app-content">
        <header className="app-header">
          <div className="brand">Torlink UI</div>
          <button 
            className={`mode-toggle ${isTerminalMode ? 'terminal' : 'mobile'}`}
            onClick={() => setIsTerminalMode(!isTerminalMode)}
          >
            {isTerminalMode ? '📱 Mobile UI' : '🖥️ Terminal UI'}
          </button>
        </header>

        <main className="app-main">
          {isTerminalMode ? <Terminal url={wsUrl} /> : renderContent()}
        </main>

        <footer className="app-footer">
          <form onSubmit={handleSearch} className="search-form footer-search">
            <input 
              type="text" 
              placeholder="Magnet or Torrent link..." 
              value={query} 
              onChange={(e) => setQuery(e.target.value)}
            />
            <button 
              type="submit" 
              disabled={readyState !== WebSocket.OPEN}
              style={readyState !== WebSocket.OPEN ? { backgroundColor: '#7f8c8d', cursor: 'not-allowed' } : {}}
            >
              {readyState === WebSocket.CONNECTING ? 'Connecting...' : 'Search'}
            </button>
          </form>
        </footer>
      </div>
    </div>
  );
}

export default App;