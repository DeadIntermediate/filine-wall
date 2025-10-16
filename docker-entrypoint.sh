#!/bin/sh
set -e

echo "Starting FiLine Wall services..."

# Start nginx in background
echo "Starting nginx..."
nginx -g "daemon off;" &

# Wait a moment for nginx to start
sleep 2

# Start the Node.js API server
echo "Starting API server..."
cd /app
exec node index.js