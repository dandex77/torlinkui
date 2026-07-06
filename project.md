# Project Plan: Containerized Web-TUI for Torlink

## 1. Project Overview
The goal is to wrap the `torlink` terminal-based torrent finder into a Docker container that exposes a web-based interface. This allows users to interact with the terminal application through any modern web browser, effectively turning the TUI into a web app.

## 2. Technical Stack
- **Application**: `torlink` (Node.js, React, Ink)
- **Containerization**: Docker
- **Terminal-to-Web Bridge**: `ttyd` (Highly recommended for its ability to share a TTY over HTTP/WebSockets)
- **Orchestration**: Docker Compose (for easy management of the container)

## 3. Architecture
The container will run a process that combines the `ttyd` server and the `torlink` application. `ttyd` will act as the web server, capturing keyboard input from the browser and routing it to the application's `stdin`, while streaming `stdout/stderr` back to the browser's `xterm.js` terminal emulator.

**Data Flow:**
`User Browser` <-> `WebSockets` <-> `ttyd (inside Docker)` <-> `torlink (inside Docker)`

## 4. Implementation Roadmap

### Phase 1: Containerization
- [ ] Create a `Dockerfile` that:
    - Uses a `node:22-slim` base image.
    - Installs necessary build tools and `ttyd`.
    - Copies the source code.
    - Installs dependencies (`npm install`).
    - Builds the application (`npm run build`).
- [ ] Define the `ENTRYPOINT` or `CMD` to run `ttyd`.

### Phase 2: Terminal-to-Web Integration
- [ ] Configure `ttyd` to execute `node dist/cli.cjs`.
- [ ] Ensure the terminal settings (like alt-screen and cursor handling) are preserved by `ttyd`.
- [ ] Map the necessary ports (default for `ttyd` is 7681).

### Phase 3: Orchestration & Deployment
- [ ] Create a `docker-compose.yml` to simplify running the container.
- [ ] Define environment variables if needed (e.g., for custom download directories).

## 5. Detailed Implementation Instructions for Agents

### Step 1: Create the `Dockerfile`
Create a `Dockerfile` in the root directory. It uses environment variables to allow configuration of the port and the download directory.

```dockerfile
FROM node:22-slim

# Install build dependencies for native modules (like node-pty)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Phase 1: Build torlink ---
# Copy torlink package files
COPY torlink/package*.json ./torlink/
WORKDIR /app/torlink
# Install dependencies and build
RUN npm install
# Copy only the source files to avoid overwriting node_modules with host versions
COPY torlink/src ./src
COPY torlink/tsconfig.json ./
COPY torlink/tsup.config.ts ./
COPY torlink/scripts ./scripts
RUN npm run build

# --- Phase 2: Build Web UI ---
WORKDIR /app/web
# Copy web package files
COPY web/package*.json ./
# Install dependencies
RUN npm install
# Copy web source code
COPY web/ .
# Build the frontend
RUN npm run build

# --- Phase 3: Setup Server ---
WORKDIR /app/server
# Copy server package files
COPY server/package*.json ./
# Install dependencies (includes node-pty which uses the build tools installed above)
RUN npm install
# Copy server source code
COPY server/ .

# Default environment variables
ENV PORT=3000
ENV DOWNLOAD_DIR=/app/downloads

# Expose the port used by the controller server
EXPOSE 3000

# Create the download directory
RUN mkdir -p $DOWNLOAD_DIR

# Run the controller server
# Using shell form to allow environment variable expansion
CMD npx tsx index.js
```

### Step 2: Create the `docker-compose.yml`
Create a `docker-compose.yml` file. This configuration uses environment variables for the port and download directory, allowing for easy customization.

```yaml
version: '3.8'

services:
  torlink-web:
    build: .
    image: torlink-web
    ports:
      - "${PORT:-3000}:${PORT:-3000}"
    environment:
      - PORT=${PORT:-3000}
      - DOWNLOAD_DIR=${DOWNLOAD_DIR:-/app/downloads}
    volumes:
      - ${DOWNLOAD_DIR:-/app/downloads}:/app/downloads
    restart: always
```

### Step 3: Verification
1.  **Build and Run**: `docker compose up --build`
2.  **Access**: Open `http://localhost:7681` in a browser.
3.  **Test**: 
    - Verify the TUI renders correctly.
    - Test keyboard input (e.g., pressing `?` for help).
    - Test search functionality.