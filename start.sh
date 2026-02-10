#!/bin/sh
echo "Running Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "Starting Next.js server on port ${PORT:-3000}..."
export HOSTNAME=0.0.0.0
export PORT=${PORT:-3000}
node server.js
