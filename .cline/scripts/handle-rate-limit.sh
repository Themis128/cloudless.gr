#!/bin/bash
# Rate limit handling script for Cline agent
# Handles 429 Too Many Requests errors with exponential backoff

MAX_RETRIES=5
BASE_DELAY=1  # Base delay in seconds

handle_429() {
    local attempt=$1
    local delay=$((BASE_DELAY * (2 ** (attempt - 1))))  # Exponential backoff
    
    # Add jitter to prevent thundering herd
    local jitter=$((RANDOM % 1000))
    local total_delay=$((delay + jitter / 1000))
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Rate limit hit (429). Attempt $attempt/$MAX_RETRIES. Waiting $total_delay seconds..." >> /tmp/.cline-rate-limit.log
    
    sleep $total_delay
    
    if [ $attempt -lt $MAX_RETRIES ]; then
        return 0  # Retry
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Max retries ($MAX_RETRIES) exceeded for rate limit handling" >> /tmp/.cline-rate-limit.log
        return 1  # Fail
    fi
}

# Main execution wrapper
if [ "$1" = "execute" ]; then
    shift
    local cmd="$*"
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        # Execute the command
        output=$($cmd 2>&1)
        exit_code=$?
        
        # Check if output contains 429 error
        if echo "$output" | grep -q '"status":429' || echo "$output" | grep -q '429 status code'; then
            if handle_429 $attempt; then
                attempt=$((attempt + 1))
                continue
            else
                echo "$output"
                exit $exit_code
            fi
        else
            # No 429 error, output normally
            echo "$output"
            exit $exit_code
        fi
    done
    
    # If we get here, we've exhausted retries
    echo "$output"
    exit $exit_code
else
    echo "Usage: $0 execute <command>"
    exit 1
fi
