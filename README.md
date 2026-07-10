# Torlink UI

A modern, web-based interface for the Torlink CLI, providing a seamless terminal, search, and download management experience.

## ✨ Features

- 🖥️ **Interactive Terminal**: Full terminal experience powered by `node-pty`.
- 🔍 **Advanced Search**: Quickly find and interact with Torlink resources.
- 📂 **Download Management**: Manage your downloads via a clean web interface.
- 📜 **History Tracking**: View and manage your command history.
- ⚙️ **Settings**: Easy configuration of your environment.

## 🚀 Quick Start (Docker Hub)

The fastest way to run Torlink UI is with the published image:

`alith/torlinkui:latest`

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/)

### Option A: Docker Compose (Recommended)

1. Create a `docker-compose.yml` file:

   ```yaml
   services:
     torlinkui:
       image: alith/torlinkui:latest
       container_name: torlinkui
       ports:
         - "3000:3000"
       environment:
         - PORT=3000
         - DOWNLOAD_DIR=/root/Downloads/torlink
         - TORLINK_STATE_DIR=/root/state
       volumes:
         - ./downloads:/root/Downloads/torlink
         - ./state:/root/state
       restart: unless-stopped
   ```

2. Start the container:

   ```bash
   docker compose up -d
   ```

3. Open:

   `http://localhost:3000`

### Option B: Inline Docker Commands

Pull the latest image:

```bash
docker pull alith/torlinkui:latest
```

Run with defaults:

```bash
docker run -d --name torlinkui -p 3000:3000 alith/torlinkui:latest
```

Run with a mapped downloads folder:

```bash
docker run -d \
  --name torlinkui \
  -p 3000:3000 \
  -e PORT=3000 \
  -e DOWNLOAD_DIR=/root/Downloads/torlink \
  -v "$(pwd)/downloads:/root/Downloads/torlink" \
  alith/torlinkui:latest
```

### Docker Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | The port the web server runs on | `3000` |
| `DOWNLOAD_DIR` | Download directory used inside the container (map it with a volume) | `/root/Downloads/torlink` |
| `STATE_DIR` | Directory for persisting app state (config, queue, etc.) | `./state` |

#### 📂 Persistent Data Locations
When using `STATE_DIR` (defaulting to `./state`), the application organizes data into a subfolder structure. For containerized users, the `.torrent` metadata is stored in:

*   **Inside Container**: `/app/server/state/data/torrents/`
*   **On Host**: Depends on your volume mapping (e.g., if mapping `./state:/app/state`, it will be in `./state/data/torrents/`)


---

## 🛠️ Local Development

If you prefer to run the components locally:

### Backend (Server)

1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```

### Frontend (Web)

1. Navigate to the web directory:
   ```bash
   cd web
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 📂 Project Structure

```text
.
├── Dockerfile          # Multi-stage Docker build
├── docker-compose.yml  # Docker Compose orchestration
├── server/             # Node.js controller backend
├── web/                # React/Vite frontend
└── torlink/            # Core Torlink CLI (built during Docker build)
```

## ❤️ Credits

This project provides a web interface for the [torlink CLI](https://github.com/baairon/torlink) originally developed by [@baairon](https://github.com/baairon).

---
*Maintained by the Torlink Team.*
