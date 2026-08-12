# Snappymail Installation - OMV-HA

Webmail client deployed on OMV-HA node (Raspberry Pi 3) for the cloudless.gr infrastructure.

## Overview

- **Application**: Snappymail (modern webmail client)
- **Domain**: `webmail.cloudless.gr`
- **User**: `tbaltzakis@cloudless.gr`
- **Container**: Docker (isolated on localhost:8080)
- **Reverse Proxy**: OMV Nginx (HTTPS)
- **Storage**: OMV shared folder (`snappymail-data`)

## Architecture

```
Internet → Cloudflare Tunnel → OMV-HA Nginx (HTTPS) → Snappymail Container (localhost:8080)
```

### Security Features

- Container only exposed on localhost (127.0.0.1:8080)
- No direct external access to container
- HTTPS via Let's Encrypt (automatic via OMV)
- System Linux user authentication (no separate webmail passwords)
- Rate limiting via Nginx

## Prerequisites

- OMV-HA node (Raspberry Pi 3, armv7l/aarch64)
- OMV 5.x or 6.x
- Docker + Docker Compose plugin installed (via OMV-Extras)
- Data disk mounted in `/srv/dev-disk-by-label-*`
- Domain `webmail.cloudless.gr` DNS A record pointing to OMV-HA public IP
- Mail server (Postfix/Dovecot) installed and configured

## Installation

### Quick Start

```bash
cd /path/to/cloudless.gr/infrastructure/snappymail
chmod +x install_snappymail.sh
sudo ./install_snappymail.sh
```

The script will:

1. Verify OMV version and architecture
2. Check Docker installation and start service if needed
3. Create shared folder `snappymail-data` (if not exists)
4. Check for port conflicts (port 8080)
5. Pull latest Snappymail image
6. Deploy Snappymail container via Docker Compose
7. Configure Nginx reverse proxy for `webmail.cloudless.gr`
8. Backup and commit Nginx configuration with rollback on failure
9. Verify installation and display access instructions

### Post-Installation Steps

#### 1. DNS Configuration

Create A record in Cloudflare DNS:

- **Type**: A
- **Name**: webmail
- **IPv4**: [your OMV-HA public IP]
- **Proxy**: DNS-only (orange cloud OFF)

Verify propagation:

```bash
dig webmail.cloudless.gr +short
```

#### 2. SSL Certificate

Create Let's Encrypt certificate via OMV Web UI:

1. Go to **Storage → Certificates → + Add**
2. Type: **Let's Encrypt**
3. Domains: `webmail.cloudless.gr`
4. Email: `tbaltzakis@cloudless.gr`
5. Webroot path: `/var/www/html`

The Nginx config will automatically use this certificate.

#### 3. Configure Mail Server

Ensure mail server is running:

```bash
sudo systemctl status postfix
sudo systemctl status dovecot
```

If not installed:

```bash
sudo apt update
sudo apt install postfix dovecot-imapd
```

#### 4. Create Mail User

```bash
# Create mail user (if not exists)
sudo adduser --disabled-login --gecos '' tbaltzakis
sudo passwd tbaltzakis

# Create Maildir
sudo maildirmake.dovecot /home/tbaltzakis/Maildir
sudo chown -R tbaltzakis:tbaltzakis /home/tbaltzakis/Maildir
```

#### 5. Configure Firewall (if using UFW)

```bash
sudo ufw allow 80/tcp    # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 25/tcp    # SMTP (if sending directly)
sudo ufw allow 143/tcp   # IMAP (if needed)
```

## Access

- **URL**: https://webmail.cloudless.gr
- **Username**: `tbaltzakis` (system Linux username)
- **Password**: System Linux password

## Management

### View Logs

```bash
# Installation log (comprehensive troubleshooting)
cat /tmp/snappymail-install.log

# Snappymail container logs
docker logs snappymail

# Mail server logs
sudo tail -f /var/log/mail.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Restart Services

```bash
# Restart Snappymail container
docker compose -f /tmp/snappymail-compose.yml restart

# Restart Nginx
sudo systemctl restart nginx
```

### Update Snappymail

```bash
# Pull latest image
docker pull snappymail/snappymail:latest

# Restart with new image
docker compose -f /tmp/snappymail-compose.yml up -d
```

### Backup

Snappymail data is stored in the OMV shared folder:

```bash
# Find the shared folder path
sudo sharedfolder-list --name snappymail-data --option mp

# Backup (example)
sudo tar -czf snappymail-backup.tar.gz /srv/dev-disk-by-label-*/snappymail-data
```

## Troubleshooting

The script includes comprehensive error handling and logging. If issues occur:

### Check Installation Log

```bash
cat /tmp/snappymail-install.log
```

This log contains detailed information about:

- System verification results
- Docker status and version
- Shared folder creation and permissions
- Port conflict detection
- Container deployment status
- Nginx configuration steps
- All errors with troubleshooting suggestions

### Common Issues

#### Container Won't Start

```bash
# Check container status
docker ps -a | grep snappymail

# View logs
docker logs snappymail

# Common causes:
# - Port 8080 in use (script checks this)
# - Shared folder permissions incorrect (script verifies)
# - Insufficient disk space
# - Image pull failure (script validates)
```

#### Can't Access Webmail

```bash
# Verify DNS resolution
dig webmail.cloudless.gr +short

# Check Nginx config
sudo nginx -t

# Verify SSL certificate
sudo ls -l /etc/ssl/certs/ | grep webmail

# Check Nginx site configuration
sudo omv-confdbadm query --webgui --condition "server_name='webmail.cloudless.gr'"

# Common causes:
# - DNS A record not created or not propagated
# - SSL certificate missing
# - Nginx configuration error (script auto-rolls back on failure)
```

#### Can't Send/Receive Email

```bash
# Check mail logs
sudo tail -f /var/log/mail.log

# Verify mail user exists
id tbaltzakis

# Test local mail
echo "Test" | mail -s "Test" tbaltzakis@cloudless.gr

# Check mail services
sudo systemctl status postfix
sudo systemctl status dovecot

# Common causes:
# - Mail user doesn't exist or Maildir not created
# - Port 25 blocked by ISP
# - Mail server not configured for external relay
# - Firewall blocking mail ports
```

#### Permission Issues

```bash
# Verify shared folder permissions
ls -la /srv/dev-disk-by-label-*/snappymail-data

# Fix permissions if needed
sudo chown -R 1000:1000 /srv/dev-disk-by-label-*/snappymail-data
sudo chmod -R 755 /srv/dev-disk-by-label-*/snappymail-data
```

### Script Error Handling

The script includes:

- **Pre-flight checks**: Validates OMV version, Docker, ports, permissions
- **Automatic rollback**: Nginx config rollback on failure
- **Detailed logging**: All steps logged to `/tmp/snappymail-install.log`
- **Color-coded output**: INFO, WARN, ERROR, SUCCESS messages
- **Error traps**: Automatic cleanup on failure
- **Health checks**: Container health verification
- **User prompts**: For non-critical warnings (wrong version/arch)

## File Locations

| Path | Description |
|------|-------------|
| `/tmp/snappymail-compose.yml` | Docker Compose configuration |
| `/tmp/snappymail-install.log` | Installation log (troubleshooting) |
| `/etc/nginx/webgui.conf` | Nginx site configuration |
| `/srv/dev-disk-by-label-*/snappymail-data` | Snappymail data (attachments, config) |
| `/home/tbaltzakis/Maildir` | User mail directory |

## Integration with Cloudless Infrastructure

- **Tunnel**: Exposed via Cloudflare Tunnel (if configured)
- **DNS**: Managed via Cloudflare DNS
- **SSL**: Let's Encrypt via OMV
- **Monitoring**: Can be added to uptime-kuma
- **Backup**: Part of OMV backup strategy

## Security Considerations

1. **No direct container exposure**: Container only binds to 127.0.0.1:8080
2. **HTTPS only**: All traffic encrypted via Let's Encrypt
3. **System authentication**: Uses Linux PAM (no separate passwords)
4. **Rate limiting**: Configured via Nginx (if enabled globally)
5. **Isolation**: Docker container isolated from host system
6. **Configuration backup**: Nginx config backed up before changes
7. **Rollback capability**: Automatic rollback on Nginx configuration errors

## Advanced Configuration

### Custom Snappymail Settings

Edit `/srv/dev-disk-by-label-*/snappymail-data/config.php` (if created by container):

```php
<?php
// Custom Snappymail configuration
// See: https://github.com/the-djmaze/snappymail/wiki/Configuration
```

### Reverse Proxy to Cloudflare Tunnel

Add to Cloudflare Tunnel configuration:

```yaml
- hostname: webmail.cloudless.gr
  service: http://192.168.1.128:443  # OMV-HA IP
```

### Monitoring with Uptime Kuma

Add monitor:

- **URL**: https://webmail.cloudless.gr
- **Type**: HTTP(s)
- **Interval**: 60 seconds
- **Expected Status**: 200

## References

- [Snappymail Documentation](https://github.com/the-djmaze/snappymail)
- [OMV Docker Compose Plugin](https://github.com/OpenMediaVault-Plugin-Developers/openmediavault-docker-compose)
- [Cloudflare Tunnel Setup](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

## Support

For issues with:

- **Snappymail**: Check [GitHub Issues](https://github.com/the-djmaze/snappymail/issues)
- **OMV**: Check [Forum](https://forum.openmediavault.org/)
- **Infrastructure**: Contact `tbaltzakis@cloudless.gr`

## License

Part of the cloudless.gr infrastructure. See main LICENSE file.
