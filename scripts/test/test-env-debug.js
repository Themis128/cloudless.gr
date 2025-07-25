#!/usr/bin/env node

// Environment Variable Debug Script
console.log('🔍 Environment Variable Debug Script');
console.log('=====================================');

// Print all environment variables
console.log('\n📋 All environment variables:');
Object.keys(process.env)
  .filter((key) => /(NITRO|NUXT|NODE)/i.test(key))
  .sort()
  .forEach((key) => {
    const value =
      key.includes('KEY') || key.includes('SECRET')
        ? process.env[key]?.substring(0, 10) + '...'
        : process.env[key];
    console.log(`  ${key}: ${value}`);
  });

// Check critical environment variables
console.log('\n🔧 Critical environment variables:');
const criticalVars = [
  'NODE_ENV',
  'NITRO_HOST',
  'NITRO_PORT',
  'NITRO_LOG_LEVEL',
  // Removed Supabase variables - using Prisma instead
];

criticalVars.forEach((varName) => {
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

// Check for .env file
const fs = require('fs');
const path = require('path');

console.log('\n📁 File checks:');
const files = ['.env', 'nuxt.config.ts', '.output/server/index.mjs'];
files.forEach((file) => {
  const exists = fs.existsSync(file);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${file}: ${exists ? 'exists' : 'missing'}`);
});

// Check if we're in the right directory
console.log('\n📂 Directory check:');
const packageJsonExists = fs.existsSync('package.json');
console.log(
  `  ${packageJsonExists ? '✅' : '❌'} package.json: ${packageJsonExists ? 'found' : 'missing'}`
);

if (packageJsonExists) {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`  📦 Project name: ${packageJson.name || 'unknown'}`);
    console.log(`  📦 Node version: ${process.version}`);
  } catch (error) {
    console.log(`  ❌ Error reading package.json: ${error.message}`);
  }
}

console.log('\n🎉 Environment debug completed!');
