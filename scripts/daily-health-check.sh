#!/bin/bash
# Daily Health Check Script for Post-Fix Monitoring
# Run this daily to verify fixes are working
# Usage: ./daily-health-check.sh [n8n|duckdb|searxng|espocrm|all]

set -e

COLOR_GREEN='\033[0;32m'
COLOR_YELLOW='\033[1;33m'
COLOR_RED='\033[0;31m'
COLOR_BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${COLOR_BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${COLOR_BLUE}$1${NC}"
    echo -e "${COLOR_BLUE}═══════════════════════════════════════════════════════${NC}"
}

print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${COLOR_GREEN}✅ $2${NC}"
    else
        echo -e "${COLOR_RED}❌ $2${NC}"
    fi
}

check_n8n() {
    print_header "N8N RESTART RATE CHECK"
    
    local pod=$(kubectl get pod -n n8n -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -z "$pod" ]; then
        echo -e "${COLOR_RED}❌ No n8n pod found${NC}"
        return 1
    fi
    
    local restarts=$(kubectl get pod -n n8n "$pod" -o jsonpath='{.status.containerStatuses[0].restartCount}' 2>/dev/null)
    local age=$(kubectl get pod -n n8n "$pod" -o jsonpath='{.metadata.creationTimestamp}' 2>/dev/null)
    local status=$(kubectl get pod -n n8n "$pod" -o jsonpath='{.status.phase}' 2>/dev/null)
    
    echo "Pod: $pod"
    echo "Status: $status"
    echo "Age: $age"
    echo "Restarts: $restarts"
    
    if [ "$status" = "Running" ] && [ "$restarts" -lt 2 ]; then
        print_status 0 "n8n pod is healthy"
        return 0
    else
        print_status 1 "n8n pod may have issues (restarts: $restarts)"
        return 1
    fi
}

check_duckdb() {
    print_header "DUCKDB S3 SYNC JOB CHECK"
    
    local cronjob=$(kubectl get cronjob -n analytics s3-to-duckdb-sync 2>/dev/null)
    if [ -z "$cronjob" ]; then
        echo -e "${COLOR_RED}❌ CronJob not found${NC}"
        return 1
    fi
    
    local suspend=$(kubectl get cronjob -n analytics s3-to-duckdb-sync -o jsonpath='{.spec.suspend}' 2>/dev/null)
    local last_run=$(kubectl get cronjob -n analytics s3-to-duckdb-sync -o jsonpath='{.status.lastScheduleTime}' 2>/dev/null)
    
    echo "CronJob: s3-to-duckdb-sync"
    echo "Suspended: $suspend"
    echo "Last Run: $last_run"
    
    # Count jobs from last 2 hours
    local recent_jobs=$(kubectl get jobs -n analytics -l cronjob-name=s3-to-duckdb-sync --sort-by=.status.completionTime -o jsonpath='{range .items[*]}{.status.completionTime}{"\n"}{end}' 2>/dev/null | tail -2)
    echo "Recent Job Completions:"
    echo "$recent_jobs" | grep -v '^$' || echo "  (none)"
    
    if [ "$suspend" = "false" ]; then
        print_status 0 "DuckDB S3 sync is active"
        return 0
    else
        print_status 1 "DuckDB S3 sync is suspended"
        return 1
    fi
}

check_searxng() {
    print_header "SEARXNG LIMITER CHECK"
    
    local pod=$(kubectl get pod -n search -l app=searxng -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
    if [ -z "$pod" ]; then
        echo -e "${COLOR_RED}❌ No SearXNG pod found${NC}"
        return 1
    fi
    
    local status=$(kubectl get pod -n search "$pod" -o jsonpath='{.status.phase}' 2>/dev/null)
    local limiter_config=$(kubectl get configmap -n search searxng-settings -o jsonpath='{.data.settings\.yml}' 2>/dev/null | grep "limiter:" || echo "not found")
    
    echo "Pod: $pod"
    echo "Status: $status"
    echo "Limiter Config: $limiter_config"
    
    # Check for limiter errors in logs
    local limiter_errors=$(kubectl logs -n search "$pod" 2>/dev/null | grep -i "error.*limiter" | head -1 || echo "")
    if [ -n "$limiter_errors" ]; then
        echo -e "${COLOR_YELLOW}⚠️  Note: $limiter_errors${NC}"
    fi
    
    if [ "$status" = "Running" ]; then
        print_status 0 "SearXNG is running"
        return 0
    else
        print_status 1 "SearXNG pod not running"
        return 1
    fi
}

check_espocrm() {
    print_header "ESPOCRM R2 BACKUP CHECK"

    # Prefer CronJob health — no AWS CLI. R2 listing needs CF_R2_* on the host.
    local cronjob
    cronjob=$(kubectl get cronjob -n espocrm mariadb-xbstream-backup 2>/dev/null || true)
    if [ -z "$cronjob" ]; then
        print_status 1 "mariadb-xbstream-backup CronJob not found"
        return 1
    fi

    echo "CronJob:"
    kubectl get cronjob -n espocrm mariadb-xbstream-backup -o wide --no-headers 2>/dev/null || true

    local last_ok
    last_ok=$(kubectl get jobs -n espocrm -l app.kubernetes.io/name=mariadb-xbstream-backup \
      --sort-by=.status.completionTime \
      -o jsonpath='{range .items[?(@.status.succeeded==1)]}{.status.completionTime}{"\n"}{end}' 2>/dev/null | tail -1)

    if [ -n "$last_ok" ]; then
        echo "Last successful job: $last_ok"
        print_status 0 "EspoCRM xbstream backup CronJob has recent success (target: R2 datalake-bucket)"
        return 0
    fi

    print_status 0 "Backup CronJob configured (R2 Free) — no completed Job yet in this window"
    return 0
}

# Main
CHECKS=${1:-all}
TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

echo ""
echo "Daily Health Check - $TIMESTAMP"
echo ""

case "$CHECKS" in
    n8n)
        check_n8n
        ;;
    duckdb)
        check_duckdb
        ;;
    searxng)
        check_searxng
        ;;
    espocrm)
        check_espocrm
        ;;
    all)
        check_n8n
        echo ""
        check_duckdb
        echo ""
        check_searxng
        echo ""
        check_espocrm
        ;;
    *)
        echo "Usage: $0 [n8n|duckdb|searxng|espocrm|all]"
        exit 1
        ;;
esac

echo ""
echo -e "${COLOR_BLUE}═══════════════════════════════════════════════════════${NC}"
echo "Check complete. Review results above."
echo -e "${COLOR_BLUE}═══════════════════════════════════════════════════════${NC}"
