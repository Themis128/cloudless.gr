# Multi-stage build for production
FROM node:20-alpine AS base

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
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci && npm cache clean --force

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Copy .env file if it exists (for build-time environment variables)
COPY .env* ./

# Build the application
RUN npm run build

# Production runtime
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nuxtjs

# Copy built application
COPY --from=builder /app/public ./public
RUN mkdir .output
RUN chown nuxtjs:nodejs .output
COPY --from=builder --chown=nuxtjs:nodejs /app/.output ./.output
COPY --from=builder --chown=nuxtjs:nodejs /app/start-server.js ./start-server.js

# Copy .env file for runtime environment variables
COPY --from=builder --chown=nuxtjs:nodejs /app/.env* ./

# Copy node_modules from builder (already built and ready)
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

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["node", "start-server.js"] 