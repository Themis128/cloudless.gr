#!/usr/bin/env bash
# Install a `kubectl` shim that forwards to omv's k3s over Tailscale+SSH.
#
# Why: the KUBECONFIG_B64 secret points at localhost:8080 — a proxy that
# nothing ever establishes, so every kubectl call in CI hit
# "connection refused" while workflows reported success. This shim routes
# kubectl through SSH to omv instead (sudo kubectl, remote kubeconfig).
#
# Needs: secrets.OMV_SSH_KEY (ed25519 for tbaltzakis@100.74.191.58),
#        Tailscale already joined (tailscale/github-action step).
set -euo pipefail
mkdir -p ~/.ssh ~/bin
printf '%s\n' "${OMV_SSH_KEY:?missing OMV_SSH_KEY}" > ~/.ssh/id_ed25519
chmod 600 ~/.ssh/id_ed25519
ssh-keyscan -H 100.74.191.58 >> ~/.ssh/known_hosts 2>/dev/null || true
cat > ~/bin/kubectl <<'EOF'
#!/usr/bin/env bash
exec ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
  -i ~/.ssh/id_ed25519 tbaltzakis@100.74.191.58 \
  "sudo kubectl --kubeconfig /etc/rancher/k3s/k3s.yaml $*"
EOF
chmod +x ~/bin/kubectl
echo "$HOME/bin" >> "$GITHUB_PATH"
~/bin/kubectl version 2>&1 | tail -2
