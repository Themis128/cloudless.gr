#!/bin/bash

# GitHub Actions Workflow Helper Scripts
# This file contains common functions used across workflows

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running in GitHub Actions
is_github_actions() {
    [ -n "$GITHUB_ACTIONS" ]
}

# Get current branch or tag
get_current_ref() {
    if [ -n "$GITHUB_REF" ]; then
        echo "$GITHUB_REF"
    else
        git rev-parse --abbrev-ref HEAD
    fi
}

# Check if this is a production deployment
is_production_deployment() {
    local ref
    ref=$(get_current_ref)
    [[ "$ref" == "refs/heads/main" || "$ref" == "refs/heads/master" || "$ref" =~ ^refs/tags/v ]]
}

# Check if this is a staging deployment
is_staging_deployment() {
    local ref
    ref=$(get_current_ref)
    [[ "$ref" == "refs/heads/develop" ]]
}

# Validate environment variables
validate_env_vars() {
    local required_vars=("$@")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
    
    log_success "All required environment variables are set"
    return 0
}

# Check application health
check_health() {
    local url="$1"
    local max_attempts="${2:-30}"
    local delay="${3:-2}"
    
    log_info "Checking application health at $url"
    
    for i in $(seq 1 "$max_attempts"); do
        if curl -f -s "$url" > /dev/null; then
            log_success "Application is healthy"
            return 0
        fi
        
        log_warning "Attempt $i/$max_attempts: Application not ready yet"
        sleep "$delay"
    done
    
    log_error "Application health check failed after $max_attempts attempts"
    return 1
}

# Generate deployment summary
generate_deployment_summary() {
    local environment="$1"
    local version="$2"
    local commit_sha="$3"
    
    cat << EOF
🚀 Deployment Summary
====================
Environment: $environment
Version: $version
Commit: $commit_sha
Timestamp: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
Runner: $RUNNER_OS
Node Version: $(node --version)
NPM Version: $(npm --version)

📊 Build Information
===================
Build Size: $(du -sh .output 2>/dev/null | cut -f1 || echo "N/A")
Node Modules Size: $(du -sh node_modules 2>/dev/null | cut -f1 || echo "N/A")
Total Dependencies: $(npm list --depth=0 2>/dev/null | wc -l || echo "N/A")

🔍 Health Check
==============
$(check_health "http://localhost:3000/api/health" 5 1 2>/dev/null || echo "Health check failed")

📝 Next Steps
============
1. Monitor application logs
2. Verify all features are working
3. Check error rates
4. Update documentation if needed
EOF
}

# Cleanup function
cleanup() {
    log_info "Running cleanup..."
    
    # Kill any background processes
    jobs -p | xargs -r kill
    
    # Clean up temporary files
    rm -rf /tmp/.buildx-cache
    
    log_success "Cleanup completed"
}

# Set up trap for cleanup
trap cleanup EXIT

# Export functions for use in workflows
export -f log_info log_success log_warning log_error
export -f is_github_actions get_current_ref is_production_deployment is_staging_deployment
export -f validate_env_vars check_health generate_deployment_summary cleanup 