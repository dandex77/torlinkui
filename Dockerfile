# --- Stage 1: Builder ---
FROM node:26-slim AS builder

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Build torlink (CLI)
WORKDIR /app/torlink
COPY torlink/package*.json ./
RUN npm install
COPY torlink/ .
COPY patch-stdin.cjs /app/torlink/
RUN npm run build

# 2. Build Web UI
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ .
RUN npm run build

# 3. Build Server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ .
# Bundle the server using esbuild as ESM
RUN npx esbuild index.js --bundle --platform=node --format=esm --outfile=dist/index.js --minify --packages=external

# --- Stage 2: Runner ---
FROM node:26-slim

# Set environment variables
ENV PORT=3000
ENV DOWNLOAD_DIR=/app/downloads
ENV NODE_ENV=production

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libncurses6 \
    libtinfo6 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create the download directory
RUN mkdir -p $DOWNLOAD_DIR

# 1. Install Server (fresh install in runner to ensure native module compatibility)
WORKDIR /app/server
COPY --from=builder /app/server/package*.json ./
COPY --from=builder /app/server/dist ./dist
RUN apt-get update && apt-get install -y python3 make g++ && \
    npm install --omit=dev && \
    apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# 2. Install Web UI (already built, just copy dist)
WORKDIR /app/web
COPY --from=builder /app/web/dist ./dist

# 3. Install Torlink (CLI) (fresh install in runner to ensure native module compatibility)
WORKDIR /app/torlink
COPY --from=builder /app/torlink/package*.json ./
COPY --from=builder /app/torlink/dist ./dist
COPY --from=builder /app/torlink/patch-stdin.cjs ./
RUN apt-get update && apt-get install -y python3 make g++ && \
    npm install --omit=dev && \
    apt-get purge -y python3 make g++ && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

# Final setup
WORKDIR /app
EXPOSE 3000

# Run the controller server
WORKDIR /app/server
CMD ["node", "dist/index.js"]