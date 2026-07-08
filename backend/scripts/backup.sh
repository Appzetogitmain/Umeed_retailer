#!/bin/bash
DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/backups/$DATE"
mkdir -p "$BACKUP_DIR"

# Ensure we're running in the correct directory or absolute paths are configured
BACKEND_DIR=$(dirname "$0")/..

# 1. Backup uploads folder (compressed tar)
tar -czf "$BACKUP_DIR/uploads-$DATE.tar.gz" -C "$BACKEND_DIR" uploads/

# 2. Backup MongoDB (mongodump)
if [ -n "$MONGODB_URI" ]; then
  mongodump \
    --uri="$MONGODB_URI" \
    --out="$BACKUP_DIR/mongodb-$DATE"
else
  echo "MONGODB_URI not set. Skipping DB backup."
fi

# 3. Keep only last 7 days of backups
find /backups -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;

echo "✅ Backup completed: $BACKUP_DIR"
