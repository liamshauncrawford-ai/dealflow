#!/bin/sh

echo "=== Railway Startup ==="
echo "Timestamp: $(date -u)"
echo "Node: $(node --version)"

echo ""
echo "=== Checking migration files ==="
ls -la prisma/migrations/ 2>&1 || echo "WARNING: No migrations directory found"

echo ""
echo "=== Running Prisma migrate deploy ==="
if node node_modules/prisma/build/index.js migrate deploy 2>&1; then
  echo "Migrations applied successfully."
else
  echo ""
  echo "WARNING: migrate deploy failed. Falling back to db push..."
  node node_modules/prisma/build/index.js db push --accept-data-loss 2>&1 || echo "ERROR: db push also failed"
fi

echo ""
echo "=== Migration status ==="
node node_modules/prisma/build/index.js migrate status 2>&1 || true

echo ""
echo "Starting Next.js server on port ${PORT:-3000}..."
export HOSTNAME=0.0.0.0
export PORT=${PORT:-3000}
exec node server.js
