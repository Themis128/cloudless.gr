FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm

# Install pnpm globally
RUN npm install -g pnpm@10.33.0

# Create pnpm store with correct ownership BEFORE switching to node user
RUN mkdir -p /pnpm-store && chown -R node:node /pnpm-store

# Configure pnpm
RUN pnpm config set store-dir /pnpm-store && \ 
    pnpm config set registry https://registry.npmjs.org &&     pnpm config set strict-peer-dependencies false &&     pnpm config set confirmModulesPurge false

# Install AWS CLI v2 -- architecture-aware (x86_64 or aarch64)
RUN ARCH=$(uname -m) &&     AWS_ARCH=$([ "$ARCH" = "aarch64" ] && echo "aarch64" || echo "x86_64") &&     curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${AWS_ARCH}.zip"          -o /tmp/awscliv2.zip &&     unzip -q /tmp/awscliv2.zip -d /tmp &&     /tmp/aws/install &&     rm -rf /tmp/aws /tmp/awscliv2.zip

WORKDIR /workspace

ENV PNPM_HOME=/pnpm-store
ENV PATH="${PNPM_HOME}:${PATH}"

# CI=true intentionally omitted -- breaks ESLint, Next.js strict mode, Vitest watch.

USER node
