#!/bin/bash

# Docker Debug Script for Cloudless LLM Dev Agent
# This script helps debug Docker container issues, especially Supabase connectivity

set -e

echo "🔍 Docker Debug Script for Cloudless LLM Dev Agent"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️ $message${NC}" ;;
        "info") echo -e "${BLUE}ℹ️ $message${NC}" ;;
    esac
}

# Check if Docker is running
check_docker() {
    print_status "info" "Checking Docker status..."
    if ! docker info >/dev/null 2>&1; then
        print_status "error" "Docker is not running or not accessible"
        exit 1
    fi
    print_status "success" "Docker is running"
}

# Check if .env file exists
check_env_file() {
    print_status "info" "Checking environment file..."
    if [ ! -f ".env" ]; then
        print_status "error" ".env file not found"
        print_status "info" "Please copy docker.env.example to .env and configure your Supabase credentials"
        exit 1
    fi
    print_status "success" ".env file found"
}

# Validate environment variables
validate_env_vars() {
    print_status "info" "Validating environment variables..."
    
    # Source the .env file
    set -a
    source .env
    set +a
    
    local missing_vars=()
    
    if [ -z "$NUXT_PUBLIC_SUPABASE_URL" ]; then
        missing_vars+=("NUXT_PUBLIC_SUPABASE_URL")
    fi
    
    if [ -z "$NUXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
        missing_vars+=("NUXT_PUBLIC_SUPABASE_ANON_KEY")
    fi
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_status "error" "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    
    print_status "success" "All required environment variables are set"
}

# Check container status
check_container_status() {
    print_status "info" "Checking container status..."
    
    if docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "cloudlessgr-app"; then
        print_status "success" "Container is running"
        docker ps --format "table {{.Names}}\t{{.Status}}" | grep "cloudlessgr-app"
    else
        print_status "warning" "Container is not running"
        print_status "info" "Starting container..."
        docker-compose up -d
        sleep 10
    fi
}

# Test container connectivity
test_container_connectivity() {
    print_status "info" "Testing container connectivity..."
    
    # Wait for container to be ready
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
            print_status "success" "Container is responding to health checks"
            break
        fi
        
        print_status "info" "Waiting for container to be ready... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_status "error" "Container failed to start within expected time"
        return 1
    fi
}

# Get detailed health check
get_health_check() {
    print_status "info" "Getting detailed health check..."
    
    local health_response
    health_response=$(curl -s http://localhost:3000/api/health)
    
    if [ $? -eq 0 ]; then
        echo "Health Check Response:"
        echo "$health_response" | jq '.' 2>/dev/null || echo "$health_response"
    else
        print_status "error" "Failed to get health check response"
    fi
}

# Check container logs
check_container_logs() {
    print_status "info" "Checking container logs..."
    
    echo "Recent container logs:"
    docker logs --tail 50 cloudlessgr-app 2>/dev/null || docker logs --tail 50 $(docker ps -q --filter "name=cloudlessgr-app") 2>/dev/null
}

# Test Supabase connectivity from container
test_supabase_connectivity() {
    print_status "info" "Testing Supabase connectivity from container..."
    
    # Execute command inside container to test Supabase connection
    docker exec cloudlessgr-app node -e "
    const { createClient } = require('@supabase/supabase-js');
    
    const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.log('❌ Supabase environment variables not set in container');
        process.exit(1);
    }
    
    console.log('🔍 Testing Supabase connection...');
    console.log('URL:', supabaseUrl);
    console.log('Key:', supabaseKey.substring(0, 10) + '...');
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
    
    supabase.rpc('version')
        .then(({ data, error }) => {
            if (error) {
                console.log('❌ Supabase connection failed:', error.message);
                process.exit(1);
            } else {
                console.log('✅ Supabase connection successful');
                console.log('Version:', data);
            }
        })
        .catch(err => {
            console.log('❌ Supabase connection error:', err.message);
            process.exit(1);
        });
    " 2>/dev/null || print_status "error" "Failed to test Supabase connectivity"
}

# Main execution
main() {
    echo ""
    check_docker
    echo ""
    check_env_file
    echo ""
    validate_env_vars
    echo ""
    check_container_status
    echo ""
    test_container_connectivity
    echo ""
    get_health_check
    echo ""
    check_container_logs
    echo ""
    test_supabase_connectivity
    echo ""
    
    print_status "success" "Debug script completed"
    print_status "info" "If issues persist, check the logs above for specific error messages"
}

# Run main function
main "$@" 