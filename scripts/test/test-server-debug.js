#!/usr/bin/env node

// Simple server debug script
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 Starting server debug test...');

// Check if server file exists
const serverFile = path.join(__dirname, '.output', 'server', 'index.mjs');
if (!fs.existsSync(serverFile)) {
  console.error('❌ Server file not found:', serverFile);
  process.exit(1);
}

console.log('✅ Server file found:', serverFile);

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.NUXT_HOST = '0.0.0.0';
process.env.NUXT_PORT = '3000';

console.log('🔧 Environment variables set:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  NUXT_HOST:', process.env.NUXT_HOST);
console.log('  NUXT_PORT:', process.env.NUXT_PORT);

// Test 1: Syntax check
console.log('\n🧪 Test 1: Syntax check...');
try {
  require('child_process').execSync(`node --check "${serverFile}"`, {
    stdio: 'inherit',
    timeout: 10000,
  });
  console.log('✅ Syntax check passed');
} catch (error) {
  console.error('❌ Syntax check failed:', error.message);
  process.exit(1);
}

// Test 2: Direct execution with error capture
console.log('\n🧪 Test 2: Direct execution test...');

const serverProcess = spawn('node', ['--trace-warnings', '--trace-uncaught', serverFile], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env,
});

let stdout = '';
let stderr = '';

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  stdout += output;
  console.log('📤 STDOUT:', output.trim());
});

serverProcess.stderr.on('data', (data) => {
  const output = data.toString();
  stderr += output;
  console.log('📤 STDERR:', output.trim());
});

serverProcess.on('error', (error) => {
  console.error('❌ Process error:', error);
  process.exit(1);
});

serverProcess.on('exit', (code, signal) => {
  console.log(`\n📋 Process exited with code ${code} and signal ${signal}`);

  if (code !== 0) {
    console.error('❌ Server failed to start');
    console.log('📤 Full STDOUT:');
    console.log(stdout);
    console.log('📤 Full STDERR:');
    console.log(stderr);
    process.exit(1);
  }
});

// Wait for server to start or fail
setTimeout(() => {
  console.log('\n⏰ Timeout reached, checking if server is still running...');

  if (serverProcess.killed) {
    console.error('❌ Server process was killed');
    process.exit(1);
  }

  console.log('✅ Server process is still running');
  console.log('🎉 Server debug test completed successfully!');

  // Cleanup
  serverProcess.kill();
  process.exit(0);
}, 10000); // 10 second timeout
