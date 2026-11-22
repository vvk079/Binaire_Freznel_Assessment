#!/bin/sh
set -e

PORT="${PORT:-10000}"
CREDENTIALS="${TTYD_CREDENTIALS:-admin:binaire2026}"

echo "Starting Binaire Terminal Monitor..."
echo "Port: ${PORT}"

if [ ! -f /app/dist/index.js ]; then
    echo "ERROR: /app/dist/index.js not found!"
    ls -la /app/dist
    exit 1
fi

echo "Application entry point found."
echo "Starting ttyd..."

exec ttyd 
    -p "$PORT" 
    -i 0.0.0.0 
    -W 
    -c "$CREDENTIALS" 
    sh -c 'node /app/dist/index.js'
