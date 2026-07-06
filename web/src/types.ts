/**
 * Defines the core types and interfaces used throughout the torlink web application.
 */

export interface DownloadItem {
  id: string;
  name: string;
  magnet: string;
  torrentLink?: string;
  status: 'downloading' | 'paused' | 'failed' | 'seeding' | 'missing';
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: number;
  uploadSpeed?: number;
  peers?: number;
  eta?: number;
  error?: string;
}

export interface Config {
  downloadDir: string;
  trackers: string[];
}

export type Category = 'all' | 'games' | 'movies' | 'tv' | 'anime';

export type View = 'downloads' | 'seeding' | 'history' | 'settings' | 'search';

export interface State {
  config: Config;
  queue: DownloadItem[];
  history: any[];
  seeds: DownloadItem[];
}
