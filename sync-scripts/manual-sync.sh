#!/bin/bash

# Manual sync trigger script
# Usage: ./manual-sync.sh [--auth] [--backup-only] [--tables table1,table2,...]

set -e

INCLUDE_AUTH=false
BACKUP_ONLY=false
SPECIFIC_TABLES=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --auth)
            INCLUDE_AUTH=true
            shift
            ;;
        --backup-only)
            BACKUP_ONLY=true
            shift
            ;;
        --tables)
            SPECIFIC_TABLES="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--auth] [--backup-only] [--tables table1,table2,...]"
            exit 1
            ;;
    esac
done

echo "🚀 Manual Supabase Sync"
echo "========================"
echo "Include Auth: $INCLUDE_AUTH"
echo "Backup Only: $BACKUP_ONLY"
echo "Specific Tables: ${SPECIFIC_TABLES:-'all'}"
echo "========================"

if [ "$BACKUP_ONLY" = true ]; then
    echo "Creating backup only..."
    docker exec supabase-sync-scheduler /scripts/automated-sync.sh backup-only
else
    echo "Running full sync..."
    if [ "$INCLUDE_AUTH" = true ]; then
        docker exec -e SYNC_AUTH=true supabase-sync-scheduler /scripts/automated-sync.sh
    else
        docker exec supabase-sync-scheduler /scripts/automated-sync.sh
    fi
fi

echo "✅ Manual sync completed!"
