#!/usr/bin/env node

// Enhanced Server Debug Script for CI
console.log('🔍 Enhanced Server Debug Script');
console.log('================================');

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Check environment variables
console.log('\n🔍 Environment Variables:');
const envVars = [
  'NODE_ENV',
  'NITRO_HOST',
  'NITRO_PORT',
  'NITRO_LOG_LEVEL',
  // Removed Supabase variables - using Prisma instead
  'NUXT_HOST',
  'NUXT_PORT',
];

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

// Check file structure
console.log('\n📁 File Structure Check:');
const filesToCheck = ['.output/server/index.mjs', 'start-server.js', 'package.json', '.env'];

filesToCheck.forEach((file) => {
  const exists = fs.existsSync(file);
  console.log(`  ${exists ? '✅' : '❌'} ${file}: ${exists ? 'exists' : 'missing'}`);

  if (exists) {
    try {
      const stats = fs.statSync(file);
      console.log(`    📊 Size: ${stats.size} bytes`);
      console.log(`    📊 Permissions: ${stats.mode.toString(8)}`);
    } catch (error) {
      console.log(`    ❌ Error reading stats: ${error.message}`);
    }
  }
});

// Check .output/server directory contents
console.log('\n📦 .output/server Directory:');
const serverDir = '.output/server';
if (fs.existsSync(serverDir)) {
  try {
    const files = fs.readdirSync(serverDir);
    console.log(`  ✅ Directory exists with ${files.length} files`);
    files.slice(0, 10).forEach((file) => {
      const filePath = path.join(serverDir, file);
      const stats = fs.statSync(filePath);
      console.log(`    📄 ${file} (${stats.size} bytes)`);
    });
    if (files.length > 10) {
      console.log(`    ... and ${files.length - 10} more files`);
    }
  } catch (error) {
    console.log(`  ❌ Error reading directory: ${error.message}`);
  }
} else {
  console.log('  ❌ .output/server directory does not exist');
}

// Check package.json dependencies
console.log('\n📦 Package Dependencies:');
try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deps = packageJson.dependencies || {};
  const devDeps = packageJson.devDependencies || {};

  const requiredDeps = ['nitro', '@nuxt/nitro'];
  requiredDeps.forEach((dep) => {
    const hasDep = deps[dep] || devDeps[dep];
    console.log(`  ${hasDep ? '✅' : '❌'} ${dep}: ${hasDep ? hasDep : 'missing'}`);
  });
} catch (error) {
  console.log(`  ❌ Error reading package.json: ${error.message}`);
}

// Test server module import
console.log('\n🧪 Server Module Import Test:');
try {
  console.log('  🔄 Attempting to import server module...');
  const serverModule = require('./.output/server/index.mjs');
  console.log('  ✅ Server module imported successfully');

  if (serverModule.listener) {
    console.log('  ✅ listener function found');
  } else {
    console.log('  ❌ listener function not found');
  }

  if (serverModule.handler) {
    console.log('  ✅ handler function found');
  } else {
    console.log('  ❌ handler function not found');
  }

  console.log('  📋 Available exports:', Object.keys(serverModule));
} catch (error) {
  console.log(`  ❌ Error importing server module: ${error.message}`);
  console.log(`  📋 Error stack: ${error.stack}`);
}

// Test server startup with detailed output
console.log('\n🚀 Server Startup Test:');
const serverProcess = spawn('node', ['start-server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    NITRO_HOST: '0.0.0.0',
    NITRO_PORT: '3000',
    NITRO_LOG_LEVEL: 'debug',
  },
  stdio: ['pipe', 'pipe', 'pipe'],
});

let serverOutput = '';
let serverError = '';
let serverStarted = false;

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  console.log(`📤 STDOUT: ${output.trim()}`);

  if (output.includes('Server listening')) {
    serverStarted = true;
  }
});

serverProcess.stderr.on('data', (data) => {
  const error = data.toString();
  serverError += error;
  console.log(`📤 STDERR: ${error.trim()}`);
});

serverProcess.on('error', (error) => {
  console.log(`❌ Process error: ${error.message}`);
});

serverProcess.on('exit', (code, signal) => {
  console.log(`📤 Process exited with code ${code} and signal ${signal}`);
});

// Wait for server to start or fail
setTimeout(() => {
  console.log('\n⏱️  Server startup timeout reached');

  if (serverStarted) {
    console.log('✅ Server started successfully');

    // Test HTTP response
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
  } else {
    console.log('❌ Server failed to start');
    console.log('📋 Full server output:');
    console.log(serverOutput);
    console.log('📋 Full server error:');
    console.log(serverError);
    serverProcess.kill();
    process.exit(1);
  }
}, 20000); // 20 second timeout

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
