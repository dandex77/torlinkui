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

# Expose the port used by the controller server
EXPOSE 3000

# Run the controller server
CMD ["npx", "tsx", "index.js"]
