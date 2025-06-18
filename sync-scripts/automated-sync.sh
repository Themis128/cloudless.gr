#!/bin/bash

# Automated sync script to run inside Docker container
# This script syncs data from cloud Supabase to local Supabase

set -e

echo "$(date): Starting automated sync..."

# Environment variables (set in docker-compose)
CLOUD_URL="https://${CLOUD_PROJECT_REF}.supabase.co"
LOCAL_URL="http://supabase-db:5432"
CLOUD_DB_HOST="db.${CLOUD_PROJECT_REF}.supabase.co"

# Function to sync a table via REST API
sync_table() {
    local table_name=$1
    echo "$(date): Syncing table: $table_name"

    # Get data from cloud
    cloud_data=$(curl -s -H "Authorization: Bearer ${CLOUD_SERVICE_ROLE_KEY}" \
                     -H "apikey: ${CLOUD_SERVICE_ROLE_KEY}" \
                     "${CLOUD_URL}/rest/v1/${table_name}")

    if [ "$cloud_data" != "[]" ] && [ "$cloud_data" != "" ]; then
        # Clear local table
        docker exec supabase-db psql -U postgres -d postgres -c "TRUNCATE TABLE public.${table_name} CASCADE;" 2>/dev/null || true

        # Insert data to local via PostgreSQL
        echo "$cloud_data" | jq -r '.[] | @json' | while read -r record; do
            # Convert JSON to SQL INSERT (simplified version)
            echo "INSERT INTO public.${table_name} SELECT * FROM json_populate_record(NULL::public.${table_name}, '${record}') ON CONFLICT DO NOTHING;" | \
                docker exec -i supabase-db psql -U postgres -d postgres 2>/dev/null || true
        done

        echo "$(date): ✅ Synced $table_name successfully"
    else
        echo "$(date): 📭 No data found in $table_name"
    fi
}

# Function to sync auth users via SQL dump
sync_auth_users() {
    echo "$(date): Syncing auth users..."

    # Dump auth users from cloud
    PGPASSWORD="${CLOUD_DB_PASSWORD}" pg_dump \
        -h "${CLOUD_DB_HOST}" \
        -p 5432 \
        -U postgres \
        -d postgres \
        --data-only \
        --table=auth.users \
        --table=auth.identities \
        --inserts > /backups/cloud_auth_users.sql

    if [ $? -eq 0 ] && [ -s /backups/cloud_auth_users.sql ]; then
        # Clear local auth users
        docker exec supabase-db psql -U postgres -d postgres -c "TRUNCATE auth.users CASCADE; TRUNCATE auth.identities CASCADE;" 2>/dev/null || true

        # Apply to local
        cat /backups/cloud_auth_users.sql | docker exec -i supabase-db psql -U postgres -d postgres

        if [ $? -eq 0 ]; then
            echo "$(date): ✅ Auth users synced successfully"
            rm -f /backups/cloud_auth_users.sql
        else
            echo "$(date): ❌ Failed to apply auth users"
        fi
    else
        echo "$(date): ❌ Failed to dump auth users"
    fi
}

# Function to create full backup
create_backup() {
    echo "$(date): Creating backup..."
    local backup_name="supabase_backup_$(date +%Y%m%d_%H%M%S).sql"

    docker exec supabase-db pg_dump -U postgres -d postgres > "/backups/${backup_name}"

    if [ $? -eq 0 ]; then
        echo "$(date): ✅ Backup created: ${backup_name}"

        # Keep only last 7 backups
        ls -t /backups/supabase_backup_*.sql | tail -n +8 | xargs -r rm
    else
        echo "$(date): ❌ Backup failed"
    fi
}

# Main sync process
main() {
    echo "$(date): ==================================="
    echo "$(date): Starting Supabase Cloud -> Local Sync"
    echo "$(date): ==================================="

    # Create backup before sync
    create_backup

    # Sync public tables
    tables=("profiles" "userinfo" "projects" "user_sessions" "audit_logs")

    for table in "${tables[@]}"; do
        sync_table "$table"
    done

    # Sync auth users (if password is available)
    if [ -n "${CLOUD_DB_PASSWORD}" ]; then
        sync_auth_users
    else
        echo "$(date): ⚠️ Skipping auth users sync (no password)"
    fi

    echo "$(date): ==================================="
    echo "$(date): Sync completed successfully!"
    echo "$(date): ==================================="
}

# Run main function
main "$@"
