/**
 * Main application component for the torlink web interface.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import type { DownloadItem, Config, State, View, Category } from './types';
import SearchView from './components/SearchView';
import SettingsView from './components/SettingsView';
import HistoryView from './components/HistoryView';
import DownloadsView from './components/DownloadsView';
import Terminal from './components/Terminal';

function App() {
  const [state, setState] = useState<State | null>(null);
  const [view, setView] = useState<View>('downloads');
  const [isTerminalMode, setIsTerminalMode] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const ws = useRef<WebSocket | null>(null);
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch initial state
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();

    // Connect WebSocket
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onmessage = (event) => {
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
    };

    socket.onerror = () => console.error('WebSocket error');
    socket.onclose = () => console.log('WebSocket closed');

    return () => {
      socket.close();
    };
  }, [fetchState, wsUrl]);

  const handleSearch = async (e: React.FormEvent | null = null, categoryOverride?: Category) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;
    
    const categoryToUse = categoryOverride ?? selectedCategory;

    if (q.startsWith('magnet:')) {
      try {
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: 'New Download', 
            magnet: q 
          }),
        });
        if (res.ok) {
          setQuery('');
          setView('downloads');
        } else {
          alert('Failed to add download. Check if it is a valid magnet.');
        }
      } catch (err) {
        alert('Error initiating download');
      }
    } else {
      // Text search via WebSocket for streaming
      setSearchResults([]);
      setIsSearching(true);
      setView('search');
      
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'search', query: q, category: categoryToUse }));
      } else {
        alert('WebSocket not connected. Cannot perform streaming search.');
        setIsSearching(false);
        setView('downloads');
      }
    }
  };

  const handleDownload = async (item: DownloadItem) => {
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: item.name, 
          magnet: item.magnet || item.torrentLink 
        }),
      });
      if (res.ok) {
        setQuery('');
        setView('downloads');
      } else {
        alert('Failed to add download');
      }
    } catch (err) {
      alert('Error initiating download');
    }
  };

  const handleControl = async (action: string, id: string) => {
    try {
      const res = await fetch('/api/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id }),
      });
      if (!res.ok) throw new Error('Failed to control item');
    } catch (err) {
      alert('Error performing action');
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all history?')) return;
    try {
      await fetch('/api/history/clear', { method: 'POST' });
    } catch (err) {
      alert('Error clearing history');
    }
  };

  const handleUpdateConfig = async (newConfig: Config) => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    } catch (err) {
      alert('Failed to update configuration');
    }
  };

  const handleCategoryChange = (category: Category) => {
    setSelectedCategory(category);
    if (query.trim()) {
      handleSearch(null, category);
    }
  };

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
          setView={setView}
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
      <aside className={`app-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <button className="toggle-sidebar" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            {isSidebarOpen ? '❮' : '❯'}
          </button>
        </div >
        <nav className="app-nav sidebar-nav">
          <button className={view === 'downloads' ? 'active' : ''} onClick={() => setView('downloads')}>
            <span className="nav-text">Downloads</span>
          </button>
          <button className={view === 'seeding' ? 'active' : ''} onClick={() => setView('seeding')}>
            <span className="nav-text">Seeding</span>
          </button>
          <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')}>
            <span className="nav-text">History</span>
          </button>
          <button className={view === 'search' ? 'active' : ''} onClick={() => setView('search')}>
            <span className="nav-text">Search</span>
          </button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>
            <span className="nav-text">Settings</span>
          </button>
        </nav>
      </aside>

      <div className="app-content">
        <header className="app-header">
          <div className="brand">torlink</div >
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
            <button type="submit">Search</button>
          </form>
        </footer >
      </div >
    </div >
  );
}

export default App;