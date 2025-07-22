#!/usr/bin/env node

/**
 * Build Fix Script for Cloudless LLM Dev Agent
 * Fixes common build issues and cleans up artifacts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Fixing build issues...\n');

// Clean up build artifacts
function cleanBuild() {
  console.log('🧹 Cleaning build artifacts...');
  
  const dirsToClean = ['.nuxt', '.output', 'dist', 'node_modules/.cache'];
  
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

// Check environment variables
function checkEnvironment() {
  console.log('🔍 Checking environment configuration...');
  
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.log('  ⚠️  No .env file found. Run "npm run setup" to configure environment.');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'NUXT_PUBLIC_SUPABASE_URL',
    'NUXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  let missingVars = [];
  requiredVars.forEach(varName => {
    if (!envContent.includes(varName) || envContent.includes(`${varName}=your-`)) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    console.log(`  ❌ Missing or invalid environment variables: ${missingVars.join(', ')}`);
    console.log('  💡 Run "npm run setup" to configure your environment.');
    return false;
  }
  
  console.log('  ✅ Environment variables configured');
  return true;
}

// Fix package.json imports
function fixPackageImports() {
  console.log('📦 Checking package.json imports...');
  
  const packagePath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    if (!packageJson.imports) {
      packageJson.imports = {};
    }
    
    // Add internal imports mapping
    packageJson.imports['#internal/nuxt/paths'] = './.nuxt/dist/server/paths.mjs';
    packageJson.imports['#internal/*'] = './.nuxt/dist/server/*';
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('  ✅ Added internal imports mapping');
  }
}

// Reinstall dependencies
function reinstallDependencies() {
  console.log('📦 Reinstalling dependencies...');
  
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('  ✅ Dependencies reinstalled');
  } catch (error) {
    console.log('  ❌ Failed to reinstall dependencies');
    return false;
  }
  
  return true;
}

// Prepare Nuxt
function prepareNuxt() {
  console.log('⚡ Preparing Nuxt...');
  
  try {
    execSync('npx nuxt prepare', { stdio: 'inherit' });
    console.log('  ✅ Nuxt prepared');
  } catch (error) {
    console.log('  ❌ Failed to prepare Nuxt');
    return false;
  }
  
  return true;
}

// Main fix function
async function fixBuild() {
  console.log('🚀 Starting build fix process...\n');
  
  // Step 1: Clean build artifacts
  cleanBuild();
  
  // Step 2: Check environment
  const envOk = checkEnvironment();
  if (!envOk) {
    console.log('\n❌ Environment not properly configured. Please run "npm run setup" first.');
    process.exit(1);
  }
  
  // Step 3: Fix package imports
  fixPackageImports();
  
  // Step 4: Reinstall dependencies
  const depsOk = reinstallDependencies();
  if (!depsOk) {
    console.log('\n❌ Failed to reinstall dependencies.');
    process.exit(1);
  }
  
  // Step 5: Prepare Nuxt
  const nuxtOk = prepareNuxt();
  if (!nuxtOk) {
    console.log('\n❌ Failed to prepare Nuxt.');
    process.exit(1);
  }
  
  console.log('\n✅ Build fix completed!');
  console.log('💡 You can now try running: npm run build');
}

// Run the fix
fixBuild().catch(console.error); 