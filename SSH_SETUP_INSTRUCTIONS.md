# SSH Key Setup Instructions for omv Node (192.168.1.128)

## Current Status

**SSH Server**: ✅ Running (OpenBSD Secure Shell server - active since 2026-04-13)

**SSH Configuration**:
- `PermitRootLogin`: no
- `PasswordAuthentication`: yes
- `AllowUsers`: tbaltzakis

**Existing Keys in authorized_keys**:
- Multiple GitHub Actions deployment keys
- Personal SSH keys (ed25519 and RSA formats)
- **Your new RSA key NOT yet added**

## Problem Identified

The SSH key authentication is failing because:
1. The SSH daemon is running and accessible
2. Password authentication is enabled
3. The `authorized_keys` file exists but your new RSA key is not present
4. Previous `ssh-copy-id` attempts failed due to connection issues

## Solution

### Method 1: Append Your Key to authorized_keys (Recommended)

```bash
# Append your public key to the authorized_keys file
cat ~/.ssh/id_rsa.pub | ssh -o StrictHostKeyChecking=no \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o ConnectTimeout=5 \
  tbaltzakis@192.168.1.128 \
  "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

### Method 2: Manual Copy via Password Authentication

```bash
# Copy your public key to the remote machine using password auth
sshpass -p "tbaltzakis" ssh-copy-id -i ~/.ssh/id_rsa.pub tbaltzakis@192.168.1.128
```

**Note**: If `sshpass` is not installed, use:

```bash
# Install sshpass if needed (Ubuntu/Debian)
sudo apt-get install -y sshpass

# Then retry
sshpass -p "tbaltzakis" ssh-copy-id -i ~/.ssh/id_rsa.pub tbaltzakis@192.168.1.128
```

### Method 3: Direct File Append (If password auth works)

```bash
# Directly append to authorized_keys
ssh -o StrictHostKeyChecking=no \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o ConnectTimeout=5 \
  tbaltzakis@192.168.1.128 \
  "echo '$(cat ~/.ssh/id_rsa.pub)' >> ~/.ssh/authorized_keys && \
   chmod 700 ~/.ssh && \
   chmod 600 ~/.ssh/authorized_keys"
```

## Verification Steps

### Step 1: Add Your Key

```bash
# Use Method 1 above
cat ~/.ssh/id_rsa.pub | ssh -o StrictHostKeyChecking=no \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o ConnectTimeout=5 \
  tbaltzakis@192.168.1.128 \
  "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

### Step 2: Verify Key Was Added

```bash
# Check the authorized_keys file
ssh -o StrictHostKeyChecking=no \
  -o PreferredAuthentications=password \
  -o PubkeyAuthentication=no \
  -o ConnectTimeout=5 \
  tbaltzakis@192.168.1.128 \
  "grep 'tbaltzakis@cloudless.gr' ~/.ssh/authorized_keys"
```

### Step 3: Test SSH Key Authentication

```bash
# Test public key authentication
ssh -o StrictHostKeyChecking=no \
  -o PreferredAuthentications=publickey \
  -o PubkeyAuthentication=yes \
  -o IdentityFile=~/.ssh/id_rsa \
  -o IdentitiesOnly=yes \
  -o ConnectTimeout=5 \
  tbaltzakis@192.168.1.128 \
  "whoami && echo 'SSH key authentication successful!'"
```

## Expected Output

If successful, you should see:
```
tbaltzakis
SSH key authentication successful!
```

## Troubleshooting

### If SSH key auth still fails:

1. **Check authorized_keys permissions**:
   ```bash
   ssh -o PreferredAuthentications=password tbaltzakis@192.168.1.128 \
     "ls -la ~/.ssh/authorized_keys"
   ```
   - Should show: `-rw------- 1 tbaltzakis users`

2. **Check .ssh directory permissions**:
   ```bash
   ssh -o PreferredAuthentications=password tbaltzakis@192.168.1.128 \
     "ls -ld ~/.ssh"
   ```
   - Should show: `drwx------`

3. **Check SSH daemon logs**:
   ```bash
   ssh -o PreferredAuthentications=password tbaltzakis@192.168.1.128 \
     "sudo tail -20 /var/log/auth.log"
   ```

4. **Verify key format**:
   ```bash
   cat ~/.ssh/id_rsa.pub
   ```
   - Should start with: `ssh-rsa AAAAB3NzaC1yc2E...`

### Common Issues:

- **Permission denied (publickey)**: The key wasn't properly added to `authorized_keys`
- **Permission denied (password)**: Either the key addition failed or SSH config prevents it
- **Connection refused**: SSH daemon not running (but we confirmed it's running)
- **Timeout**: Network/firewall blocking port 22

## SSH Configuration Reference

The omv node's SSH server is configured with:
- **Port**: 22 (default)
- **Protocol**: 2 (SSHv2 only)
- **Password authentication**: Enabled
- **Public key authentication**: Enabled
- **Root login**: Disabled
- **Allowed users**: tbaltzakis

## Security Note

After successful key setup:
- Disable password authentication for better security:
  ```bash
  ssh tbaltzakis@192.168.1.128 \
    "sudo sed -i 's/^PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
     sudo systemctl restart ssh"
  ```
- Keep your private key (`~/.ssh/id_rsa`) secure
- Never share your private key