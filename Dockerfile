# Dockerfile for Nuxt Platform
# Multi-stage build for optimized production image

# Development stage
FROM node:18 AS development

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production=false

# Copy source code
COPY . .

# Expose development port
EXPOSE 3000

# Development command
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Build stage
FROM node:18 AS builder

WORKDIR /app

# Copy package files
COPY package*.json package-lock.json* ./

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18 AS production

WORKDIR /app

# Install curl, python3, and pip for health checks and Python support
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl=7.74.0-1.3+deb11u7 \
    python3=3.9.2-3 \
    python3-pip=20.3.4-4+deb11u1 \
    python3-venv=3.9.2-3 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set up Python virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python dependencies
COPY requirements.docker.txt ./
RUN pip install --no-cache-dir -r requirements.docker.txt

WORKDIR /app

# Copy package files
COPY package*.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/.nuxt ./.nuxt

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nuxtjs -u 1001

# Change ownership of the app directory
RUN chown -R nuxtjs:nodejs /app
USER nuxtjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start the application
CMD ["node", ".output/server/index.mjs"]
