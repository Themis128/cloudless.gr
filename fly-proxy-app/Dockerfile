FROM python:3.11-slim

WORKDIR /app

# Tailscale static binaries (userspace networking on Fly)
ARG TS_VERSION=1.84.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl iptables \
  && curl -fsSL "https://pkgs.tailscale.com/stable/tailscale_${TS_VERSION}_amd64.tgz" \
    | tar -xz -C /tmp \
  && mv /tmp/tailscale_${TS_VERSION}_amd64/tailscale /usr/local/bin/ \
  && mv /tmp/tailscale_${TS_VERSION}_amd64/tailscaled /usr/local/bin/ \
  && rm -rf /tmp/tailscale_${TS_VERSION}_amd64 /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proxy.py start.sh ./
RUN chmod +x start.sh

EXPOSE 8080

CMD ["./start.sh"]
