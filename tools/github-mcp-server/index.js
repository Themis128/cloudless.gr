#!/usr/bin/env node
import { spawn } from 'child_process';

// GitHub MCP Server wrapper - runs the official Docker image
// Server name: github.com/github-mcp-server
const docker = spawn('docker', [
  'run',
  '-i',
  '--rm',
  '-e',
  'GITHUB_PERSONAL_ACCESS_TOKEN',
  'ghcr.io/github/github-mcp-server'
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_PERSONAL_ACCESS_TOKEN
  }
});

docker.on('close', (code) => {
  process.exit(code);
});