#!/bin/bash

# Auto-Remediation Script for Self-Hosted Runner (Linux)
# Automatically fixes common issues detected by the monitoring dashboard

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line arguments
DRY_RUN=false
FORCE=false
MAX_RETRIES=3

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --max-retries)
            MAX_RETRIES="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--dry-run] [--force] [--max-retries N]"
            exit 1
            ;;
    esac
done

function log() {
    local message="$1"
    local color="$2"
    local timestamp=$(date '+%H:%M:%S')
    echo -e "${color}[$timestamp] $message${NC}"
}

function get_timestamp() {
    date '+%H:%M:%S'
}

function check_sudo() {
    if [[ $EUID -eq 0 ]]; then
        return 0
    else
        return 1
    fi
}

function run_command() {
    local command="$1"
    local description="$2"
    local require_sudo="$3"
    
    log "🔧 $description" "$CYAN"
    
    if [[ "$require_sudo" == "true" && ! $(check_sudo) ]]; then
        log "❌ Sudo privileges required for: $command" "$RED"
        return 1
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "🔍 DRY RUN: Would execute: $command" "$YELLOW"
        return 0
    fi
    
    if eval "$command" 2>&1; then
        log "✅ Success: $description" "$GREEN"
        return 0
    else
        log "❌ Failed: $description" "$RED"
        return 1
    fi
}

function remediate_high_cpu() {
    log "🚨 Remediating High CPU Usage..." "$YELLOW"
    
    # Check for runaway processes
    run_command "ps aux --sort=-%cpu | head -6" "Checking top CPU processes"
    
    # Kill processes using excessive CPU (if Force is enabled)
    if [[ "$FORCE" == "true" ]]; then
        local high_cpu_processes=$(ps aux | awk '$3 > 80 && $11 !~ /^(systemd|kthreadd|ksoftirqd|migration|rcu_bh|rcu_sched|watchdog|khelper|kdevtmpfs|netns|perf|writeback|kintegrityd|bioset|kblockd|ata_sff|md|devfreq_wq|watchdogd|kswapd0|fsnotify_mark|ecryptfs-kthrea|kthrotld|acpi_thermal_pm|scsi_eh_|scsi_tmf_|ipv6_addrconf|kstrp|charger_manager|hiddev|kworker|systemd|docker|containerd|runc)$/ {print $2}')
        
        for pid in $high_cpu_processes; do
            log "🔄 Stopping high CPU process: PID $pid" "$YELLOW"
            if [[ "$DRY_RUN" != "true" ]]; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        done
    fi
    
    # Restart Docker if it's consuming too much CPU
    if pgrep -x "dockerd" > /dev/null; then
        run_command "systemctl restart docker" "Restarting Docker service" "true"
    fi
}

function remediate_high_memory() {
    log "🚨 Remediating High Memory Usage..." "$YELLOW"
    
    # Check memory usage
    run_command "free -h" "Checking memory usage"
    
    # Clear Docker images if Force is enabled
    if [[ "$FORCE" == "true" ]]; then
        run_command "docker image prune -a -f" "Cleaning Docker images"
    fi
    
    # Restart runner service if it's consuming too much memory
    local runner_processes=$(pgrep -f "actions.runner\|github-runner")
    if [[ -n "$runner_processes" ]]; then
        run_command "systemctl restart actions.runner.*" "Restarting runner services" "true"
    fi
}

function remediate_high_disk() {
    log "🚨 Remediating High Disk Usage..." "$YELLOW"
    
    # Check disk usage
    run_command "df -h" "Checking disk usage"
    
    # Clean Docker cache
    run_command "docker system prune -f" "Cleaning Docker system cache"
    
    # Clean Docker volumes
    run_command "docker volume prune -f" "Cleaning Docker volumes"
    
    # Clean npm cache
    run_command "npm cache clean --force" "Cleaning npm cache"
    
    # Clean old logs
    run_command "journalctl --vacuum-time=7d" "Cleaning old system logs" "true"
    
    # Clean temp files
    if [[ "$FORCE" == "true" ]]; then
        run_command "rm -rf /tmp/*" "Cleaning temp files" "true"
    fi
}

function remediate_docker_issues() {
    log "🚨 Remediating Docker Issues..." "$YELLOW"
    
    # Check Docker service status
    if ! systemctl is-active --quiet docker; then
        run_command "systemctl start docker" "Starting Docker service" "true"
        run_command "systemctl enable docker" "Setting Docker to auto-start" "true"
    fi
    
    # Clean Docker resources
    run_command "docker system prune -a -f" "Cleaning all Docker resources"
    run_command "docker image prune -a -f" "Cleaning Docker images"
    run_command "docker container prune -f" "Cleaning stopped containers"
}

function remediate_runner_issues() {
    log "🚨 Remediating Runner Issues..." "$YELLOW"
    
    # Check for runner processes
    local runner_processes=$(pgrep -f "actions.runner\|github-runner")
    
    if [[ -z "$runner_processes" ]]; then
        log "⚠️ No runner processes found" "$YELLOW"
        
        # Try to start runner service
        run_command "systemctl start actions.runner.*" "Starting runner services" "true"
        
        # If no systemd service, try to start manually
        if [[ -f "./run.sh" ]]; then
            run_command "nohup ./run.sh > runner.log 2>&1 &" "Starting runner manually"
        fi
    fi
}

function remediate_network_issues() {
    log "🚨 Remediating Network Issues..." "$YELLOW"
    
    # Test basic connectivity
    run_command "ping -c 3 8.8.8.8" "Testing DNS connectivity"
    run_command "ping -c 3 github.com" "Testing GitHub connectivity"
    
    # Flush DNS cache
    if command -v systemd-resolve &> /dev/null; then
        run_command "systemd-resolve --flush-caches" "Flushing DNS cache" "true"
    elif command -v nscd &> /dev/null; then
        run_command "nscd -i hosts" "Flushing DNS cache" "true"
    fi
    
    # Reset network adapter if Force is enabled
    if [[ "$FORCE" == "true" ]]; then
        local network_interfaces=$(ip link show | grep -E "^[0-9]+:" | awk -F: '{print $2}' | tr -d ' ')
        for interface in $network_interfaces; do
            if [[ "$interface" != "lo" ]]; then
                log "🔄 Resetting network interface: $interface" "$YELLOW"
                if [[ "$DRY_RUN" != "true" ]]; then
                    ip link set "$interface" down
                    sleep 2
                    ip link set "$interface" up
                fi
            fi
        done
    fi
}

function remediate_temperature_issues() {
    log "🚨 Remediating Temperature Issues..." "$YELLOW"
    
    # Check if we can get temperature info
    if command -v sensors &> /dev/null; then
        run_command "sensors" "Checking system temperature"
    else
        log "⚠️ Temperature sensors not available" "$YELLOW"
    fi
    
    # Reduce system load
    if [[ "$FORCE" == "true" ]]; then
        log "🔄 Reducing system load..." "$YELLOW"
        
        # Stop non-essential services
        local non_essential_services=("bluetooth" "cups" "avahi-daemon")
        for service in "${non_essential_services[@]}"; do
            if systemctl is-active --quiet "$service"; then
                run_command "systemctl stop $service" "Stopping non-essential service: $service" "true"
            fi
        done
    fi
}

function get_system_health() {
    log "📊 Assessing System Health..." "$CYAN"
    
    # CPU Usage
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    log "CPU Usage: ${cpu_usage}%" "$(if (( $(echo "$cpu_usage > 80" | bc -l) )); then echo "$RED"; elif (( $(echo "$cpu_usage > 60" | bc -l) )); then echo "$YELLOW"; else echo "$GREEN"; fi)"
    
    # Memory Usage
    local memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
    log "Memory Usage: ${memory_usage}%" "$(if (( $(echo "$memory_usage > 80" | bc -l) )); then echo "$RED"; elif (( $(echo "$memory_usage > 60" | bc -l) )); then echo "$YELLOW"; else echo "$GREEN"; fi)"
    
    # Disk Usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    log "Disk Usage: ${disk_usage}%" "$(if (( disk_usage > 80 )); then echo "$RED"; elif (( disk_usage > 60 )); then echo "$YELLOW"; else echo "$GREEN"; fi)"
    
    # Docker Status
    local docker_status
    if systemctl is-active --quiet docker; then
        docker_status="Running"
        log "Docker Status: $docker_status" "$GREEN"
    else
        docker_status="Stopped"
        log "Docker Status: $docker_status" "$RED"
    fi
    
    echo "$cpu_usage $memory_usage $disk_usage $docker_status"
}

function start_auto_remediation() {
    log "🤖 Starting Auto-Remediation System..." "$CYAN"
    log "Mode: $(if [[ "$DRY_RUN" == "true" ]]; then echo "DRY RUN"; else echo "LIVE"; fi)" "$(if [[ "$DRY_RUN" == "true" ]]; then echo "$YELLOW"; else echo "$RED"; fi)"
    log "Force Mode: $(if [[ "$FORCE" == "true" ]]; then echo "ENABLED"; else echo "DISABLED"; fi)" "$(if [[ "$FORCE" == "true" ]]; then echo "$RED"; else echo "$GREEN"; fi)"
    
    # Get current system health
    local health_data=$(get_system_health)
    local cpu_usage=$(echo "$health_data" | awk '{print $1}')
    local memory_usage=$(echo "$health_data" | awk '{print $2}')
    local disk_usage=$(echo "$health_data" | awk '{print $3}')
    local docker_status=$(echo "$health_data" | awk '{print $4}')
    
    # Determine what needs remediation
    local issues=()
    
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        issues+=("HighCPU")
    fi
    
    if (( $(echo "$memory_usage > 80" | bc -l) )); then
        issues+=("HighMemory")
    fi
    
    if (( disk_usage > 80 )); then
        issues+=("HighDisk")
    fi
    
    if [[ "$docker_status" != "Running" ]]; then
        issues+=("DockerIssues")
    fi
    
    if [[ ${#issues[@]} -eq 0 ]]; then
        log "✅ System is healthy! No remediation needed." "$GREEN"
        return
    fi
    
    log "🚨 Issues detected: ${issues[*]}" "$RED"
    
    # Perform remediation for each issue
    for issue in "${issues[@]}"; do
        case $issue in
            "HighCPU")
                remediate_high_cpu
                ;;
            "HighMemory")
                remediate_high_memory
                ;;
            "HighDisk")
                remediate_high_disk
                ;;
            "DockerIssues")
                remediate_docker_issues
                ;;
        esac
        
        # Wait between remediations
        sleep 2
    done
    
    # Check network issues
    remediate_network_issues
    
    # Check temperature issues
    remediate_temperature_issues
    
    # Final health check
    log "📊 Post-Remediation Health Check..." "$CYAN"
    get_system_health
    
    log "🎯 Remediation Complete!" "$GREEN"
}

# Main execution
main() {
    # Check if running as root for certain operations
    if [[ "$FORCE" == "true" && ! $(check_sudo) ]]; then
        log "❌ Force mode requires sudo privileges" "$RED"
        exit 1
    fi
    
    # Check if bc is available for floating point math
    if ! command -v bc &> /dev/null; then
        log "❌ 'bc' command not found. Please install it: apt-get install bc" "$RED"
        exit 1
    fi
    
    start_auto_remediation
}

# Run main function
main "$@" 