#!/bin/sh
set -e

PORT="${PORT:-10000}"
CREDENTIALS="${TTYD_CREDENTIALS:-admin:binaire2026}"

echo "=================================================="
echo "🚀 Starting btop Terminal Monitor via ttyd"
echo "🌐 Port: ${PORT}"
echo "🔒 Authentication: enabled"
echo "=================================================="

exec ttyd -p "$PORT" -i 0.0.0.0 -W -c "$CREDENTIALS" node dist/index.js
