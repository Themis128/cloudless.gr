#!/usr/bin/env node
/**
 * Health Check Script for Cloudless.gr
 * Performs comprehensive health checks on the development environment
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('🏥 Cloudless.gr Health Check\n');

let issues = [];
let warnings = [];

// Helper function to run commands safely
function runCommand(command, description) {
  try {
    const result = execSync(command, { 
      cwd: projectRoot, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(`✅ ${description}`);
    return result;
  } catch (error) {
    console.log(`❌ ${description}`);
    issues.push(`${description}: ${error.message}`);
    return null;
  }
}

// Helper function to check file existence
function checkFile(filePath, description) {
  const fullPath = join(projectRoot, filePath);
  if (existsSync(fullPath)) {
    console.log(`✅ ${description}`);
    return true;
  } else {
    console.log(`❌ ${description}`);
    issues.push(`Missing file: ${filePath}`);
    return false;
  }
}

// Helper function for warnings
function checkWarning(condition, description) {
  if (condition) {
    console.log(`✅ ${description}`);
    return true;
  } else {
    console.log(`⚠️  ${description}`);
    warnings.push(description);
    return false;
  }
}

console.log('📁 Checking Project Structure...');
checkFile('package.json', 'Package.json exists');
checkFile('nuxt.config.ts', 'Nuxt config exists');
checkFile('tsconfig.json', 'TypeScript config exists');
checkFile('.env.example', 'Environment example exists');

console.log('\n📦 Checking Dependencies...');
try {
  const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
  const hasVuetify = packageJson.dependencies?.vuetify || packageJson.devDependencies?.vuetify;
  checkWarning(hasVuetify, 'Vuetify dependency found');
  
  const hasVueTypeSupport = packageJson.devDependencies?.['vue-tsc'] || packageJson.dependencies?.['vue-tsc'];
  checkWarning(hasVueTypeSupport, 'Vue TypeScript support found');
} catch (error) {
  issues.push('Could not parse package.json');
}

console.log('\n🔧 Checking Node.js Environment...');
runCommand('node --version', 'Node.js version check');
runCommand('npm --version', 'npm version check');

console.log('\n📝 Checking Code Quality...');
const lintResult = runCommand('npm run lint -- --max-warnings 0', 'ESLint check');
const typeResult = runCommand('npm run type-check', 'TypeScript check');

console.log('\n🎨 Checking Vuetify Setup...');
checkFile('plugins/vuetify.ts', 'Vuetify plugin exists');
checkFile('layouts/default.vue', 'Default layout exists');

console.log('\n🗄️ Checking Database Setup...');
// Using Supabase instead of Prisma
checkFile('supabase-schema.sql', 'Supabase schema exists');
checkFile('supabase-overview.json', 'Supabase configuration exists');

console.log('\n🐳 Checking Docker Setup...');
checkFile('Dockerfile', 'Dockerfile exists');
checkFile('docker-compose.dev.yml', 'Docker compose dev config exists');
checkFile('.devcontainer/devcontainer.json', 'Dev container config exists');

console.log('\n📊 Health Check Summary');
console.log('='.repeat(50));

if (issues.length === 0 && warnings.length === 0) {
  console.log('🎉 All checks passed! Your environment is healthy.');
  process.exit(0);
} else {
  if (issues.length > 0) {
    console.log(`\n❌ ${issues.length} Critical Issues Found:`);
    issues.forEach((issue, index) => {
      console.log(`   ${index + 1}. ${issue}`);
    });
  }
  
  if (warnings.length > 0) {
    console.log(`\n⚠️  ${warnings.length} Warnings:`);
    warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }

  console.log('\n💡 Recommendations:');
  console.log('   • Run "npm install" to ensure all dependencies are installed');
  console.log('   • Run "npm run auto-fix" to fix common issues');
  console.log('   • Check the VS Code problems panel for specific errors');
  
  if (issues.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}
