#!/bin/bash

# Database Backup Script for Cloudless
set -e

# Configuration
BACKUP_DIR="/backups"
DB_NAME="cloudless"
DB_USER="cloudless_user"
DB_HOST="postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="cloudless_backup_${DATE}.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory if it doesn't exist
create_backup_dir() {
    if [ ! -d "$BACKUP_DIR" ]; then
        log_info "Creating backup directory: $BACKUP_DIR"
        mkdir -p "$BACKUP_DIR"
    fi
}

# Perform database backup
backup_database() {
    log_info "Starting database backup..."
    
    # Create backup
    pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_DIR/$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "Database backup completed: $BACKUP_FILE"
    else
        log_error "Database backup failed"
        exit 1
    fi
}

# Compress backup file
compress_backup() {
    log_info "Compressing backup file..."
    
    gzip "$BACKUP_DIR/$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        log_success "Backup compressed: $BACKUP_FILE.gz"
    else
        log_error "Backup compression failed"
        exit 1
    fi
}

# Clean old backups (keep last 7 days)
cleanup_old_backups() {
    log_info "Cleaning up old backups (keeping last 7 days)..."
    
    find "$BACKUP_DIR" -name "cloudless_backup_*.sql.gz" -mtime +7 -delete
    
    log_success "Old backups cleaned up"
}

# Verify backup integrity
verify_backup() {
    log_info "Verifying backup integrity..."
    
    # Test if the backup file can be read
    if gunzip -t "$BACKUP_DIR/$BACKUP_FILE.gz" 2>/dev/null; then
        log_success "Backup integrity verified"
    else
        log_error "Backup integrity check failed"
        exit 1
    fi
}

# Show backup statistics
show_statistics() {
    log_info "Backup Statistics:"
    echo "  Backup file: $BACKUP_FILE.gz"
    echo "  Size: $(du -h "$BACKUP_DIR/$BACKUP_FILE.gz" | cut -f1)"
    echo "  Location: $BACKUP_DIR"
    echo "  Total backups: $(ls -1 "$BACKUP_DIR"/cloudless_backup_*.sql.gz 2>/dev/null | wc -l)"
}

# Main backup function
main() {
    log_info "Starting database backup process..."
    
    # Create backup directory
    create_backup_dir
    
    # Perform backup
    backup_database
    
    # Compress backup
    compress_backup
    
    # Verify backup
    verify_backup
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Show statistics
    show_statistics
    
    log_success "Database backup process completed successfully!"
}

# Show usage
usage() {
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  backup     Perform database backup (default)"
    echo "  cleanup    Clean up old backups only"
    echo "  verify     Verify existing backups"
    echo "  list       List all backups"
    echo "  -h, --help Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_DIR     Backup directory (default: /backups)"
    echo "  DB_NAME        Database name (default: cloudless)"
    echo "  DB_USER        Database user (default: cloudless_user)"
    echo "  DB_HOST        Database host (default: postgres)"
}

# List backups
list_backups() {
    log_info "Available backups:"
    if [ -d "$BACKUP_DIR" ]; then
        ls -lh "$BACKUP_DIR"/cloudless_backup_*.sql.gz 2>/dev/null || echo "No backups found"
    else
        echo "Backup directory does not exist"
    fi
}

# Verify existing backups
verify_backups() {
    log_info "Verifying all existing backups..."
    
    if [ -d "$BACKUP_DIR" ]; then
        for backup in "$BACKUP_DIR"/cloudless_backup_*.sql.gz; do
            if [ -f "$backup" ]; then
                if gunzip -t "$backup" 2>/dev/null; then
                    log_success "✓ $(basename "$backup")"
                else
                    log_error "✗ $(basename "$backup") - CORRUPTED"
                fi
            fi
        done
    else
        log_error "Backup directory does not exist"
    fi
}

# Handle command line arguments
case "${1:-backup}" in
    -h|--help)
        usage
        exit 0
        ;;
    backup)
        main
        ;;
    cleanup)
        create_backup_dir
        cleanup_old_backups
        ;;
    verify)
        verify_backups
        ;;
    list)
        list_backups
        ;;
    *)
        log_error "Unknown option: $1"
        usage
        exit 1
        ;;
esac 