# Multi-stage Dockerfile for Cloudless.gr
# Supports both development and production environments

# Base stage with common dependencies
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    curl \
    git \
    python3 \
    make \
    g++ \
    libc6-compat \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Install pnpm for better package management
RUN corepack enable && corepack prepare pnpm@latest --activate

# Development stage
FROM base AS development

# Install additional dev tools
RUN apk add --no-cache \
    bash \
    vim \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json pnpm-lock.yaml* ./
COPY nuxt.config.ts ./
COPY tsconfig.json ./

# Install all dependencies (including devDependencies)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Expose ports for development
EXPOSE 3000 24678

# Set development environment
ENV NODE_ENV=development
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

# Enable hot module replacement
ENV NUXT_HMR_HOST=0.0.0.0
ENV NUXT_HMR_PORT=24678

# Development command with hot reload
CMD ["pnpm", "run", "dev"]

# Dependencies stage for production
FROM base AS dependencies

# Copy package files
COPY package*.json pnpm-lock.yaml* ./
COPY nuxt.config.ts ./
COPY tsconfig.json ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Build stage for production
FROM base AS builder

# Copy package files
COPY package*.json pnpm-lock.yaml* ./
COPY nuxt.config.ts ./
COPY tsconfig.json ./

# Install all dependencies for building
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build arguments for versioning
ARG VERSION=latest
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown

# Set build-time environment variables
ENV VERSION=$VERSION
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_DATE=$BUILD_DATE

# Build the application
RUN pnpm run build

# Production stage - minimal final image
FROM node:20-alpine AS production

# Install only runtime dependencies
RUN apk add --no-cache \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nuxtjs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=nuxtjs:nodejs /app/.output ./.output
COPY --from=dependencies --chown=nuxtjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nuxtjs:nodejs /app/package*.json ./

# Copy static assets if any (using shell to handle optional directory)
RUN --mount=type=bind,from=builder,source=/app/public,target=/tmp/public \
    if [ -d /tmp/public ]; then cp -r /tmp/public ./; chown -R nuxtjs:nodejs ./public; fi || true

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads /app/tmp && \
    chown -R nuxtjs:nodejs /app

# Switch to non-root user
USER nuxtjs

# Production environment variables
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Set Node.js memory optimization
ENV NODE_OPTIONS="--max-old-space-size=3072 --optimize-for-size --gc-interval=100"

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", ".output/server/index.mjs"] 