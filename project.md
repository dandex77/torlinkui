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
Create a `Dockerfile` in the root directory with the following logic:
```dockerfile
FROM node:22-slim

# Install ttyd and essential build tools
RUN apt-get update && apt-get install -y \
    ttyd \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first for better caching
COPY torlink/package*.json ./
RUN npm install

# Copy the rest of the application
COPY torlink/ .

# Build the application
RUN npm run build

# Expose the port used by ttyd
EXPOSE 7681

# Run ttyd to serve the torlink CLI
# -W allows write access (input)
# -p specifies the port
CMD ["ttyd", "-W", "-p", "7681", "node", "dist/cli.cjs"]
```

### Step 2: Create the `docker-compose.yml`
Create a `docker-compose.yml` file:
```yaml
services:
  torlink-web:
    build: .
    ports:
      - "7681:7681"
    restart: always
```

### Step 3: Verification
1.  **Build and Run**: `docker compose up --build`
2.  **Access**: Open `http://localhost:7681` in a browser.
3.  **Test**: 
    - Verify the TUI renders correctly.
    - Test keyboard input (e.g., pressing `?` for help).
    - Test search functionality.