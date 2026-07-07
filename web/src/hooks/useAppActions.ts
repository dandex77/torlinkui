/**
 * Hook to manage application actions and state updates.
 */
import { useCallback } from 'react';
import type { DownloadItem, Config, State, View, Category } from '../types';

interface UseAppActionsProps {
  setState: React.Dispatch<React.SetStateAction<State | null>>;
  setQuery: (query: string) => void;
  setView: (view: View) => void;
  setSearchResults: (results: any[]) => void;
  setIsSearching: (searching: boolean) => void;
  setSelectedCategory: (category: Category) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  isConnected: boolean;
  sendMessage: (data: any) => boolean;
  query: string;
  selectedCategory: Category;
}

export const useAppActions = ({
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
}: UseAppActionsProps) => {
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
  }, [setState, setError, setLoading]);

  const handleSearch = useCallback(async (e: React.FormEvent | null = null, categoryOverride?: Category) => {
    if (e) e.preventDefault();
    const q = query.trim();
    if (!q) return;

    window.scrollTo({ top: 0, behavior: 'smooth' });
    const categoryToUse = categoryOverride ?? selectedCategory;

    if (q.startsWith('magnet:')) {
      try {
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Download', magnet: q }),
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
      setSearchResults([]);
      setIsSearching(true);
      setView('search');
      
      if (isConnected) {
        sendMessage({ type: 'search', query: q, category: categoryToUse });
      } else {
        alert('WebSocket not connected. Cannot perform streaming search.');
        setIsSearching(false);
        setView('downloads');
      }
    }
  }, [isConnected, sendMessage, query, selectedCategory, setQuery, setView, setSearchResults, setIsSearching]);

  const handleDownload = useCallback(async (item: DownloadItem) => {
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item.name, magnet: item.magnet || item.torrentLink }),
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
  }, [setQuery, setView]);

  const handleControl = useCallback(async (action: string, id: string) => {
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
  }, []);

  const handleClearHistory = useCallback(async () => {
    if (!window.confirm('Clear all history?')) return;
    try {
      await fetch('/api/history/clear', { method: 'POST' });
    } catch (err) {
      alert('Error clearing history');
    }
  }, []);

  const handleUpdateConfig = useCallback(async (newConfig: Config) => {
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
    } catch (err) {
      alert('Failed to update configuration');
    }
  }, []);

  const handleCategoryChange = useCallback((category: Category) => {
    setSelectedCategory(category);
    if (query.trim()) {
      handleSearch(null, category);
    }
  }, [query, setSelectedCategory, handleSearch]);

  return {
    fetchState,
    handleSearch,
    handleDownload,
    handleControl,
    handleClearHistory,
    handleUpdateConfig,
    handleCategoryChange,
  };
};
