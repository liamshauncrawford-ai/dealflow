#!/usr/bin/env bash
set -euo pipefail

# DealFlow Database Backup Script
# Run daily via cron: 0 2 * * * cd /path/to/dealflow && ./scripts/backup-db.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/dealflow_${TIMESTAMP}.sql.gz"
MAX_BACKUPS=7

# Load .env
if [[ -f "$PROJECT_DIR/.env" ]]; then
  export $(grep -E '^DATABASE_URL=' "$PROJECT_DIR/.env" | xargs)
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL not set" >&2
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup at $(date)..."
echo "Backup file: $BACKUP_FILE"

# Run pg_dump
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

# Verify
if [[ -f "$BACKUP_FILE" ]] && [[ $(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat --format=%s "$BACKUP_FILE" 2>/dev/null) -gt 0 ]]; then
  BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  echo "Backup completed successfully ($BACKUP_SIZE)"
else
  echo "ERROR: Backup file is empty or missing" >&2
  exit 1
fi

# Cleanup old backups (keep last MAX_BACKUPS)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/dealflow_*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
if [[ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]]; then
  EXCESS=$((BACKUP_COUNT - MAX_BACKUPS))
  ls -1t "$BACKUP_DIR"/dealflow_*.sql.gz | tail -n "$EXCESS" | xargs rm -f
  echo "Cleaned up $EXCESS old backup(s), keeping last $MAX_BACKUPS"
fi

echo "Backup complete at $(date)"
