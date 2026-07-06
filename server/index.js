import express from 'express';
import { WebSocketServer } from 'ws';
import path from 'path';
import pty from 'node-pty';
import { fileURLToPath } from 'url';
import { DownloadQueue } from '../torlink/src/download/queue.js';
import { loadConfig, saveConfig } from '../torlink/src/config/config.js';
import { loadQueue, loadSeeds } from '../torlink/src/download/persist.js';
import { loadHistory } from '../torlink/src/download/history.js';
import { reconcileQueue } from '../torlink/src/download/reconcile.js';
import { normalizeDownloadDir } from '../torlink/src/config/folder.js';
import { SOURCES } from '../torlink/src/sources/registry.js';
import { cachedSearch } from '../torlink/src/sources/cache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
const port = process.env.PORT || 3000;

// Serve static files from the Vite build directory
const distPath = path.resolve(__dirname, '../web/dist');
app.use(express.static(distPath));

// Global State
let queue = null;
let config = null;
let history = [];
let seeds = [];
let ptyProcess = null;

// Load initial state
async function initState() {
  config = await loadConfig();
  const q = new DownloadQueue();
  if (config && config.trackers) {
    q.setTrackers(config.trackers);
  }
  const reconciled = reconcileQueue(await loadQueue());
  q.restore(reconciled);
  history = await loadHistory();
  seeds = await loadSeeds();
  queue = q;
}

// Create the WebSocket server
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

// Start PTY process
const ptyPath = path.resolve(__dirname, '..', 'torlink', 'dist', 'cli.cjs');
const torlinkDir = path.resolve(__dirname, '..', 'torlink');

ptyProcess = pty.spawn('node', [ptyPath], {
  name: 'torlink-cli',
  cols: 80,
  rows: 24,
  cwd: torlinkDir,
  env: { ...process.env, TERM: 'xterm-256color' }
});

ptyProcess.onData((data) => {
  // Broadcast PTY output to all connected clients
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: 'data', data }));
    }
  }
});

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Web client connected');
  ws.on('close', () => clients.delete(ws));
  
  ws.on('message', async (data) => {
    try {
      // Try parsing as JSON first
      const dataString = data.toString();
      let message;
      
      try {
        message = JSON.parse(dataString);
      } catch (e) {
        // If parsing fails, it's likely raw terminal data from XTerm
        message = { type: 'raw', data: dataString };
      }
      
      if (message.type === 'search') {
        const { query, category } = message;
        if (!query) return;

        // Initialize search state for this client
        const searchId = Math.random().toString(36).substring(7);
        
        // We'll send a notification that search has started
        ws.send(JSON.stringify({ type: 'search_start', searchId }));

        // Filter sources based on the selected category
        const sourcesToSearch = category === 'all' 
          ? SOURCES 
          : SOURCES.filter(s => s.group?.toLowerCase() === category.toLowerCase());

        // Run searches concurrently and push results as they come
        const searchPromises = sourcesToSearch.map(async (source) => {
          try {
            const results = await cachedSearch(source, query);
            if (results.length > 0) {
              ws.send(JSON.stringify({ 
                type: 'search_result', 
                searchId, 
                results 
              }));
            }
          } catch (e) {
            console.error(`Error searching ${source.id}:`, e);
          }
        });

        // Wait for all to finish to send end signal
        await Promise.all(searchPromises);
        ws.send(JSON.stringify({ type: 'search_end', searchId }));
      } else if (message.type === 'resize') {
        if (ptyProcess) {
          ptyProcess.resize(message.cols, message.rows);
        }
      } else if (message.type === 'raw') {
        if (ptyProcess) {
          ptyProcess.write(message.data);
        }
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });
});

// Helper to broadcast state updates
function broadcastUpdate() {
  if (!queue || !config) return;
  const payload = JSON.stringify({
    type: 'update',
    data: {
      config,
      queue: queue.getItems(),
      history,
      seeds: queue.getSeeds(),
    }
  });
  for (const client of clients) {
    if (client.readyState === 1) client.send(payload);
  }
}

// Initialize the queue event listener
async function setupQueueListener() {
  if (queue) {
    queue.on('update', async () => {
      // On update, we refresh our local history/seeds from the queue to keep them in sync
      // since the queue is the source of truth.
      history = await loadHistory(); // Simplest way to stay in sync for this exercise
      seeds = queue.getSeeds();
      broadcastUpdate();
    });
    queue.on('completed', (name) => {
        console.log(`Download completed: ${name}`);
        // Note: history and seeds are updated by 'update' event
    });
  }
}

// API Endpoints

// Helper for deduplication and ordering (replicated from TUI logic)
function processSearchResults(list) {
  const byHash = new Map();
  for (const r of list) {
    const existing = byHash.get(r.infoHash);
    if (!existing || r.seeders > existing.seeders) byHash.set(r.infoHash, r);
  }
  return [...byHash.values()].sort((a, b) => {
    if (b.seeders !== a.seeders) return b.seeders - a.seeders;
    return (b.added ?? 0) - (a.added ?? 0);
  });
}

app.get('/api/state', (req, res) => {
  if (!queue || !config) return res.status(500).json({ error: 'Not initialized' });
  res.json({
    config,
    queue: queue.getItems(),
    history,
    seeds: queue.getSeeds(),
  });
});

app.post('/api/download', async (req, res) => {
  const { id, name, magnet, source, sizeBytes, dir } = req.body;
  if (!queue || !config) return res.status(500).json({ error: 'Not initialized' });
  
  const downloadDir = dir || config.downloadDir;
  queue.add({ id, name, magnet, source, sizeBytes }, downloadDir);
  
  res.json({ success: true });
});

app.post('/api/control', (req, res) => {
  const { action, id } = req.body;
  if (!queue) return res.status(500).json({ error: 'Not initialized' });

  switch (action) {
    case 'pause': queue.pause(id); break;
    case 'resume': queue.resume(id); break;
    case 'togglePause': queue.togglePause(id); break;
    case 'cancel': queue.cancel(id); break;
    case 'retry': queue.retry(id); break;
    case 'retryFailed': queue.retryFailed(); break;
    default: return res.status(400).json({ error: 'Invalid action' });
  }
  res.json({ success: true });
});

app.post('/api/config', async (req, res) => {
  const newConfig = req.body;
  if (!config) return res.status(500).json({ error: 'Not initialized' });
  
  // We'll use the logic from App.tsx to update config.
  // In a real app, we'd verify the schema.
  config = newConfig;
  queue?.setTrackers(config.trackers);
  await saveConfig(config);
  
  res.json({ success: true });
});

app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    const results = await Promise.all(
      SOURCES.map(async (source) => {
        try {
          return await cachedSearch(source, query);
        } catch (e) {
          console.error(`Error searching ${source.id}:`, e);
          return [];
        }
      })
    );
    const flattened = results.flat();
    res.json({ success: true, results: processSearchResults(flattened) });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.post('/api/history/clear', async (req, res) => {
    if (!queue) return res.status(500).json({ error: 'Not initialized' });
    queue.clearHistory();
    history = []; // Reset local cache
    res.json({ success: true });
});

// Start Server
const server = app.listen(port, async () => {
  console.log(`Controller server listening on port ${port}`);
  await initState();
  await setupQueueListener();
});

// Handle WebSocket server upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Error handling
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (queue) {
    queue.persistSync();
    queue.suspend();
  }
  if (ptyProcess) {
    ptyProcess.kill();
  }
  process.exit();
});
