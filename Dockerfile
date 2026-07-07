# --- Stage 1: Builder ---
FROM node:26-slim AS builder

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
# Copy the extra scripts and patch script from the root to the torlink directory in the container
COPY patch-stdin.cjs /app/torlink/
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

# --- Stage 2: Runner ---
FROM node:26-slim

# Set environment variables
ENV PORT=3000
ENV DOWNLOAD_DIR=/app/downloads
ENV NODE_ENV=production

WORKDIR /app

# Install runtime dependencies for native modules (like node-pty)
# We include build-essential, ncurses libraries, and ca-certificates to ensure the terminal and network requests work correctly.
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    libncurses6 \
    libtinfo6 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy torlink artifacts
# We copy the pre-compiled production node_modules and dist from the builder stage
WORKDIR /app/torlink
COPY --from=builder /app/torlink/package*.json ./
COPY --from=builder /app/torlink/dist ./dist
COPY --from=builder /app/torlink/patch-stdin.cjs ./
RUN npm install --omit=dev

# Copy web artifacts
WORKDIR /app/web
COPY --from=builder /app/web/dist ./dist

# Copy server artifacts
WORKDIR /app/server
COPY --from=builder /app/server/package*.json ./
COPY --from=builder /app/server/dist ./dist
RUN npm install --omit=dev

# Create the download directory
WORKDIR /app
RUN mkdir -p $DOWNLOAD_DIR

# Expose the port
EXPOSE 3000

# Run the controller server
WORKDIR /app/server
CMD ["node", "dist/index.js"]
