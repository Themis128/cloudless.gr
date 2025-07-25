#!/usr/bin/env node

// Direct server test - captures the exact error
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 Starting direct server test...');

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
// Removed Supabase configuration - using Prisma instead

// Test 1: Try to import the server file directly
console.log('\n🧪 Test 1: Direct import test...');
try {
  console.log('Attempting to import server file...');
  const serverModule = require(serverFile);
  console.log('✅ Server module imported successfully');
  console.log('Module exports:', Object.keys(serverModule));
} catch (error) {
  console.error('❌ Failed to import server module:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}

// Test 2: Try to execute with different Node.js flags
console.log('\n🧪 Test 2: Node.js execution with different flags...');

const nodeFlags = [
  [],
  ['--trace-warnings'],
  ['--trace-uncaught'],
  ['--trace-warnings', '--trace-uncaught'],
  ['--abort-on-uncaught-exception'],
  ['--max-old-space-size=4096'],
];

for (let i = 0; i < nodeFlags.length; i++) {
  const flags = nodeFlags[i];
  console.log(`\n  Attempt ${i + 1}: node ${flags.join(' ')} ${serverFile}`);

  try {
    const result = execSync(`node ${flags.join(' ')} "${serverFile}"`, {
      env: process.env,
      timeout: 5000,
      encoding: 'utf8',
    });
    console.log('  ✅ Success! Output:');
    console.log(result);
    break;
  } catch (error) {
    console.log(`  ❌ Failed with flags ${flags.join(' ')}:`);
    console.log(`  Error: ${error.message}`);
    if (error.stdout) console.log(`  STDOUT: ${error.stdout}`);
    if (error.stderr) console.log(`  STDERR: ${error.stderr}`);
  }
}

// Test 3: Check the server file content for potential issues
console.log('\n🧪 Test 3: Server file analysis...');
try {
  const serverContent = fs.readFileSync(serverFile, 'utf8');
  console.log('✅ Server file content loaded');
  console.log('File size:', serverContent.length, 'characters');
  console.log('First 200 characters:');
  console.log(serverContent.substring(0, 200));

  // Check for common issues
  if (serverContent.includes('import.meta')) {
    console.log('⚠️  Contains import.meta - may need ES modules support');
  }
  if (serverContent.includes('process.exit')) {
    console.log('⚠️  Contains process.exit calls');
  }
  if (serverContent.includes('throw new Error')) {
    console.log('⚠️  Contains explicit error throws');
  }
} catch (error) {
  console.error('❌ Failed to read server file:', error.message);
}

// Test 4: Check dependencies
console.log('\n🧪 Test 4: Dependency check...');
const packageJsonPath = path.join(__dirname, '.output', 'server', 'package.json');
if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    console.log('✅ Server package.json loaded');
    console.log('Dependencies count:', Object.keys(packageJson.dependencies || {}).length);

    // Check for critical dependencies
    const criticalDeps = ['h3', 'nitro', 'vue', 'vue-router'];
    for (const dep of criticalDeps) {
      if (packageJson.dependencies[dep]) {
        console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
      } else {
        console.log(`❌ ${dep}: missing`);
      }
    }
  } catch (error) {
    console.error('❌ Failed to parse package.json:', error.message);
  }
} else {
  console.log('❌ Server package.json not found');
}

console.log('\n🎉 Direct server test completed!');
