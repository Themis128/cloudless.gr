#!/usr/bin/env node

/**
 * Safe Development Script for Cloudless LLM Dev Agent
 * Handles module resolution issues for development
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🚀 Starting safe development server...\n');

// Set environment variables for safe development
process.env.SKIP_REDIS = 'true';
process.env.NUXT_PRERENDER = 'false';
process.env.NITRO_PRESET = 'node';
process.env.NUXT_TELEMETRY_DISABLED = '1';

// Check if .env exists, if not create a minimal one
function ensureEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.log('📝 Creating minimal .env file for development...');
    const envContent = `# Minimal environment configuration for development
NODE_ENV=development
SKIP_REDIS=true
NUXT_PRERENDER=false
NITRO_PRESET=node
NUXT_TELEMETRY_DISABLED=1

# Placeholder Supabase configuration (replace with real values)
NUXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-key
SUPABASE_SERVICE_ROLE_KEY=placeholder-service-key
`;
    fs.writeFileSync(envPath, envContent);
    console.log('  ✅ Created minimal .env file');
    console.log('  ⚠️  Please update with your real Supabase credentials');
  }
}

// Run development server
function runDev() {
  console.log('🔧 Starting development server...');
  
  const devProcess = spawn('npx', ['nuxt', 'dev'], {
    stdio: 'inherit',
    env: { ...process.env, SKIP_REDIS: 'true', NUXT_PRERENDER: 'false' }
  });
  
  devProcess.on('close', (code) => {
    console.log(`\n🛑 Development server stopped with code ${code}`);
  });
  
  devProcess.on('error', (error) => {
    console.log(`\n❌ Development server error: ${error.message}`);
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development server...');
    devProcess.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down development server...');
    devProcess.kill('SIGTERM');
  });
}

// Main development function
function safeDev() {
  try {
    // Step 1: Ensure environment file exists
    ensureEnvFile();
    
    // Step 2: Start development server
    runDev();
    
  } catch (error) {
    console.log('\n❌ Development server failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure all dependencies are installed: npm install');
    console.log('2. Check your environment variables in .env file');
    console.log('3. Try running: npm run fix');
    
    process.exit(1);
  }
}

// Run the safe development server
safeDev(); 