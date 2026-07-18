# Cloudflare Pages MCP Dockerfile
# This runs the MCP server using tsx for TypeScript execution
# IMPORTANT: MCP servers use stdio transport and need interactive mode

FROM node:22-alpine

WORKDIR /app

# Install tsx and curl (needed for Cloudflare API calls)
RUN npm install -g tsx && apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source and entrypoint
COPY src ./src
COPY tsconfig.json ./
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Run the MCP server with entrypoint (validates env vars)
ENTRYPOINT ["./entrypoint.sh"]
```
