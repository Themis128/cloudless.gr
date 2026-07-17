# Dockerfile for Fly.io Cron Runner
# Minimal Node 20-alpine image for cron jobs

FROM node:20-alpine AS runtime

WORKDIR /app

# Copy the cron runner script
COPY cron-runner.js .

# Run the cron on container start
CMD ["node", "cron-runner.js"]