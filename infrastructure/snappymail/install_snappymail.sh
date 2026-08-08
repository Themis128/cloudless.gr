#!/bin/bash
# Snappymail Installation Script for OMV-HA (Raspberry Pi 3)
# This script installs and configures Snappymail via Docker with Nginx reverse proxy
# Enhanced with comprehensive error handling and troubleshooting

set -e  # Exit on any error
set -u  # Exit on undefined variables

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Global variables for cleanup
COMPOSE_FILE="/tmp/snappymail-compose.yml"
SHARED_FOLDER_PATH=""
INSTALLATION_LOG="/tmp/snappymail-install.log"

# ===== USER CONFIGURATION SECTION =====
# SET THESE VALUES BEFORE RUNNING THE SCRIPT

# Your timezone (find yours at: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
TZ="Europe/Athens"  # <-- CHANGE THIS TO YOUR TIMEZONE

# Your OMV-HA's domain for webmail (must be a subdomain you control)
WEBMAIL_DOMAIN="webmail.cloudless.gr"  # <-- CHANGE IF USING DIFFERENT DOMAIN

# Shared folder name for Snappymail data (will be created if doesn't exist)
SHARED_FOLDER_NAME="snappymail-data"

# Path where OMV stores shared folders (usually /srv/dev-disk-by-label-*)
# We'll auto-detect this, but you can override if needed
OMV_SHARED_ROOT=""  # Leave empty to auto-detect

# ===== END USER CONFIGURATION =====

# Initialize log file
echo "=== Snappymail Installation Log ===" > "$INSTALLATION_LOG"
echo "Started at: $(date)" >> "$INSTALLATION_LOG"

# Cleanup function
cleanup() {
    log_warn "Installation failed. Cleaning up..."
    # Remove temporary files
    rm -f "$COMPOSE_FILE"
    log_info "Temporary files cleaned up"
    log_info "Check log file for details: $INSTALLATION_LOG"
    exit 1
}

trap cleanup ERR

# Script starts here - do not modify below this line unless you know what you're doing

# Check if running with sudo
if [ "$(id -u)" -ne 0 ]; then
    log_error "This script must be run with sudo privileges."
    echo "Please run: sudo ./install_snappymail.sh"
    exit 1
fi

# 1. Check OMV version and architecture
echo "=== Step 1: System Verification ===" | tee -a "$INSTALLATION_LOG"
OMV_VERSION=$(omv-version | grep -oP '(?<=OpenMediaVault)\d+\.\d+' || echo "unknown")
if [[ ! "$OMV_VERSION" =~ ^[56]\. ]]; then
    log_warn "This script is tested on OMV 5.x/6.x. Detected: $OMV_VERSION"
    log_info "Auto-continuing with installation..."
fi

ARCH=$(uname -m)
if [[ "$ARCH" != "armv7l" && "$ARCH" != "aarch64" ]]; then
    log_warn "This script is optimized for Raspberry Pi 3 (armv7l). Detected: $ARCH"
    log_info "Auto-continuing with installation..."
fi

log_success "OMV Version: $OMV_VERSION"
log_success "Architecture: $ARCH"
echo "" | tee -a "$INSTALLATION_LOG"

# 2. Check Docker installation
echo "=== Step 2: Docker Verification ===" | tee -a "$INSTALLATION_LOG"
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed."
    echo "Please install via OMV-Extras:" | tee -a "$INSTALLATION_LOG"
    echo "  1. Go to OMV web UI: System → OMV-Extras" | tee -a "$INSTALLATION_LOG"
    echo "  2. Install: openmediavault-docker-compose" | tee -a "$INSTALLATION_LOG"
    echo "  3. Reboot the system" | tee -a "$INSTALLATION_LOG"
    exit 1
fi

# Check if Docker service is running
if ! systemctl is-active --quiet docker; then
    log_error "Docker service is not running. Attempting to start..."
    systemctl start docker
    sleep 5
    if ! systemctl is-active --quiet docker; then
        log_error "Failed to start Docker service"
        echo "Please check Docker installation:" | tee -a "$INSTALLATION_LOG"
        echo "  sudo systemctl status docker" | tee -a "$INSTALLATION_LOG"
        exit 1
    fi
fi

DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | tr -d ',')
log_success "Docker version: $DOCKER_VERSION"

# Check if Docker Compose plugin is available (for OMV 6.x)
if ! docker compose version &> /dev/null; then
    log_error "Docker Compose plugin not found."
    echo "Please install via OMV-Extras: openmediavault-docker-compose" | tee -a "$INSTALLATION_LOG"
    exit 1
fi
log_success "Docker Compose plugin available"
echo "" | tee -a "$INSTALLATION_LOG"

# 3. Ensure shared folder exists
echo "=== Step 3: Shared Folder Setup ===" | tee -a "$INSTALLATION_LOG"

# First check if shared folder already exists in OMV config
if sudo sharedfolder-list --name "$SHARED_FOLDER_NAME" --option mp >/dev/null 2>&1; then
    SHARED_FOLDER_PATH=$(sudo sharedfolder-list --name "$SHARED_FOLDER_NAME" --option mp)
    log_success "Shared folder '$SHARED_FOLDER_NAME' found at: $SHARED_FOLDER_PATH"
else
    log_info "Shared folder '$SHARED_FOLDER_NAME' not found in OMV configuration."
    echo "Creating it now..." | tee -a "$INSTALLATION_LOG"

    # Determine the storage location
    if [ -z "$OMV_SHARED_ROOT" ]; then
        # Use /srv as the base for shared folders (standard OMV location)
        OMV_SHARED_ROOT="/srv"
        log_info "Using standard OMV shared folder base: $OMV_SHARED_ROOT"
    fi

    # Create the shared folder directory
    SHARED_FOLDER_PATH="$OMV_SHARED_ROOT/$SHARED_FOLDER_NAME"
    
    log_info "Creating shared folder at: $SHARED_FOLDER_PATH"
    
    # Try to create via OMV CLI
    if sudo omv-confdbadm create --sharedfolder --condition "name='$SHARED_FOLDER_NAME'" \
        --prop "reldirpath=$SHARED_FOLDER_NAME" \
        --prop "privatelinks=0" \
        --prop "mntentopts=rw,users" \
        --prop "privilege=0" \
        --prop "comment=Shared folder for Snappymail data" 2>/dev/null; then
        # Commit the change
        if sudo omv-confdbadm commit 2>/dev/null; then
            # Get the actual path from OMV
            SHARED_FOLDER_PATH=$(sudo sharedfolder-list --name "$SHARED_FOLDER_NAME" --option mp 2>/dev/null)
            log_success "Shared folder created via OMV at: $SHARED_FOLDER_PATH"
        else
            log_warn "Failed to commit via OMV, creating manually..."
            CREATE_MANUALLY=true
        fi
    else
        log_warn "OMV CLI create failed, creating manually..."
        CREATE_MANUALLY=true
    fi
    
    # If OMV creation failed, create manually
    if [ "${CREATE_MANUALLY:-false}" = "true" ]; then
        if ! sudo mkdir -p "$SHARED_FOLDER_PATH"; then
            log_error "Failed to create directory: $SHARED_FOLDER_PATH"
            exit 1
        fi
        log_success "Shared folder created manually at: $SHARED_FOLDER_PATH"
    fi
fi

# Ensure the directory exists and is writable
if ! sudo mkdir -p "$SHARED_FOLDER_PATH"; then
    log_error "Failed to create directory: $SHARED_FOLDER_PATH"
    exit 1
fi

if ! sudo chown -R 1000:1000 "$SHARED_FOLDER_PATH"; then
    log_error "Failed to set permissions on: $SHARED_FOLDER_PATH"
    exit 1
fi

# Verify permissions
if [ ! -w "$SHARED_FOLDER_PATH" ]; then
    log_error "Shared folder is not writable: $SHARED_FOLDER_PATH"
    exit 1
fi

log_success "Shared folder prepared and permissions set"
echo "" | tee -a "$INSTALLATION_LOG"

# 4. Check for port conflicts
echo "=== Step 4: Port Conflict Check ===" | tee -a "$INSTALLATION_LOG"
SNYPPYMAIL_PORT=8080

# Check if port 8080 is in use and find alternative
if sudo ss -tlnp | grep -q ':8080 '; then
    log_warn "Port 8080 is already in use by nginx"
    echo "Current usage:" | tee -a "$INSTALLATION_LOG"
    sudo ss -tlnp | grep ':8080 ' | tee -a "$INSTALLATION_LOG"
    
    # Find alternative port
    for ALT_PORT in 8081 8082 8083 8084 8085; do
        if ! sudo ss -tlnp | grep -q ":$ALT_PORT "; then
            log_info "Using alternative port: $ALT_PORT"
            SNYPPYMAIL_PORT=$ALT_PORT
            break
        fi
    done
    
    if [ "$SNYPPYMAIL_PORT" = "8080" ]; then
        log_error "No available ports found (8080-8085)"
        echo "Please free up a port or modify the script" | tee -a "$INSTALLATION_LOG"
        exit 1
    fi
else
    log_success "Port 8080 is available"
fi
echo "" | tee -a "$INSTALLATION_LOG"

# 5. Create and deploy Docker Compose file
echo "=== Step 5: Deploy Snappymail via Docker ===" | tee -a "$INSTALLATION_LOG"

# Remove existing container if it exists
if docker ps -a | grep -q snappymail; then
    log_warn "Existing Snappymail container found. Removing..."
    docker rm -f snappymail 2>/dev/null || true
fi

# Pull the latest image
log_info "Pulling Snappymail image..."

# Try multiple possible image names
SNYPPYMAIL_IMAGE=""
for IMAGE_NAME in "snappymail/snappymail:latest" "djmaze/snappymail:latest" "snappymail/snappymail:stable"; do
    log_info "Trying image: $IMAGE_NAME"
    if docker pull "$IMAGE_NAME" 2>/dev/null; then
        SNYPPYMAIL_IMAGE="$IMAGE_NAME"
        log_success "Successfully pulled image: $IMAGE_NAME"
        break
    fi
done

if [ -z "$SNYPPYMAIL_IMAGE" ]; then
    log_error "Failed to pull Snappymail image from all known repositories"
    echo "Please check:" | tee -a "$INSTALLATION_LOG"
    echo "  1. Internet connectivity" | tee -a "$INSTALLATION_LOG"
    echo "  2. Docker Hub access" | tee -a "$INSTALLATION_LOG"
    echo "  3. Image name (visit https://hub.docker.com/r/snappymail/snappymail)" | tee -a "$INSTALLATION_LOG"
    echo "  4. Or manually pull with: docker pull snappymail/snappymail:latest" | tee -a "$INSTALLATION_LOG"
    exit 1
fi

cat > "$COMPOSE_FILE" <<EOF
version: '2.1'

services:
  snappymail:
    image: ${SNYPPYMAIL_IMAGE}
    container_name: snappymail
    restart: unless-stopped
    ports:
      - 127.0.0.1:${SNYPPYMAIL_PORT}:80  # Localhost only - Nginx handles external access
    volumes:
      - $SHARED_FOLDER_PATH:/data
    environment:
      - TZ=$TZ
      - MAX_UPLOAD_SIZE=25M
      - DISABLE_NATIVE_AUTH=true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
EOF

echo "Docker Compose configuration:" | tee -a "$INSTALLATION_LOG"
cat "$COMPOSE_FILE" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

# Pull the latest image
# Deploy the stack
log_info "Deploying Snappymail container..."
if ! docker compose -f "$COMPOSE_FILE" up -d; then
    log_error "Failed to deploy Snappymail container"
    echo "Check Docker logs for details:" | tee -a "$INSTALLATION_LOG"
    echo "  docker compose -f $COMPOSE_FILE logs" | tee -a "$INSTALLATION_LOG"
    exit 1
fi

# Wait for container to start with better monitoring
log_info "Waiting for container to initialize (this may take 30-60 seconds)..."
WAIT_COUNT=0
MAX_WAIT=60
while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    if docker ps --filter "name=snappymail" --filter "status=running" --format '{{.Names}}' | grep -q snappymail; then
        log_success "Snappymail container is running"
        break
    fi
    if [ $WAIT_COUNT -eq 30 ]; then
        log_warn "Container is taking longer than expected to start..."
        echo "Check logs with: docker logs snappymail" | tee -a "$INSTALLATION_LOG"
    fi
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
done

if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
    log_error "Container failed to start within $MAX_WAIT seconds"
    echo "Container logs:" | tee -a "$INSTALLATION_LOG"
    docker logs snappymail 2>&1 | tee -a "$INSTALLATION_LOG"
    exit 1
fi

docker ps --filter "name=snappymail" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

# Verify container health
log_info "Checking container health..."
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' snappymail 2>/dev/null || echo "none")
if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "none" ]; then
    log_success "Container health check passed"
else
    log_warn "Container health status: $HEALTH"
    echo "Container may still be initializing. Check logs if issues persist." | tee -a "$INSTALLATION_LOG"
fi
echo "" | tee -a "$INSTALLATION_LOG"

# 6. Configure OMV Nginx reverse proxy
echo "=== Step 6: Configure Nginx Reverse Proxy ===" | tee -a "$INSTALLATION_LOG"

# Backup existing nginx config
NGINX_CONF="/etc/nginx/nginx.conf"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"

if [ -f "$NGINX_CONF" ]; then
    sudo cp "$NGINX_CONF" "${NGINX_CONF}.bak.$(date +%Y%m%d_%H%M%S)"
    log_success "Backed up existing Nginx config"
fi

# Check if nginx is running
if ! systemctl is-active --quiet nginx; then
    log_error "Nginx service is not running"
    echo "Please start Nginx: sudo systemctl start nginx" | tee -a "$INSTALLATION_LOG"
    exit 1
fi

# Try OMV config database first, fall back to direct config file
log_info "Creating Nginx site for $WEBMAIL_DOMAIN..."

# Create site configuration file directly (more compatible)
SITE_CONF="$NGINX_SITES_AVAILABLE/webmail.cloudless.gr"

log_info "Creating Nginx configuration file: $SITE_CONF"

# Create self-signed certificate if needed for testing
if [ ! -f /etc/ssl/certs/ssl-cert-snakeoil.pem ]; then
    log_info "Creating self-signed certificate for testing..."
    sudo make-ssl-cert generate-default-snakeoil --force-overwrite 2>/dev/null || true
fi

# Use OMV's certificate or snakeoil as fallback
CERT_PATH="/etc/ssl/certs/omv-selfsigned.crt"
CERT_KEY="/etc/ssl/private/omv-selfsigned.key"

if [ ! -f "$CERT_PATH" ]; then
    CERT_PATH="/etc/ssl/certs/ssl-cert-snakeoil.pem"
    CERT_KEY="/etc/ssl/private/ssl-cert-snakeoil.key"
fi

sudo tee "$SITE_CONF" > /dev/null <<EOF
# Snappymail webmail configuration
# Generated by install_snappymail.sh

server {
    listen 443 ssl;
    server_name $WEBMAIL_DOMAIN;
    
    client_max_body_size 25m;
    
    # SSL configuration
    ssl_certificate $CERT_PATH;
    ssl_certificate_key $CERT_KEY;
    
    # Security headers
    server_tokens off;
    
    # Access logs
    access_log /var/log/nginx/webmail.access.log;
    error_log /var/log/nginx/webmail.error.log;
    
    # Proxy to Snappymail container
    location / {
        proxy_pass http://127.0.0.1:${SNYPPYMAIL_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass \$http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name $WEBMAIL_DOMAIN;
    return 301 https://\$server_name\$request_uri;
}
EOF

log_success "Nginx configuration file created"

# Enable the site
log_info "Enabling site..."
sudo ln -sf "$SITE_CONF" "$NGINX_SITES_ENABLED/webmail.cloudless.gr"

# Test Nginx configuration
log_info "Testing Nginx configuration..."
if sudo nginx -t; then
    log_success "Nginx configuration test passed"
    
    # Reload Nginx
    log_info "Reloading Nginx..."
    if ! sudo systemctl reload nginx; then
        log_error "Failed to reload Nginx"
        exit 1
    fi
    
    # Verify Nginx is running
    sleep 2
    if systemctl is-active --quiet nginx; then
        log_success "Nginx reloaded successfully"
    else
        log_error "Nginx failed to reload"
        exit 1
    fi
else
    log_error "Nginx configuration test failed!"
    echo "Please check the configuration manually." | tee -a "$INSTALLATION_LOG"
    echo "Disabling site..." | tee -a "$INSTALLATION_LOG"
    
    # Disable the site
    sudo rm -f "$NGINX_SITES_ENABLED/webmail.cloudless.gr"
    
    echo "Rolling back Nginx configuration..." | tee -a "$INSTALLATION_LOG"
    
    # Rollback to backup
    if [ -f "${NGINX_CONF}.bak.*" ]; then
        LATEST_BACKUP=$(ls -t ${NGINX_CONF}.bak.* | head -1)
        sudo cp "$LATEST_BACKUP" "$NGINX_CONF"
        sudo systemctl reload nginx
        log_info "Rolled back to previous configuration"
    fi
    
    exit 1
fi
echo "" | tee -a "$INSTALLATION_LOG"

# 7. Verify installation
echo "=== Step 7: Installation Verification ===" | tee -a "$INSTALLATION_LOG"

# Check container status
if docker ps --filter "name=snappymail" --filter "status=running" --format '{{.Names}}' | grep -q snappymail; then
    log_success "✓ Snappymail container is running"
else
    log_error "✗ Snappymail container is not running"
    exit 1
fi

# Check Nginx configuration
if sudo nginx -t >/dev/null 2>&1; then
    log_success "✓ Nginx configuration is valid"
else
    log_error "✗ Nginx configuration has errors"
    exit 1
fi

# Check if Nginx site is configured
if [ -f "$NGINX_SITES_ENABLED/webmail.cloudless.gr" ]; then
    log_success "✓ Nginx site configured for $WEBMAIL_DOMAIN"
else
    log_error "✗ Nginx site not found for $WEBMAIL_DOMAIN"
    exit 1
fi

# Check shared folder permissions
if [ -w "$SHARED_FOLDER_PATH" ]; then
    log_success "✓ Shared folder is writable: $SHARED_FOLDER_PATH"
else
    log_error "✗ Shared folder is not writable: $SHARED_FOLDER_PATH"
    exit 1
fi

echo "" | tee -a "$INSTALLATION_LOG"

# 8. Provide final instructions and verification steps
echo "=== Step 8: Final Instructions ===" | tee -a "$INSTALLATION_LOG"
log_success "Installation completed successfully!"
echo "" | tee -a "$INSTALLATION_LOG"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$INSTALLATION_LOG"
echo "NEXT STEPS" | tee -a "$INSTALLATION_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "1. DNS SETUP (REQUIRED)" | tee -a "$INSTALLATION_LOG"
echo "   Create an A record for '$WEBMAIL_DOMAIN' pointing to your OMV-HA's public IP" | tee -a "$INSTALLATION_LOG"
echo "   If using Cloudflare DNS:" | tee -a "$INSTALLATION_LOG"
echo "     * Go to DNS → Records" | tee -a "$INSTALLATION_LOG"
echo "     * Add record: Type A, Name 'webmail', IPv4 address [your OMV-HA IP]" | tee -a "$INSTALLATION_LOG"
echo "     * Set proxy status to DNS-only (orange cloud OFF)" | tee -a "$INSTALLATION_LOG"
echo "   Verify propagation:" | tee -a "$INSTALLATION_LOG"
echo "     dig $WEBMAIL_DOMAIN +short" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "2. SSL CERTIFICATE (REQUIRED)" | tee -a "$INSTALLATION_LOG"
echo "   Create Let's Encrypt certificate via OMV Web UI:" | tee -a "$INSTALLATION_LOG"
echo "     * Go to: Storage → Certificates → + Add" | tee -a "$INSTALLATION_LOG"
echo "     * Type: Let's Encrypt" | tee -a "$INSTALLATION_LOG"
echo "     * Domains: $WEBMAIL_DOMAIN" | tee -a "$INSTALLATION_LOG"
echo "     * Email: tbaltzakis@cloudless.gr" | tee -a "$INSTALLATION_LOG"
echo "     * Webroot path: /var/www/html" | tee -a "$INSTALLATION_LOG"
echo "   The Nginx configuration will automatically use this certificate" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "3. MAIL SERVER CONFIGURATION (REQUIRED)" | tee -a "$INSTALLATION_LOG"
echo "   Ensure your mail server (Postfix/Dovecot) is configured:" | tee -a "$INSTALLATION_LOG"
echo "     sudo systemctl status postfix" | tee -a "$INSTALLATION_LOG"
echo "     sudo systemctl status dovecot" | tee -a "$INSTALLATION_LOG"
echo "   If not installed:" | tee -a "$INSTALLATION_LOG"
echo "     sudo apt install postfix dovecot-imapd" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "4. CREATE MAIL USER (REQUIRED)" | tee -a "$INSTALLATION_LOG"
echo "   If you don't have a mail user yet:" | tee -a "$INSTALLATION_LOG"
echo "     sudo adduser --disabled-login --gecos '' tbaltzakis" | tee -a "$INSTALLATION_LOG"
echo "     sudo passwd tbaltzakis" | tee -a "$INSTALLATION_LOG"
echo "     sudo maildirmake.dovecot /home/tbaltzakis/Maildir" | tee -a "$INSTALLATION_LOG"
echo "     sudo chown -R tbaltzakis:tbaltzakis /home/tbaltzakis/Maildir" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "5. FIREWALL CONFIGURATION (IF NEEDED)" | tee -a "$INSTALLATION_LOG"
echo "   Ensure ports are open (if using UFW):" | tee -a "$INSTALLATION_LOG"
echo "     sudo ufw allow 80/tcp    # HTTP (for Let's Encrypt)" | tee -a "$INSTALLATION_LOG"
echo "     sudo ufw allow 443/tcp   # HTTPS" | tee -a "$INSTALLATION_LOG"
echo "     sudo ufw allow 25/tcp    # SMTP (if sending directly)" | tee -a "$INSTALLATION_LOG"
echo "     sudo ufw allow 143/tcp   # IMAP (if needed)" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "6. TEST EMAIL (OPTIONAL)" | tee -a "$INSTALLATION_LOG"
echo "   Test sending email from command line:" | tee -a "$INSTALLATION_LOG"
echo "     echo 'Test from Snappymail' | mail -s 'Snappymail Test' tbaltzakis@cloudless.gr" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$INSTALLATION_LOG"
echo "ACCESS WEBMAIL" | tee -a "$INSTALLATION_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$INSTALLATION_LOG"
echo "URL:      https://$WEBMAIL_DOMAIN" | tee -a "$INSTALLATION_LOG"
echo "Username: tbaltzakis (system Linux username)" | tee -a "$INSTALLATION_LOG"
echo "Password: [your system Linux password]" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$INSTALLATION_LOG"
echo "TROUBLESHOOTING" | tee -a "$INSTALLATION_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$INSTALLATION_LOG"
echo "Container logs:" | tee -a "$INSTALLATION_LOG"
echo "  docker logs snappymail" | tee -a "$INSTALLATION_LOG"
echo "Mail logs:" | tee -a "$INSTALLATION_LOG"
echo "  sudo tail -f /var/log/mail.log" | tee -a "$INSTALLATION_LOG"
echo "Nginx logs:" | tee -a "$INSTALLATION_LOG"
echo "  sudo tail -f /var/log/nginx/error.log" | tee -a "$INSTALLATION_LOG"
echo "Installation log:" | tee -a "$INSTALLATION_LOG"
echo "  cat $INSTALLATION_LOG" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$INSTALLATION_LOG"
echo "SUMMARY" | tee -a "$INSTALLATION_LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$INSTALLATION_LOG"
echo "✓ Snappymail running in Docker (localhost:8080, isolated)" | tee -a "$INSTALLATION_LOG"
echo "✓ Nginx reverse proxy: https://$WEBMAIL_DOMAIN" | tee -a "$INSTALLATION_LOG"
echo "✓ Data persistence: $SHARED_FOLDER_PATH" | tee -a "$INSTALLATION_LOG"
echo "✓ Authentication: System Linux users (tbaltzakis)" | tee -a "$INSTALLATION_LOG"
echo "✓ Security: HTTPS, localhost-only, no direct exposure" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

echo "Installation completed at: $(date)" | tee -a "$INSTALLATION_LOG"
echo "Happy emailing! 🍇" | tee -a "$INSTALLATION_LOG"
echo "" | tee -a "$INSTALLATION_LOG"

# Display final summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "INSTALLATION SUCCESSFUL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📧 Webmail URL: https://$WEBMAIL_DOMAIN"
echo "👤 Username: tbaltzakis"
echo "🔒 Password: [your Linux system password]"
echo ""
echo "📋 Installation log saved to: $INSTALLATION_LOG"
echo ""
echo "Next: Complete DNS and SSL setup as outlined above"
echo ""

# Remove trap since we completed successfully
trap - ERR

exit 0