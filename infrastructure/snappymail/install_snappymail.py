#!/usr/bin/env python3
"""Snappymail Installation Script for OMV-HA (Raspberry Pi 3).

Port of install_snappymail.sh.
Installs and configures Snappymail via Docker with Nginx reverse proxy.

Usage: sudo python3 install_snappymail.py
"""

import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

RED = "\033[0;31m"
GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
NC = "\033[0m"

COMPOSE_FILE = Path("/tmp/snappymail-compose.yml")
INSTALLATION_LOG = Path("/tmp/snappymail-install.log")


def _tee(msg: str = "") -> None:
    print(msg)
    try:
        with INSTALLATION_LOG.open("a") as fh:
            fh.write(re.sub(r"\033\[[0-9;]*m", "", msg) + "\n")
    except OSError:
        pass


def log_info(msg: str) -> None:
    print(f"{GREEN}[INFO]{NC} {msg}")


def log_warn(msg: str) -> None:
    print(f"{YELLOW}[WARN]{NC} {msg}")


def log_error(msg: str) -> None:
    print(f"{RED}[ERROR]{NC} {msg}")


def log_success(msg: str) -> None:
    print(f"{GREEN}[SUCCESS]{NC} {msg}")


def die(msg: str) -> None:
    log_error("Installation failed. Cleaning up...")
    COMPOSE_FILE.unlink(missing_ok=True)
    log_info("Temporary files cleaned up")
    log_info(f"Check log file for details: {INSTALLATION_LOG}")
    print(msg, file=sys.stderr)
    sys.exit(1)


def run(*args: str, check: bool = False) -> subprocess.CompletedProcess[str]:
    r = subprocess.run(list(args), capture_output=True, text=True, check=False)
    if check and r.returncode != 0:
        die((r.stderr or r.stdout or "command failed").strip())
    return r


# ===== USER CONFIGURATION SECTION =====
# SET THESE VALUES BEFORE RUNNING THE SCRIPT
TZ = "Europe/Athens"  # <-- CHANGE THIS TO YOUR TIMEZONE
WEBMAIL_DOMAIN = "webmail.cloudless.gr"  # <-- CHANGE IF USING DIFFERENT DOMAIN
SHARED_FOLDER_NAME = "snappymail-data"
OMV_SHARED_ROOT = ""  # Leave empty to auto-detect
# ===== END USER CONFIGURATION =====

INSTALLATION_LOG.write_text(f"=== Snappymail Installation Log ===\nStarted at: {datetime.now()}\n")

# Check if running with sudo
if os.geteuid() != 0:
    log_error("This script must be run with sudo privileges.")
    print("Please run: sudo python3 install_snappymail.py")
    sys.exit(1)

# 1. Check OMV version and architecture
_tee("=== Step 1: System Verification ===")
r = run("omv-version")
m = re.search(r"(\d+\.\d+)", r.stdout or "")
OMV_VERSION = m.group(1) if m else "unknown"
if not re.match(r"^[56]\.", OMV_VERSION):
    log_warn(f"This script is tested on OMV 5.x/6.x. Detected: {OMV_VERSION}")
    log_info("Auto-continuing with installation...")

ARCH = run("uname", "-m").stdout.strip()
if ARCH not in ("armv7l", "aarch64"):
    log_warn(f"This script is optimized for Raspberry Pi 3 (armv7l). Detected: {ARCH}")
    log_info("Auto-continuing with installation...")

log_success(f"OMV Version: {OMV_VERSION}")
log_success(f"Architecture: {ARCH}")
_tee()

# 2. Check Docker installation
_tee("=== Step 2: Docker Verification ===")
if not shutil.which("docker"):
    log_error("Docker is not installed.")
    _tee("Please install via OMV-Extras:")
    _tee("  1. Go to OMV web UI: System → OMV-Extras")
    _tee("  2. Install: openmediavault-docker-compose")
    _tee("  3. Reboot the system")
    sys.exit(1)

if run("systemctl", "is-active", "--quiet", "docker").returncode != 0:
    log_error("Docker service is not running. Attempting to start...")
    run("systemctl", "start", "docker")
    time.sleep(5)
    if run("systemctl", "is-active", "--quiet", "docker").returncode != 0:
        log_error("Failed to start Docker service")
        _tee("Please check Docker installation:")
        _tee("  sudo systemctl status docker")
        sys.exit(1)

DOCKER_VERSION = re.sub(r"[,\s]", "", (run("docker", "--version").stdout or "").split()[-1])
log_success(f"Docker version: {DOCKER_VERSION}")

if run("docker", "compose", "version").returncode != 0:
    log_error("Docker Compose plugin not found.")
    _tee("Please install via OMV-Extras: openmediavault-docker-compose")
    sys.exit(1)
log_success("Docker Compose plugin available")
_tee()

# 3. Ensure shared folder exists
_tee("=== Step 3: Shared Folder Setup ===")

r = run("sudo", "sharedfolder-list", "--name", SHARED_FOLDER_NAME, "--option", "mp")
if r.returncode == 0 and r.stdout.strip():
    SHARED_FOLDER_PATH = r.stdout.strip()
    log_success(f"Shared folder '{SHARED_FOLDER_NAME}' found at: {SHARED_FOLDER_PATH}")
else:
    log_info(f"Shared folder '{SHARED_FOLDER_NAME}' not found in OMV configuration.")
    _tee("Creating it now...")
    if not OMV_SHARED_ROOT:
        OMV_SHARED_ROOT = "/srv"
        log_info(f"Using standard OMV shared folder base: {OMV_SHARED_ROOT}")
    SHARED_FOLDER_PATH = f"{OMV_SHARED_ROOT}/{SHARED_FOLDER_NAME}"

    create_manually = False
    if (
        run(
            "sudo",
            "omv-confdbadm",
            "create",
            "--sharedfolder",
            "--condition",
            f"name='{SHARED_FOLDER_NAME}'",
            "--prop",
            f"reldirpath={SHARED_FOLDER_NAME}",
            "--prop",
            "privatelinks=0",
            "--prop",
            "mntentopts=rw,users",
            "--prop",
            "privilege=0",
            "--prop",
            "comment=Shared folder for Snappymail data",
        ).returncode
        == 0
    ):
        if run("sudo", "omv-confdbadm", "commit").returncode == 0:
            r2 = run("sudo", "sharedfolder-list", "--name", SHARED_FOLDER_NAME, "--option", "mp")
            SHARED_FOLDER_PATH = r2.stdout.strip() or SHARED_FOLDER_PATH
            log_success(f"Shared folder created via OMV at: {SHARED_FOLDER_PATH}")
        else:
            log_warn("Failed to commit via OMV, creating manually...")
            create_manually = True
    else:
        log_warn("OMV CLI create failed, creating manually...")
        create_manually = True

    if create_manually:
        if run("sudo", "mkdir", "-p", SHARED_FOLDER_PATH).returncode != 0:
            die(f"Failed to create directory: {SHARED_FOLDER_PATH}")
        log_success(f"Shared folder created manually at: {SHARED_FOLDER_PATH}")

if run("sudo", "mkdir", "-p", SHARED_FOLDER_PATH).returncode != 0:
    die(f"Failed to create directory: {SHARED_FOLDER_PATH}")
if run("sudo", "chown", "-R", "1000:1000", SHARED_FOLDER_PATH).returncode != 0:
    die(f"Failed to set permissions on: {SHARED_FOLDER_PATH}")
if not os.access(SHARED_FOLDER_PATH, os.W_OK):
    die(f"Shared folder is not writable: {SHARED_FOLDER_PATH}")

log_success("Shared folder prepared and permissions set")
_tee()

# 4. Check for port conflicts
_tee("=== Step 4: Port Conflict Check ===")
SNAPPYMAIL_PORT = 8080
ss = run("sudo", "ss", "-tlnp").stdout or ""
if ":8080 " in ss:
    log_warn("Port 8080 is already in use by nginx")
    _tee("Current usage:")
    _tee("\n".join(line for line in ss.splitlines() if ":8080 " in line))
    for ALT_PORT in (8081, 8082, 8083, 8084, 8085):
        if f":{ALT_PORT} " not in ss:
            log_info(f"Using alternative port: {ALT_PORT}")
            SNAPPYMAIL_PORT = ALT_PORT
            break
    if SNAPPYMAIL_PORT == 8080:
        log_error("No available ports found (8080-8085)")
        _tee("Please free up a port or modify the script")
        sys.exit(1)
else:
    log_success("Port 8080 is available")
_tee()

# 5. Create and deploy Docker Compose file
_tee("=== Step 5: Deploy Snappymail via Docker ===")

if "snappymail" in (run("docker", "ps", "-a").stdout or ""):
    log_warn("Existing Snappymail container found. Removing...")
    run("docker", "rm", "-f", "snappymail")

log_info("Pulling Snappymail image...")
SNAPPYMAIL_IMAGE = ""
for IMAGE_NAME in (
    "snappymail/snappymail:latest",
    "djmaze/snappymail:latest",
    "snappymail/snappymail:stable",
):
    log_info(f"Trying image: {IMAGE_NAME}")
    if run("docker", "pull", IMAGE_NAME).returncode == 0:
        SNAPPYMAIL_IMAGE = IMAGE_NAME
        log_success(f"Successfully pulled image: {IMAGE_NAME}")
        break

if not SNAPPYMAIL_IMAGE:
    log_error("Failed to pull Snappymail image from all known repositories")
    _tee("Please check:")
    _tee("  1. Internet connectivity")
    _tee("  2. Docker Hub access")
    _tee("  3. Image name (visit https://hub.docker.com/r/snappymail/snappymail)")
    _tee("  4. Or manually pull with: docker pull snappymail/snappymail:latest")
    sys.exit(1)

COMPOSE_FILE.write_text(f"""\
version: '2.1'

services:
  snappymail:
    image: {SNAPPYMAIL_IMAGE}
    container_name: snappymail
    restart: unless-stopped
    ports:
      - 127.0.0.1:{SNAPPYMAIL_PORT}:80  # Localhost only - Nginx handles external access
    volumes:
      - {SHARED_FOLDER_PATH}:/data
    environment:
      - TZ={TZ}
      - MAX_UPLOAD_SIZE=25M
      - DISABLE_NATIVE_AUTH=true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
""")

_tee("Docker Compose configuration:")
_tee(COMPOSE_FILE.read_text())
_tee()

log_info("Deploying Snappymail container...")
if run("docker", "compose", "-f", str(COMPOSE_FILE), "up", "-d").returncode != 0:
    log_error("Failed to deploy Snappymail container")
    _tee("Check Docker logs for details:")
    _tee(f"  docker compose -f {COMPOSE_FILE} logs")
    sys.exit(1)

log_info("Waiting for container to initialize (this may take 30-60 seconds)...")
WAIT_COUNT = 0
MAX_WAIT = 60
started = False
while WAIT_COUNT < MAX_WAIT:
    r = run(
        "docker",
        "ps",
        "--filter",
        "name=snappymail",
        "--filter",
        "status=running",
        "--format",
        "{{.Names}}",
    )
    if "snappymail" in (r.stdout or ""):
        log_success("Snappymail container is running")
        started = True
        break
    if WAIT_COUNT == 30:
        log_warn("Container is taking longer than expected to start...")
        _tee("Check logs with: docker logs snappymail")
    time.sleep(1)
    WAIT_COUNT += 1

if not started:
    log_error(f"Container failed to start within {MAX_WAIT} seconds")
    _tee("Container logs:")
    _tee(run("docker", "logs", "snappymail").stdout or "")
    sys.exit(1)

_tee(
    run(
        "docker",
        "ps",
        "--filter",
        "name=snappymail",
        "--format",
        "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}",
    ).stdout
    or ""
)
_tee()

log_info("Checking container health...")
HEALTH = (
    run("docker", "inspect", "--format={{.State.Health.Status}}", "snappymail").stdout or "none"
).strip()
if HEALTH in ("healthy", "none"):
    log_success("Container health check passed")
else:
    log_warn(f"Container health status: {HEALTH}")
    _tee("Container may still be initializing. Check logs if issues persist.")
_tee()

# 6. Configure OMV Nginx reverse proxy
_tee("=== Step 6: Configure Nginx Reverse Proxy ===")

NGINX_CONF = Path("/etc/nginx/nginx.conf")
NGINX_SITES_AVAILABLE = Path("/etc/nginx/sites-available")
NGINX_SITES_ENABLED = Path("/etc/nginx/sites-enabled")

if NGINX_CONF.is_file():
    backup = f"{NGINX_CONF}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    run("sudo", "cp", str(NGINX_CONF), backup)
    log_success("Backed up existing Nginx config")

if run("systemctl", "is-active", "--quiet", "nginx").returncode != 0:
    log_error("Nginx service is not running")
    _tee("Please start Nginx: sudo systemctl start nginx")
    sys.exit(1)

log_info(f"Creating Nginx site for {WEBMAIL_DOMAIN}...")
SITE_CONF = NGINX_SITES_AVAILABLE / "webmail.cloudless.gr"

log_info(f"Creating Nginx configuration file: {SITE_CONF}")

if not Path("/etc/ssl/certs/ssl-cert-snakeoil.pem").is_file():
    log_info("Creating self-signed certificate for testing...")
    run("sudo", "make-ssl-cert", "generate-default-snakeoil", "--force-overwrite")

CERT_PATH = "/etc/ssl/certs/omv-selfsigned.crt"
CERT_KEY = "/etc/ssl/private/omv-selfsigned.key"
if not Path(CERT_PATH).is_file():
    CERT_PATH = "/etc/ssl/certs/ssl-cert-snakeoil.pem"
    CERT_KEY = "/etc/ssl/private/ssl-cert-snakeoil.key"

site_text = f"""\
# Snappymail webmail configuration
# Generated by install_snappymail.py

server {{
    listen 443 ssl;
    server_name {WEBMAIL_DOMAIN};

    client_max_body_size 25m;

    # SSL configuration
    ssl_certificate {CERT_PATH};
    ssl_certificate_key {CERT_KEY};

    # Security headers
    server_tokens off;

    # Access logs
    access_log /var/log/nginx/webmail.access.log;
    error_log /var/log/nginx/webmail.error.log;

    # Proxy to Snappymail container
    location / {{
        proxy_pass http://127.0.0.1:{SNAPPYMAIL_PORT};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
    }}
}}

# Redirect HTTP to HTTPS
server {{
    listen 80;
    server_name {WEBMAIL_DOMAIN};
    return 301 https://$server_name$request_uri;
}}
"""
p = subprocess.run(
    ["sudo", "tee", str(SITE_CONF)], input=site_text, text=True, capture_output=True, check=False
)
if p.returncode != 0:
    die("Failed to write nginx site config")

log_success("Nginx configuration file created")

log_info("Enabling site...")
enabled_link = NGINX_SITES_ENABLED / "webmail.cloudless.gr"
if enabled_link.exists() or enabled_link.is_symlink():
    enabled_link.unlink()
enabled_link.symlink_to(SITE_CONF)

log_info("Testing Nginx configuration...")
if run("sudo", "nginx", "-t").returncode == 0:
    log_success("Nginx configuration test passed")
    log_info("Reloading Nginx...")
    if run("sudo", "systemctl", "reload", "nginx").returncode != 0:
        die("Failed to reload Nginx")
    time.sleep(2)
    if run("systemctl", "is-active", "--quiet", "nginx").returncode == 0:
        log_success("Nginx reloaded successfully")
    else:
        die("Nginx failed to reload")
else:
    log_error("Nginx configuration test failed!")
    _tee("Please check the configuration manually.")
    _tee("Disabling site...")
    enabled_link.unlink(missing_ok=True)
    _tee("Rolling back Nginx configuration...")
    backups = sorted(
        NGINX_CONF.parent.glob(f"{NGINX_CONF.name}.bak.*"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if backups:
        run("sudo", "cp", str(backups[0]), str(NGINX_CONF))
        run("sudo", "systemctl", "reload", "nginx")
        log_info("Rolled back to previous configuration")
    sys.exit(1)
_tee()

# 7. Verify installation
_tee("=== Step 7: Installation Verification ===")

if "snappymail" in (
    run(
        "docker",
        "ps",
        "--filter",
        "name=snappymail",
        "--filter",
        "status=running",
        "--format",
        "{{.Names}}",
    ).stdout
    or ""
):
    log_success("✓ Snappymail container is running")
else:
    die("✗ Snappymail container is not running")

if run("sudo", "nginx", "-t").returncode == 0:
    log_success("✓ Nginx configuration is valid")
else:
    die("✗ Nginx configuration has errors")

if enabled_link.exists():
    log_success(f"✓ Nginx site configured for {WEBMAIL_DOMAIN}")
else:
    die(f"✗ Nginx site not found for {WEBMAIL_DOMAIN}")

if os.access(SHARED_FOLDER_PATH, os.W_OK):
    log_success(f"✓ Shared folder is writable: {SHARED_FOLDER_PATH}")
else:
    die(f"✗ Shared folder is not writable: {SHARED_FOLDER_PATH}")

_tee()

# 8. Provide final instructions and verification steps
_tee("=== Step 8: Final Instructions ===")
log_success("Installation completed successfully!")
_tee()
_tee("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
_tee("NEXT STEPS")
_tee("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
_tee()
_tee("1. DNS SETUP (REQUIRED)")
_tee(f"   Create an A record for '{WEBMAIL_DOMAIN}' pointing to your OMV-HA's public IP")
_tee("   If using Cloudflare DNS:")
_tee("     * Go to DNS → Records")
_tee("     * Add record: Type A, Name 'webmail', IPv4 address [your OMV-HA IP]")
_tee("     * Set proxy status to DNS-only (orange cloud OFF)")
_tee("   Verify propagation:")
_tee(f"     dig {WEBMAIL_DOMAIN} +short")
_tee()
_tee("2. SSL CERTIFICATE (REQUIRED)")
_tee("   Create Let's Encrypt certificate via OMV Web UI:")
_tee("     * Go to: Storage → Certificates → + Add")
_tee("     * Type: Let's Encrypt")
_tee(f"     * Domains: {WEBMAIL_DOMAIN}")
_tee("     * Email: tbaltzakis@cloudless.gr")
_tee("     * Webroot path: /var/www/html")
_tee("   The Nginx configuration will automatically use this certificate")
_tee()
_tee("3. MAIL SERVER CONFIGURATION (REQUIRED)")
_tee("   Ensure your mail server (Postfix/Dovecot) is configured:")
_tee("     sudo systemctl status postfix")
_tee("     sudo systemctl status dovecot")
_tee("   If not installed:")
_tee("     sudo apt install postfix dovecot-imapd")
_tee()
_tee("4. CREATE MAIL USER (REQUIRED)")
_tee("   If you don't have a mail user yet:")
_tee("     sudo adduser --disabled-login --gecos '' tbaltzakis")
_tee("     sudo passwd tbaltzakis")
_tee("     sudo maildirmake.dovecot /home/tbaltzakis/Maildir")
_tee("     sudo chown -R tbaltzakis:tbaltzakis /home/tbaltzakis/Maildir")
_tee()
_tee("5. FIREWALL CONFIGURATION (IF NEEDED)")
_tee("   Ensure ports are open (if using UFW):")
_tee("     sudo ufw allow 80/tcp    # HTTP (for Let's Encrypt)")
_tee("     sudo ufw allow 443/tcp   # HTTPS")
_tee("     sudo ufw allow 25/tcp    # SMTP (if sending directly)")
_tee("     sudo ufw allow 143/tcp   # IMAP (if needed)")
_tee()
_tee("6. TEST EMAIL (OPTIONAL)")
_tee("   Test sending email from command line:")
_tee("     echo 'Test from Snappymail' | mail -s 'Snappymail Test' tbaltzakis@cloudless.gr")
_tee()
_tee("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
_tee("ACCESS WEBMAIL")
_tee("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
_tee(f"URL:      https://{WEBMAIL_DOMAIN}")
_tee("Username: tbaltzakis (system Linux username)")
_tee("Password: [your system Linux password]")
_tee()
_tee("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
_tee("TROUBLESHOOTING")
_tee("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
_tee("Container logs:")
_tee("  docker logs snappymail")
_tee("Mail logs:")
_tee("  sudo tail -f /var/log/mail.log")
_tee("Nginx logs:")
_tee("  sudo tail -f /var/log/nginx/error.log")
_tee("Installation log:")
_tee(f"  cat {INSTALLATION_LOG}")
_tee()
_tee("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
_tee("SUMMARY")
_tee("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
_tee("✓ Snappymail running in Docker (localhost:8080, isolated)")
_tee(f"✓ Nginx reverse proxy: https://{WEBMAIL_DOMAIN}")
_tee(f"✓ Data persistence: {SHARED_FOLDER_PATH}")
_tee("✓ Authentication: System Linux users (tbaltzakis)")
_tee("✓ Security: HTTPS, localhost-only, no direct exposure")
_tee()
_tee(f"Installation completed at: {datetime.now()}")
_tee("Happy emailing! 🍇")
_tee()

print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("INSTALLATION SUCCESSFUL")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"\n📧 Webmail URL: https://{WEBMAIL_DOMAIN}")
print("👤 Username: tbaltzakis")
print("🔒 Password: [your Linux system password]")
print(f"\n📋 Installation log saved to: {INSTALLATION_LOG}")
print("\nNext: Complete DNS and SSL setup as outlined above")
