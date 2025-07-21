#!/bin/bash

# Self-Hosted Runner Monitoring Script (Linux/Bash)
# Provides real-time monitoring of GitHub Actions runner status and Docker builds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
CONTINUOUS=false
INTERVAL=5
DOCKER_ONLY=false
RUNNER_ONLY=false
HEALTH=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--continuous)
            CONTINUOUS=true
            shift
            ;;
        -i|--interval)
            INTERVAL="$2"
            shift 2
            ;;
        -d|--docker-only)
            DOCKER_ONLY=true
            shift
            ;;
        -r|--runner-only)
            RUNNER_ONLY=true
            shift
            ;;
        -h|--health)
            HEALTH=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [-c|--continuous] [-i|--interval SECONDS] [-d|--docker-only] [-r|--runner-only] [-h|--health]"
            exit 1
            ;;
    esac
done

# Function to get current timestamp
get_timestamp() {
    date '+%Y-%m-%d %H:%M:%S'
}

# Function to check if Docker is running
test_docker_status() {
    if command -v docker &> /dev/null; then
        if docker info &> /dev/null; then
            return 0
        fi
    fi
    return 1
}

# Function to get Docker build processes
get_docker_builds() {
    if test_docker_status; then
        local builds=$(docker ps --filter "ancestor=ghcr.io/themis128/cloudless.gr" --format "table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}" 2>/dev/null)
        if [[ -n "$builds" ]]; then
            echo "$builds"
        else
            echo "No active Docker builds found"
        fi
    else
        echo "Docker is not running"
    fi
}

# Function to get Docker images
get_docker_images() {
    if test_docker_status; then
        local images=$(docker images "ghcr.io/themis128/cloudless.gr*" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" 2>/dev/null)
        if [[ -n "$images" ]]; then
            echo "$images"
        else
            echo "No cloudless.gr images found"
        fi
    else
        echo "Docker is not running"
    fi
}

# Function to check GitHub Actions runner status
get_runner_status() {
    # Check for runner processes
    local runner_processes=$(ps aux | grep -E "(actions\.runner|runner)" | grep -v grep)
    if [[ -n "$runner_processes" ]]; then
        echo "$runner_processes"
    else
        echo "No runner processes found"
    fi
}

# Function to check system resources
get_system_resources() {
    # CPU usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    
    # Memory usage
    local mem_info=$(free -m | grep Mem)
    local mem_total=$(echo $mem_info | awk '{print $2}')
    local mem_used=$(echo $mem_info | awk '{print $3}')
    local mem_available=$(echo $mem_info | awk '{print $7}')
    
    # Disk usage
    local disk_info=$(df -h / | tail -1)
    local disk_total=$(echo $disk_info | awk '{print $2}')
    local disk_used=$(echo $disk_info | awk '{print $3}')
    local disk_available=$(echo $disk_info | awk '{print $4}')
    
    echo "CPU Usage: ${cpu_usage}%"
    echo "Memory: ${mem_available}MB available / ${mem_total}MB total"
    echo "Disk: ${disk_available} available / ${disk_total} total"
}

# Function to check network connectivity
test_network_connectivity() {
    local hosts=("github.com" "registry-1.docker.io" "ghcr.io")
    local names=("GitHub.com" "Docker Hub" "GitHub Container Registry")
    
    for i in "${!hosts[@]}"; do
        local host="${hosts[$i]}"
        local name="${names[$i]}"
        
        if ping -c 1 "$host" &> /dev/null; then
            echo "$name: ✅ Online"
        else
            echo "$name: ❌ Offline"
        fi
    done
}

# Function to display monitoring dashboard
show_monitoring_dashboard() {
    local timestamp=$(get_timestamp)
    
    echo -e "\n${CYAN}╔══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                    Self-Hosted Runner Monitoring Dashboard                    ║${NC}"
    echo -e "${CYAN}║                              $timestamp                                    ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════════╝${NC}"
    
    # System Resources
    echo -e "\n${YELLOW}📊 SYSTEM RESOURCES${NC}"
    echo -e "${BLUE}==================================================${NC}"
    get_system_resources
    
    # Network Connectivity
    echo -e "\n${YELLOW}🌐 NETWORK CONNECTIVITY${NC}"
    echo -e "${BLUE}==================================================${NC}"
    test_network_connectivity
    
    # Docker Status
    echo -e "\n${YELLOW}🐳 DOCKER STATUS${NC}"
    echo -e "${BLUE}==================================================${NC}"
    if test_docker_status; then
        echo -e "${GREEN}✅ Docker is running${NC}"
    else
        echo -e "${RED}❌ Docker is not running${NC}"
    fi
    
    # Docker Builds
    echo -e "\n${YELLOW}🔨 ACTIVE DOCKER BUILDS${NC}"
    echo -e "${BLUE}==================================================${NC}"
    get_docker_builds
    
    # Docker Images
    echo -e "\n${YELLOW}📦 DOCKER IMAGES${NC}"
    echo -e "${BLUE}==================================================${NC}"
    get_docker_images
    
    # Runner Status
    echo -e "\n${YELLOW}🤖 RUNNER STATUS${NC}"
    echo -e "${BLUE}==================================================${NC}"
    get_runner_status
    
    echo -e "\n${CYAN}======================================================================${NC}"
}

# Function to show health check
show_health_check() {
    echo -e "\n${YELLOW}🏥 RUNNER HEALTH CHECK${NC}"
    echo -e "${BLUE}==================================================${NC}"
    
    local issues=()
    
    # Check Docker
    if ! test_docker_status; then
        issues+=("Docker is not running")
    fi
    
    # Check system resources
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    local mem_available=$(free -m | grep Mem | awk '{print $7}')
    local disk_available=$(df -h / | tail -1 | awk '{print $4}' | sed 's/G//')
    
    if [[ $(echo "$cpu_usage > 90" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
        issues+=("High CPU usage: ${cpu_usage}%")
    fi
    
    if [[ $mem_available -lt 1000 ]]; then
        issues+=("Low available memory: ${mem_available}MB")
    fi
    
    if [[ $(echo "$disk_available < 10" | bc -l 2>/dev/null || echo "0") -eq 1 ]]; then
        issues+=("Low disk space: ${disk_available}GB")
    fi
    
    # Check network
    local hosts=("github.com" "registry-1.docker.io" "ghcr.io")
    local names=("GitHub.com" "Docker Hub" "GitHub Container Registry")
    
    for i in "${!hosts[@]}"; do
        local host="${hosts[$i]}"
        local name="${names[$i]}"
        
        if ! ping -c 1 "$host" &> /dev/null; then
            issues+=("Network issue: $name is not reachable")
        fi
    done
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        echo -e "${GREEN}✅ All systems healthy!${NC}"
    else
        echo -e "${RED}❌ Issues detected:${NC}"
        for issue in "${issues[@]}"; do
            echo -e "  ${RED}• $issue${NC}"
        done
    fi
}

# Main execution
if [[ "$HEALTH" == true ]]; then
    show_health_check
elif [[ "$DOCKER_ONLY" == true ]]; then
    echo -e "\n${YELLOW}🐳 DOCKER MONITORING${NC}"
    echo -e "${BLUE}==================================================${NC}"
    get_docker_builds
    get_docker_images
elif [[ "$RUNNER_ONLY" == true ]]; then
    echo -e "\n${YELLOW}🤖 RUNNER MONITORING${NC}"
    echo -e "${BLUE}==================================================${NC}"
    get_runner_status
else
    show_monitoring_dashboard
fi

# Continuous monitoring
if [[ "$CONTINUOUS" == true ]]; then
    echo -e "\n${CYAN}🔄 Starting continuous monitoring (refresh every $INTERVAL seconds)...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    
    while true; do
        sleep "$INTERVAL"
        clear
        show_monitoring_dashboard
    done
fi 