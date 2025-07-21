#!/bin/bash

# Self-Hosted Runner Setup Script
# This script sets up a GitHub Actions self-hosted runner for cloudless.gr

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
RUNNER_NAME="cloudless-runner-$(hostname)"
RUNNER_LABELS="linux,docker,self-hosted"

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

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root"
        exit 1
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not found. Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        sudo usermod -aG docker $USER
        print_success "Docker installed successfully"
    else
        print_success "Docker is already installed"
    fi
    
    # Check if docker-compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_warning "docker-compose not found. Installing..."
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        print_success "docker-compose installed successfully"
    else
        print_success "docker-compose is already installed"
    fi
    
    # Check available disk space (minimum 20GB)
    AVAILABLE_SPACE=$(df . | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=20971520  # 20GB in KB
    
    if [ $AVAILABLE_SPACE -lt $REQUIRED_SPACE ]; then
        print_error "Insufficient disk space. Need at least 20GB, available: $(($AVAILABLE_SPACE / 1024 / 1024))GB"
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

# Function to setup Docker-based runner
setup_docker_runner() {
    print_status "Setting up Docker-based runner..."
    
    # Create runner directory
    RUNNER_DIR="$HOME/github-runners"
    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"
    
    # Create docker-compose.yml
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

# Function to setup native runner
setup_native_runner() {
    print_status "Setting up native runner..."
    
    # Create runner directory
    RUNNER_DIR="$HOME/github-runner"
    mkdir -p "$RUNNER_DIR"
    cd "$RUNNER_DIR"
    
    # Download runner
    print_status "Downloading GitHub Actions runner..."
    curl -o actions-runner-linux-x64-$RUNNER_VERSION.tar.gz \
         -L https://github.com/actions/runner/releases/download/v$RUNNER_VERSION/actions-runner-linux-x64-$RUNNER_VERSION.tar.gz
    
    # Extract runner
    print_status "Extracting runner..."
    tar xzf ./actions-runner-linux-x64-$RUNNER_VERSION.tar.gz
    
    # Configure runner
    print_status "Configuring runner..."
    ./config.sh --url $REPO_URL \
                --token $GITHUB_TOKEN \
                --name $RUNNER_NAME \
                --labels $RUNNER_LABELS \
                --unattended \
                --replace
    
    # Install service
    print_status "Installing runner service..."
    sudo ./svc.sh install $USER
    sudo ./svc.sh start
    
    print_success "Native runner setup completed"
}

# Function to setup monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."
    
    # Create monitoring script
    cat > "$HOME/monitor-runner.sh" << 'EOF'
#!/bin/bash

# Runner monitoring script
RUNNER_DIR="$HOME/github-runners"

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
    
    chmod +x "$HOME/monitor-runner.sh"
    
    # Create systemd service for monitoring
    sudo tee /etc/systemd/system/github-runner-monitor.service > /dev/null << EOF
[Unit]
Description=GitHub Runner Monitor
After=network.target

[Service]
Type=oneshot
ExecStart=$HOME/monitor-runner.sh
User=$USER

[Install]
WantedBy=multi-user.target
EOF
    
    # Enable and start monitoring service
    sudo systemctl enable github-runner-monitor.service
    sudo systemctl start github-runner-monitor.service
    
    print_success "Monitoring setup completed"
}

# Function to display setup information
display_info() {
    print_success "Self-hosted runner setup completed!"
    echo
    echo "📋 Setup Information:"
    echo "  Repository: $REPO_URL"
    echo "  Runner Name: $RUNNER_NAME"
    echo "  Runner Labels: $RUNNER_LABELS"
    echo "  Runner Directory: $HOME/github-runners"
    echo
    echo "🔧 Management Commands:"
    echo "  Start runner: cd $HOME/github-runners && docker-compose up -d"
    echo "  Stop runner: cd $HOME/github-runners && docker-compose down"
    echo "  View logs: cd $HOME/github-runners && docker-compose logs -f"
    echo "  Monitor status: $HOME/monitor-runner.sh"
    echo
    echo "🌐 Runner Status:"
    echo "  Health check: http://localhost:8080/health"
    echo "  GitHub: https://github.com/$REPO_OWNER/$REPO_NAME/settings/actions/runners"
    echo
    echo "⚠️  Important Notes:"
    echo "  - Keep your GitHub token secure"
    echo "  - Monitor runner performance regularly"
    echo "  - Update runner software periodically"
    echo "  - Backup runner configuration"
}

# Main execution
main() {
    echo "🚀 GitHub Actions Self-Hosted Runner Setup"
    echo "=========================================="
    echo
    
    # Check prerequisites
    check_prerequisites
    
    # Get GitHub token
    get_github_token
    
    # Ask user for runner type
    echo "Choose runner type:"
    echo "1. Docker-based runner (recommended)"
    echo "2. Native runner"
    read -p "Enter your choice (1 or 2): " RUNNER_TYPE
    
    case $RUNNER_TYPE in
        1)
            setup_docker_runner
            ;;
        2)
            setup_native_runner
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    # Setup monitoring
    setup_monitoring
    
    # Display information
    display_info
}

# Run main function
main "$@" 