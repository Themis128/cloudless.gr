#!/usr/bin/env node

/**
 * Simple Startup Script for Cloudless LLM Dev Agent
 * Bypasses module resolution issues by using a different approach
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Starting Cloudless LLM Dev Agent (Simple Mode)...\n');

// Set environment variables to bypass issues
process.env.SKIP_REDIS = 'true';
process.env.NUXT_PRERENDER = 'false';
process.env.NITRO_PRESET = 'node';
process.env.NUXT_TELEMETRY_DISABLED = '1';
process.env.NODE_ENV = 'development';

// Create minimal .env if it doesn't exist
function createMinimalEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.log('📝 Creating minimal .env file...');
    const envContent = `# Minimal environment configuration
NODE_ENV=development
SKIP_REDIS=true
NUXT_PRERENDER=false
NITRO_PRESET=node
NUXT_TELEMETRY_DISABLED=1

# Placeholder Supabase configuration
NUXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-key
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-key
`;
    fs.writeFileSync(envPath, envContent);
    console.log('  ✅ Created minimal .env file');
  }
}

// Clean build artifacts
function cleanBuild() {
  console.log('🧹 Cleaning build artifacts...');
  
  const dirsToClean = ['.nuxt', '.output', 'dist'];
  
  dirsToClean.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  ✅ Cleaned ${dir}`);
      } catch (error) {
        console.log(`  ⚠️  Could not clean ${dir}: ${error.message}`);
      }
    }
  });
}

// Start the application with a different approach
function startApp() {
  console.log('🔧 Starting application...');
  
  // Try different approaches to start the app
  const commands = [
    ['npx', ['nuxt', 'dev', '--port', '3000']],
    ['node', ['.output/server/index.mjs']],
    ['npm', ['run', 'dev']]
  ];
  
  let currentCommand = 0;
  
  function tryNextCommand() {
    if (currentCommand >= commands.length) {
      console.log('❌ All startup methods failed');
      process.exit(1);
    }
    
    const [cmd, args] = commands[currentCommand];
    console.log(`  🔄 Trying: ${cmd} ${args.join(' ')}`);
    
    const appProcess = spawn(cmd, args, {
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    appProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Application started successfully');
      } else {
        console.log(`❌ Command failed with code ${code}, trying next...`);
        currentCommand++;
        setTimeout(tryNextCommand, 1000);
      }
    });
    
    appProcess.on('error', (error) => {
      console.log(`❌ Command error: ${error.message}, trying next...`);
      currentCommand++;
      setTimeout(tryNextCommand, 1000);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down...');
      appProcess.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down...');
      appProcess.kill('SIGTERM');
    });
  }
  
  tryNextCommand();
}

// Main function
function main() {
  try {
    // Step 1: Create minimal environment
    createMinimalEnv();
    
    // Step 2: Clean build artifacts
    cleanBuild();
    
    // Step 3: Start application
    startApp();
    
  } catch (error) {
    console.log('\n❌ Startup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure Node.js 18+ is installed');
    console.log('2. Run: npm install');
    console.log('3. Check your .env file');
    
    process.exit(1);
  }
}

// Run the application
main(); 