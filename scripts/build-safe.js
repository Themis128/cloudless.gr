#!/usr/bin/env node

/**
 * Safe Build Script for Cloudless LLM Dev Agent
 * Handles module resolution issues and provides fallbacks
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

console.log('🚀 Starting safe build process...\n');

// Set environment variables for safe build
process.env.SKIP_REDIS = 'true';
process.env.NUXT_PRERENDER = 'false';
process.env.NITRO_PRESET = 'node';
process.env.NUXT_TELEMETRY_DISABLED = '1';

// Check if .env exists, if not create a minimal one
function ensureEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.log('📝 Creating minimal .env file...');
    const envContent = `# Minimal environment configuration for testing
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

// Prepare Nuxt
function prepareNuxt() {
  console.log('⚡ Preparing Nuxt...');
  
  try {
    execSync('npx nuxt prepare', { 
      stdio: 'inherit',
      env: { ...process.env, SKIP_REDIS: 'true' }
    });
    console.log('  ✅ Nuxt prepared');
    return true;
  } catch (error) {
    console.log('  ❌ Failed to prepare Nuxt');
    return false;
  }
}

// Run build with error handling
function runBuild() {
  console.log('🔨 Running build...');
  
  return new Promise((resolve, reject) => {
    const buildProcess = spawn('npx', ['nuxt', 'build'], {
      stdio: 'inherit',
      env: { ...process.env, SKIP_REDIS: 'true', NUXT_PRERENDER: 'false' }
    });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('  ✅ Build completed successfully');
        resolve(true);
      } else {
        console.log(`  ❌ Build failed with code ${code}`);
        reject(new Error(`Build failed with code ${code}`));
      }
    });
    
    buildProcess.on('error', (error) => {
      console.log(`  ❌ Build error: ${error.message}`);
      reject(error);
    });
  });
}

// Main build function
async function safeBuild() {
  try {
    // Step 1: Ensure environment file exists
    ensureEnvFile();
    
    // Step 2: Clean build artifacts
    cleanBuild();
    
    // Step 3: Prepare Nuxt
    const prepared = prepareNuxt();
    if (!prepared) {
      throw new Error('Failed to prepare Nuxt');
    }
    
    // Step 4: Run build
    await runBuild();
    
    console.log('\n🎉 Safe build completed successfully!');
    console.log('💡 The application is ready for deployment.');
    
  } catch (error) {
    console.log('\n❌ Build failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Make sure all dependencies are installed: npm install');
    console.log('2. Check your environment variables in .env file');
    console.log('3. Try running: npm run fix');
    console.log('4. For development, use: npm run dev');
    
    process.exit(1);
  }
}

// Run the safe build
safeBuild(); 