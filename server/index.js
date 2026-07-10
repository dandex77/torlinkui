import express from 'express';
import { WebSocketServer } from 'ws';

import path from 'path';
import pty from 'node-pty';
import { fileURLToPath } from 'url';
import { DownloadQueue } from '../torlink/src/download/queue.js';
import { loadConfig, saveConfig } from '../torlink/src/config/config.js';
import { loadQueue, loadSeeds, torrentMetaExists, torrentMetaPath } from '../torlink/src/download/persist.js';
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
const distPath = path.resolve(__dirname, '../../web/dist');
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
   console.log(`[Init] Reconciled ${reconciled.length} items from queue.`);
   
   // Update item magnet/source to use metadata if available for easier resumption
   for (const item of reconciled) {
     const metaExists = torrentMetaExists(item.id);
     if (metaExists) {
       item.magnet = torrentMetaPath(item.id);
     }
   }

   q.restore(reconciled);

   // Log restoration details
   for (const item of reconciled) {
     console.log(`[Init] Restored item: ${item.name} (${item.id}) - Status: ${item.status}`);
   }
  history = await loadHistory();
  seeds = await loadSeeds();
  queue = q;
}

// Create the WebSocket server
const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

// Configuration for PTY
const ptyConfig = {
  ptyPath: path.resolve(__dirname, '..', '..', 'torlink', 'dist', 'cli.cjs'),
  torlinkDir: path.resolve(__dirname, '..', '..', 'torlink'),
  patchScript: path.resolve(path.resolve(__dirname, '..', '..', 'torlink'), 'patch-stdin.cjs'),
  command: '',
};
ptyConfig.command = `node -r ${ptyConfig.patchScript} ${ptyConfig.ptyPath}`;

function startPty() {
  if (ptyProcess) return;

  console.log(`[PTY] Starting PTY with patch-stdin: ${ptyConfig.patchScript}`);
  console.log(`[PTY] Target TUI path: ${ptyConfig.ptyPath}`);
  console.log(`[PTY] CWD: ${ptyConfig.torlinkDir}`);
  console.log(`[PTY] Executing command: ${ptyConfig.command}`);

   ptyProcess = pty.spawn('bash', ['-c', ptyConfig.command], {
     name: 'torlink-cli',
     cols: 80,
     rows: 24,
     cwd: ptyConfig.torlinkDir,
     env: { 
       ...process.env, 
       TERM: 'xterm-256color'
     }
   });

    ptyProcess.on('data', (data) => {
      // Broadcast PTY output to all connected clients
      // Convert Buffer to string to avoid massive JSON expansion
      const dataString = data.toString();
      for (const client of clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: 'data', data: dataString }));
        }
      }
    });

   ptyProcess.on('exit', (code, signal) => {
    console.log(`[PTY] Process exited. Code: ${code}, Signal: ${signal}`);
    ptyProcess = null;
    // Automatically restart PTY after a short delay to allow for recovery
    setTimeout(startPty, 1000);
  });

  ptyProcess.on('error', (err) => {
    if (err.code === 'EIO') {
      // EIO is expected when the PTY process exits
      ptyProcess = null;
      return;
    }
    console.error('[PTY] Process error:', err);
    ptyProcess = null;
  });
}

// Start PTY process
startPty();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Web client connected');
  ws.on('close', () => clients.delete(ws));
  
  ws.on('message', async (data) => {
      try {
        const dataString = data.toString();
        let message;
        
        try {
          message = JSON.parse(dataString);
        } catch (e) {
          // If parsing fails, it's likely raw terminal data
          message = { type: 'raw', data: dataString };
        }

        // If it's a valid JSON but doesn't have a type, treat it as raw data
        if (typeof message === 'object' && message !== null && !message.type) {
          message = { type: 'raw', data: dataString };
        }
        
        if (message && message.type === 'search') {
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
          console.log('Writing raw data to PTY:', message.data);
          ptyProcess.write(message.data);
        }
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });
});

// Helper to broadcast state updates
let lastBroadcast = 0;
const BROADCAST_THROTTLE_MS = 500; // Throttle to avoid excessive updates
let lastState = { queue: new Map(), seeds: new Map(), history: [] };

function broadcastUpdate() {
  if (!queue || !config) return;
  const now = Date.now();
  if (now - lastBroadcast < BROADCAST_THROTTLE_MS) return;
  lastBroadcast = now;

  const currentQueue = queue.getItems();
  const currentSeeds = queue.getSeeds();
  const currentHistory = history;

  // 1. Check for item updates in the queue
  const queueUpdates = [];
  for (const item of currentQueue) {
    const prev = lastState.queue.get(item.id);
    if (!prev || 
        prev.progress !== item.progress || 
        prev.speed !== item.speed || 
        prev.peers !== item.peers || 
        prev.status !== item.status ||
        prev.downloadedBytes !== item.downloadedBytes ||
        prev.eta !== item.eta) {
      queueUpdates.push({ id: item.id, ...item });
    }
  }

  // 2. Check for item updates in seeds
  const seedUpdates = [];
  for (const seed of currentSeeds) {
    const prev = lastState.seeds.get(seed.id);
    if (!prev || 
        prev.uploadSpeed !== seed.uploadSpeed || 
        prev.uploaded !== seed.uploaded || 
        prev.peers !== seed.peers || 
        prev.status !== seed.status) {
      seedUpdates.push({ id: seed.id, ...seed });
    }
  }

  // Check for structural changes
  const queueLenChanged = currentQueue.length !== (lastState.queue.size);
  const seedsLenChanged = currentSeeds.length !== (lastState.seeds.size);
  
  // Improved history comparison: check length and last item content
  let historyChanged = false;
  if (currentHistory.length !== lastState.history.length) {
    historyChanged = true;
  } else if (currentHistory.length > 0 && 
             (currentHistory[currentHistory.length - 1].id !== lastState.history[lastState.history.length - 1].id ||
              currentHistory[currentHistory.length - 1].status !== lastState.history[lastState.history.length - 1].status)) {
    historyChanged = true;
  }

  if (queueLenChanged || seedsLenChanged || historyChanged) {
    const payload = JSON.stringify({
      type: 'update',
      data: { config, queue: currentQueue, history: currentHistory, seeds: currentSeeds }
    });
    for (const client of clients) {
      if (client.readyState === 1) client.send(payload);
    }
  } else if (queueUpdates.length > 0 || seedUpdates.length > 0) {
    // Send granular updates in a single message if possible
    const deltaData = {};
    if (queueUpdates.length > 0) deltaData.queue = queueUpdates;
    if (seedUpdates.length > 0) deltaData.seeds = seedUpdates;
    
    const payload = JSON.stringify({ type: 'item_update', data: deltaData });
    for (const client of clients) {
      if (client.readyState === 1) client.send(payload);
    }
  }

  // Update local cache
  // We must store clones of the items to ensure the comparison in the next broadcast
  // compares the current values against the values from the previous broadcast,
  // rather than comparing an object to itself.
  lastState = {
    queue: new Map(currentQueue.map(i => [i.id, JSON.parse(JSON.stringify(i))])),
    seeds: new Map(currentSeeds.map(i => [i.id, JSON.parse(JSON.stringify(i))])),
    history: JSON.parse(JSON.stringify(currentHistory))
  };
}

// Initialize the queue event listener
async function setupQueueListener() {
  if (queue) {
    queue.on('update', async () => {
      history = await loadHistory();
      seeds = queue.getSeeds();
      broadcastUpdate();
    });
    queue.on('completed', (name) => {
        console.log(`Download completed: ${name}`);
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
function shutdown() {
  console.log('Shutting down...');
  if (queue) {
    queue.persistSync();
    queue.suspend();
  }
  if (ptyProcess) {
    ptyProcess.kill();
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGQUIT', shutdown);
