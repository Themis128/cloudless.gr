#!/usr/bin/env node

// Server Startup Test Script for CI
console.log('🚀 Server Startup Test Script');
console.log('==============================');

// Check environment variables
console.log('\n🔍 Environment Variables:');
const envVars = ['NODE_ENV', 'NITRO_HOST', 'NITRO_PORT', 'NITRO_LOG_LEVEL'];

envVars.forEach((varName) => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const displayValue =
    varName.includes('KEY') || varName.includes('SECRET')
      ? value
        ? value.substring(0, 10) + '...'
        : 'undefined'
      : value || 'undefined';
  console.log(`  ${status} ${varName}: ${displayValue}`);
});

// Check if server file exists
const fs = require('fs');
const path = require('path');

console.log('\n📁 File Checks:');
const serverFile = '.output/server/index.mjs';
const serverExists = fs.existsSync(serverFile);
console.log(
  `  ${serverExists ? '✅' : '❌'} ${serverFile}: ${serverExists ? 'exists' : 'missing'}`
);

if (!serverExists) {
  console.log('❌ Server file not found. Please run `npm run build` first.');
  process.exit(1);
}

// Check file permissions
try {
  const stats = fs.statSync(serverFile);
  console.log(`  📊 File size: ${stats.size} bytes`);
  console.log(`  📊 File permissions: ${stats.mode.toString(8)}`);
} catch (error) {
  console.log(`  ❌ Error reading file stats: ${error.message}`);
}

// Check if nitro is available
console.log('\n📦 Dependency Checks:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const hasNitro = packageJson.dependencies?.nitro || packageJson.devDependencies?.nitro;
  console.log(`  ${hasNitro ? '✅' : '❌'} nitro: ${hasNitro ? 'installed' : 'missing'}`);

  if (!hasNitro) {
    console.log('⚠️  Nitro is missing from dependencies. This may cause runtime issues.');
  }
} catch (error) {
  console.log(`  ❌ Error reading package.json: ${error.message}`);
}

// Try to start the server with error handling
console.log('\n🧪 Server Startup Test:');
console.log('Starting server with error capture...');

const { spawn } = require('child_process');

// Set environment variables for the test
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NITRO_HOST: '0.0.0.0',
  NITRO_PORT: '3000',
  NITRO_LOG_LEVEL: 'debug',
};

// Start server process
const serverProcess = spawn('node', [serverFile], {
  env,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let serverOutput = '';
let serverError = '';

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log(`📤 STDOUT: ${output.trim()}`);
});

serverProcess.stderr.on('data', (data) => {
  const error = data.toString();
  serverError += error;
  console.log(`📤 STDERR: ${error.trim()}`);
});

serverProcess.on('error', (error) => {
  console.log(`❌ Process error: ${error.message}`);
});

// Wait for server to start or fail
setTimeout(() => {
  console.log('\n⏱️  Server startup timeout reached');

  if (serverProcess.killed) {
    console.log('❌ Server process was killed');
  } else {
    console.log('✅ Server process is still running');

    // Test if server is responding
    const http = require('http');
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: '/',
        method: 'GET',
        timeout: 5000,
      },
      (res) => {
        console.log(`✅ Server responded with status: ${res.statusCode}`);
        serverProcess.kill();
        process.exit(0);
      }
    );

    req.on('error', (error) => {
      console.log(`❌ Server not responding: ${error.message}`);
      serverProcess.kill();
      process.exit(1);
    });

    req.on('timeout', () => {
      console.log('❌ Server request timed out');
      req.destroy();
      serverProcess.kill();
      process.exit(1);
    });

    req.end();
  }
}, 15000); // 15 second timeout

// Handle process exit
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, killing server process...');
  serverProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, killing server process...');
  serverProcess.kill();
  process.exit(0);
});
