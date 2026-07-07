# --- Stage 1: Builder ---
FROM node:22 AS builder

# Install build dependencies for native modules (like node-pty)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Build torlink
WORKDIR /app/torlink
COPY torlink/package*.json ./
RUN npm install
COPY torlink/ .
RUN npm run build

# Build Web UI
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN npm run build

# Build Server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ .
# Bundle the server using esbuild as ESM to support top-level await and import.meta
# We use --packages=external to avoid bundling node_modules, which prevents "dynamic require" errors in ESM.
RUN npx esbuild index.js --bundle --platform=node --format=esm --outfile=dist/index.js --minify --packages=external

# Prune dev dependencies (but keep native modules like node-pty)
RUN npm prune --production

# --- Stage 2: Runner ---
FROM node:22-slim

# Set environment variables
ENV PORT=3000
ENV DOWNLOAD_DIR=/app/downloads
ENV NODE_ENV=production

WORKDIR /app

# Copy torlink artifacts (needed for the CLI)
COPY --from=builder /app/torlink/dist ./torlink/dist

# Copy web artifacts
COPY --from=builder /app/web/dist ./web/dist

# Copy server artifacts (the bundled index.js and pruned node_modules)
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/node_modules ./server/node_modules

# Create the download directory
RUN mkdir -p $DOWNLOAD_DIR

# Expose the port
EXPOSE 3000

# Run the bundled controller server
WORKDIR /app/server
CMD ["node", "dist/index.js"]