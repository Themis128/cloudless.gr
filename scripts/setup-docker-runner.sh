#!/bin/bash

# Docker Self-Hosted Runner Setup Script
# This script sets up a GitHub Actions self-hosted runner for containerized environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REPO_OWNER="Themis128"
REPO_NAME="cloudless.gr"
REPO_URL="https://github.com/$REPO_OWNER/$REPO_NAME"
RUNNER_VERSION="2.311.0"
RUNNER_NAME="cloudless-docker-runner-$(hostname)"
RUNNER_LABELS="linux,docker,containerized,self-hosted"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if running in Docker
check_docker_environment() {
    print_status "Checking Docker environment..."
    
    # Check if running in Docker
    if [ -f /.dockerenv ]; then
        print_success "Running in Docker container"
        DOCKER_ENV=true
    elif grep -q docker /proc/1/cgroup 2>/dev/null; then
        print_success "Running in Docker container (cgroup detected)"
        DOCKER_ENV=true
    else
        print_warning "Not running in Docker container"
        DOCKER_ENV=false
    fi
    
    # Check Docker socket access
    if [ -S /var/run/docker.sock ]; then
        print_success "Docker socket accessible"
        DOCKER_SOCKET=true
    else
        print_warning "Docker socket not accessible"
        DOCKER_SOCKET=false
    fi
    
    # Check if Docker daemon is accessible
    if docker info >/dev/null 2>&1; then
        print_success "Docker daemon accessible"
        DOCKER_DAEMON=true
    else
        print_warning "Docker daemon not accessible"
        DOCKER_DAEMON=false
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if running as root (common in containers)
    if [[ $EUID -eq 0 ]]; then
        print_warning "Running as root (typical in containers)"
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_error "Docker not found. This script requires Docker in the container."
        exit 1
    else
        print_success "Docker is installed"
    fi
    
    # Check if docker-compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_warning "docker-compose not found. Installing..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        print_success "docker-compose installed successfully"
    else
        print_success "docker-compose is already installed"
    fi
    
    # Check available disk space (minimum 10GB for containerized setup)
    AVAILABLE_SPACE=$(df . | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=10485760  # 10GB in KB
    
    if [ $AVAILABLE_SPACE -lt $REQUIRED_SPACE ]; then
        print_error "Insufficient disk space. Need at least 10GB, available: $(($AVAILABLE_SPACE / 1024 / 1024))GB"
        exit 1
    fi
    
    print_success "Prerequisites check completed"
}

# Function to get GitHub token
get_github_token() {
    print_status "Setting up GitHub token..."
    
    if [ -z "$GITHUB_TOKEN" ]; then
        print_warning "GITHUB_TOKEN environment variable not set"
        echo "Please provide your GitHub Personal Access Token:"
        echo "1. Go to https://github.com/settings/tokens"
        echo "2. Generate a new token with 'repo' and 'admin:org' scopes"
        echo "3. Enter the token below:"
        read -s GITHUB_TOKEN
        
        if [ -z "$GITHUB_TOKEN" ]; then
            print_error "GitHub token is required"
            exit 1
        fi
    fi
    
    # Test the token
    print_status "Testing GitHub token..."
    if curl -H "Authorization: token $GITHUB_TOKEN" \
           https://api.github.com/repos/$REPO_OWNER/$REPO_NAME &> /dev/null; then
        print_success "GitHub token is valid"
    else
        print_error "Invalid GitHub token or insufficient permissions"
        exit 1
    fi
}

# Function to setup Docker-in-Docker runner
setup_dind_runner() {
    print_status "Setting up Docker-in-Docker runner..."
    
    # Create runner directory
    RUNNER_DIR="/opt/github-runners"
    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"
    
    # Create docker-compose.yml for DinD setup
    cat > docker-compose.yml << EOF
version: '3.8'
services:
  dind:
    image: docker:dind
    container_name: github-runner-dind
    restart: unless-stopped
    privileged: true
    environment:
      - DOCKER_TLS_CERTDIR=/certs
    volumes:
      - dind-storage:/var/lib/docker
    ports:
      - "2376:2376"
    networks:
      - runner-network

  github-runner:
    image: myoung34/github-runner:latest
    container_name: github-runner
    restart: unless-stopped
    depends_on:
      - dind
    environment:
      - RUNNER_NAME=$RUNNER_NAME
      - RUNNER_TOKEN=$GITHUB_TOKEN
      - RUNNER_REPOSITORY_URL=$REPO_URL
      - RUNNER_LABELS=$RUNNER_LABELS
      - RUNNER_WORKDIR=/tmp/github-runner
      - RUNNER_EPHEMERAL=true
      - RUNNER_DISABLE_AUTO_UPDATE=true
      - DOCKER_HOST=tcp://dind:2376
      - DOCKER_TLS_CERTDIR=/certs
      - DOCKER_CERT_PATH=/certs/client
      - DOCKER_TLS_VERIFY=1
    volumes:
      - ./runner-data:/data
      - ./cache:/cache
      - dind-certs:/certs/client:ro
    ports:
      - "8080:8080"
    networks:
      - runner-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  dind-storage:
  dind-certs:

networks:
  runner-network:
    driver: bridge
EOF
    
    # Create cache directory
    mkdir -p cache
    
    # Start the runner
    print_status "Starting GitHub runner with Docker-in-Docker..."
    docker-compose up -d
    
    # Wait for runner to start
    print_status "Waiting for runner to start..."
    sleep 15
    
    # Check runner status
    if docker-compose ps | grep -q "Up"; then
        print_success "GitHub runner started successfully"
    else
        print_error "Failed to start GitHub runner"
        docker-compose logs
        exit 1
    fi
}

# Function to setup simple Docker runner
setup_simple_runner() {
    print_status "Setting up simple Docker runner..."
    
    # Create runner directory
    RUNNER_DIR="/opt/github-runners"
    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"
    
    # Create docker-compose.yml for simple setup
    cat > docker-compose.yml << EOF
version: '3.8'
services:
  github-runner:
    image: myoung34/github-runner:latest
    container_name: github-runner
    restart: unless-stopped
    environment:
      - RUNNER_NAME=$RUNNER_NAME
      - RUNNER_TOKEN=$GITHUB_TOKEN
      - RUNNER_REPOSITORY_URL=$REPO_URL
      - RUNNER_LABELS=$RUNNER_LABELS
      - RUNNER_WORKDIR=/tmp/github-runner
      - RUNNER_EPHEMERAL=true
      - RUNNER_DISABLE_AUTO_UPDATE=true
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./runner-data:/data
      - ./cache:/cache
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
EOF
    
    # Create cache directory
    mkdir -p cache
    
    # Start the runner
    print_status "Starting GitHub runner..."
    docker-compose up -d
    
    # Wait for runner to start
    print_status "Waiting for runner to start..."
    sleep 10
    
    # Check runner status
    if docker-compose ps | grep -q "Up"; then
        print_success "GitHub runner started successfully"
    else
        print_error "Failed to start GitHub runner"
        docker-compose logs
        exit 1
    fi
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."
    
    # Create monitoring script
    cat > "/opt/monitor-runner.sh" << 'EOF'
#!/bin/bash

# Runner monitoring script for Docker environment
RUNNER_DIR="/opt/github-runners"

if [ -d "$RUNNER_DIR" ]; then
    cd "$RUNNER_DIR"
    if docker-compose ps | grep -q "Up"; then
        echo "✅ Runner is running"
        docker-compose logs --tail=10
    else
        echo "❌ Runner is not running"
        docker-compose up -d
    fi
else
    echo "❌ Runner directory not found"
fi
EOF
    
    chmod +x "/opt/monitor-runner.sh"
    
    # Create cron job for monitoring (if cron is available)
    if command -v crontab &> /dev/null; then
        (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/monitor-runner.sh") | crontab -
        print_success "Cron monitoring setup completed"
    else
        print_warning "Cron not available, manual monitoring required"
    fi
    
    print_success "Monitoring setup completed"
}

# Function to display setup information
display_info() {
    print_success "Docker self-hosted runner setup completed!"
    echo
    echo "📋 Setup Information:"
    echo "  Repository: $REPO_URL"
    echo "  Runner Name: $RUNNER_NAME"
    echo "  Runner Labels: $RUNNER_LABELS"
    echo "  Runner Directory: /opt/github-runners"
    echo "  Docker Environment: $DOCKER_ENV"
    echo
    echo "🔧 Management Commands:"
    echo "  Start runner: cd /opt/github-runners && docker-compose up -d"
    echo "  Stop runner: cd /opt/github-runners && docker-compose down"
    echo "  View logs: cd /opt/github-runners && docker-compose logs -f"
    echo "  Monitor status: /opt/monitor-runner.sh"
    echo
    echo "🌐 Runner Status:"
    echo "  Health check: http://localhost:8080/health"
    echo "  GitHub: https://github.com/$REPO_OWNER/$REPO_NAME/settings/actions/runners"
    echo
    echo "🐳 Docker Commands:"
    echo "  Check containers: docker ps"
    echo "  View runner logs: docker logs github-runner"
    echo "  Restart runner: docker restart github-runner"
    echo
    echo "⚠️  Important Notes:"
    echo "  - Keep your GitHub token secure"
    echo "  - Monitor runner performance regularly"
    echo "  - Update runner software periodically"
    echo "  - Backup runner configuration"
    echo "  - Container restart will restart the runner"
}

# Function to create docker-compose override for development
create_dev_override() {
    print_status "Creating development override..."
    
    cat > "/opt/github-runners/docker-compose.override.yml" << EOF
version: '3.8'
services:
  github-runner:
    environment:
      - RUNNER_LABELS=$RUNNER_LABELS,dev,containerized
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./dev-cache:/cache
      - ./logs:/var/log/github-runner
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
EOF
    
    mkdir -p /opt/github-runners/dev-cache
    mkdir -p /opt/github-runners/logs
    
    print_success "Development override created"
}

# Main execution
main() {
    echo "🐳 Docker GitHub Actions Self-Hosted Runner Setup"
    echo "================================================"
    echo
    
    # Check Docker environment
    check_docker_environment
    
    # Check prerequisites
    check_prerequisites
    
    # Get GitHub token
    get_github_token
    
    # Ask user for runner type
    echo "Choose runner setup type:"
    echo "1. Simple Docker runner (uses host Docker socket)"
    echo "2. Docker-in-Docker runner (isolated Docker environment)"
    read -p "Enter your choice (1 or 2): " RUNNER_TYPE
    
    case $RUNNER_TYPE in
        1)
            if [ "$DOCKER_SOCKET" = true ]; then
                setup_simple_runner
            else
                print_error "Docker socket not accessible. Choose option 2 for Docker-in-Docker."
                exit 1
            fi
            ;;
        2)
            setup_dind_runner
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    # Setup monitoring
    setup_monitoring
    
    # Create development override
    create_dev_override
    
    # Display information
    display_info
}

# Run main function
main "$@" 