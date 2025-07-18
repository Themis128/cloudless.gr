# Multi-stage build for production
FROM node:20-alpine AS base

# Install security updates and essential packages
RUN apk add --no-cache \
    libc6-compat \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Build arguments for versioning
ARG VERSION=unknown
ARG GIT_COMMIT=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_DATE=unknown

# Set labels for versioning
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"
LABEL org.opencontainers.image.source="https://github.com/your-org/cloudless.gr"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.description="Cloudless LLM Dev Agent - Low-code platform for data pipelines, analytics, and AI"

# Install dependencies
FROM base AS deps
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Copy .env file if it exists (for build-time environment variables)
COPY .env* ./

# Build the application
RUN npm run build

# Production runtime
FROM base AS runner
WORKDIR /app

# Create non-root user with specific UID/GID
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nuxtjs

# Create necessary directories with proper permissions
RUN mkdir -p /app/.output /app/logs /app/uploads && \
    chown -R nuxtjs:nodejs /app

# Copy built application
COPY --from=builder --chown=nuxtjs:nodejs /app/.output ./.output
COPY --from=builder --chown=nuxtjs:nodejs /app/start-server.js ./start-server.js

# Copy .env file for runtime environment variables
COPY --from=builder --chown=nuxtjs:nodejs /app/.env* ./

# Copy only production node_modules
COPY --from=builder --chown=nuxtjs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nuxtjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

# Health check with proper timeout and retries
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "start-server.js"] 