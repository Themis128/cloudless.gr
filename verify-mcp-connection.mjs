#!/usr/bin/env node

/**
 * Verify MCP Server Connection
 * This script verifies that the MCP server is working correctly with the local Supabase instance
 */

import { spawn } from 'child_process';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

console.log('🔍 Verifying MCP Server Connection');
console.log('===================================');

// Check environment variables
console.log('\n📋 Environment Variables:');
console.log(`✅ SUPABASE_URL: ${process.env.SUPABASE_URL || '❌ Missing'}`);
console.log(`✅ SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`✅ SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`✅ SUPABASE_ACCESS_TOKEN: ${process.env.SUPABASE_ACCESS_TOKEN ? '✅ Set' : '❌ Missing'}`);

// Check if MCP package is installed
console.log('\n📦 MCP Package Check:');
try {
  const packagePath = path.resolve('node_modules/@supabase/mcp-server-supabase/package.json');
  const pkg = require(packagePath);
  console.log(`✅ @supabase/mcp-server-supabase v${pkg.version} installed`);
} catch {
  console.log('❌ @supabase/mcp-server-supabase not found');
  process.exit(1);
}

// Test MCP server startup
console.log('\n🚀 Testing MCP Server Startup:');
const mcpProcess = spawn('cmd', ['/c', 'npx', '@supabase/mcp-server-supabase'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
  shell: true
});

let outputReceived = false;
let timeoutId;

mcpProcess.stdout.on('data', (data) => {
  outputReceived = true;
  console.log('✅ MCP server started successfully');
  console.log('📊 Server output:', data.toString().trim());
  clearTimeout(timeoutId);
  mcpProcess.kill();
  console.log('\n🎉 MCP server verification complete!');
  console.log('💡 You can now use the MCP server with AI assistants');
  process.exit(0);
});

mcpProcess.stderr.on('data', (data) => {
  console.log('⚠️ MCP server stderr:', data.toString().trim());
});

mcpProcess.on('error', (error) => {
  console.log('❌ Failed to start MCP server:', error.message);
  process.exit(1);
});

// Timeout after 10 seconds
timeoutId = setTimeout(() => {
  if (!outputReceived) {
    console.log('⏰ Timeout: MCP server did not respond within 10 seconds');
    mcpProcess.kill();
    process.exit(1);
  }
}, 10000);

console.log('⏳ Starting MCP server (timeout: 10s)...');
