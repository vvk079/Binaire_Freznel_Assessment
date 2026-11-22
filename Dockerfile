FROM node:20-bookworm-slim

# Install ttyd, procps (for Linux process metrics), and required utilities
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      procps \
      curl \
      ca-certificates && \
    (apt-get install -y --no-install-recommends ttyd || \
     (curl -fsSL -o /usr/local/bin/ttyd https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 && chmod +x /usr/local/bin/ttyd)) && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Set terminal environment
ENV NODE_ENV=production \
    TERM=xterm-256color \
    LANG=C.UTF-8

# Install dependencies (cached layer)
COPY package.json package-lock.json ./
RUN npm ci

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript to dist/
RUN npm run build

# Remove devDependencies for a lean runtime
RUN npm prune --production

# Copy startup script
COPY entrypoint.sh ./
RUN chmod +x ./entrypoint.sh && sed -i 's/\r$//' ./entrypoint.sh

# Default port (Render automatically provides PORT at runtime)
EXPOSE 10000

CMD ["./entrypoint.sh"]
