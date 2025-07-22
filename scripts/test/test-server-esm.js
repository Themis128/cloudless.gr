#!/usr/bin/env node

// ES Module server test - specifically for .mjs files
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 Starting ES Module server test...');

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

// Test 1: Try with explicit ES module flags
console.log('\n🧪 Test 1: ES Module execution...');

const esmTests = [
  {
    name: 'Basic ES module',
    command: `node "${serverFile}"`,
  },
  {
    name: 'With --input-type=module',
    command: `node --input-type=module "${serverFile}"`,
  },
  {
    name: 'With --experimental-modules',
    command: `node --experimental-modules "${serverFile}"`,
  },
  {
    name: 'With --loader',
    command: `node --loader "${path.join(__dirname, '.output', 'server', 'node_modules')}" "${serverFile}"`,
  },
];

for (let i = 0; i < esmTests.length; i++) {
  const test = esmTests[i];
  console.log(`\n  Attempt ${i + 1}: ${test.name}`);
  console.log(`  Command: ${test.command}`);

  try {
    const result = execSync(test.command, {
      env: process.env,
      timeout: 10000,
      encoding: 'utf8',
    });
    console.log('  ✅ Success! Output:');
    console.log(result);
    break;
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    if (error.stdout) console.log(`  STDOUT: ${error.stdout}`);
    if (error.stderr) console.log(`  STDERR: ${error.stderr}`);
  }
}

// Test 2: Check if it's a module loading issue
console.log('\n🧪 Test 2: Module loading analysis...');

try {
  const serverContent = fs.readFileSync(serverFile, 'utf8');

  // Check for import statements
  const importMatches = serverContent.match(/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g);
  if (importMatches) {
    console.log('Found import statements:');
    importMatches.slice(0, 5).forEach((imp) => console.log(`  ${imp}`));
  }

  // Check for dynamic imports
  if (serverContent.includes('import(')) {
    console.log('⚠️  Contains dynamic imports');
  }

  // Check for require statements (shouldn't be in .mjs)
  if (serverContent.includes('require(')) {
    console.log('⚠️  Contains require statements in .mjs file');
  }
} catch (error) {
  console.error('❌ Failed to analyze server file:', error.message);
}

// Test 3: Try to run with a wrapper script
console.log('\n🧪 Test 3: Wrapper script test...');

const wrapperScript = `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Set environment variables
process.env.NODE_ENV = 'production';
process.env.NUXT_HOST = '0.0.0.0';
process.env.NUXT_PORT = '3000';
    // Removed Supabase test configuration - using Prisma instead

console.log('🔧 Wrapper: Environment set');
console.log('🔧 Wrapper: Attempting to import server...');

try {
  await import('${serverFile.replace(/\\/g, '/')}');
  console.log('✅ Wrapper: Server imported successfully');
} catch (error) {
  console.error('❌ Wrapper: Import failed:', error.message);
  console.error('❌ Wrapper: Stack:', error.stack);
  process.exit(1);
}
`;

const wrapperPath = path.join(__dirname, 'test-wrapper.mjs');
fs.writeFileSync(wrapperPath, wrapperScript);

try {
  console.log('Running wrapper script...');
  const result = execSync(`node "${wrapperPath}"`, {
    env: process.env,
    timeout: 10000,
    encoding: 'utf8',
  });
  console.log('✅ Wrapper script output:');
  console.log(result);
} catch (error) {
  console.log('❌ Wrapper script failed:');
  console.log('Error:', error.message);
  if (error.stdout) console.log('STDOUT:', error.stdout);
  if (error.stderr) console.log('STDERR:', error.stderr);
} finally {
  // Cleanup
  if (fs.existsSync(wrapperPath)) {
    fs.unlinkSync(wrapperPath);
  }
}

console.log('\n🎉 ES Module server test completed!');
