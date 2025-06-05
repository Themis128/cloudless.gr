#!/usr/bin/env node
/**
 * Clean script to remove temporary files and caches
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const pathsToClean = [
  '.nuxt',
  '.output',
  'dist',
  'coverage',
  'test-results',
  'node_modules/.cache',
  '.nitro',
  '.cache'
];

console.log('🧹 Starting project cleanup...');

async function cleanPath(path) {
  const fullPath = join(projectRoot, path);
  try {
    await fs.access(fullPath);
    await fs.rm(fullPath, { recursive: true, force: true });
    console.log(`✅ Cleaned: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.log(`⚠️  Could not clean ${path}: ${error.message}`);
    } else {
      console.log(`ℹ️  Path not found (already clean): ${path}`);
    }
  }
}

async function main() {
  for (const path of pathsToClean) {
    await cleanPath(path);
  }
  console.log('✨ Project cleanup completed!');
}

main().catch(console.error);
