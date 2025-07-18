#!/usr/bin/env node

// Load environment variables from .env file manually
const { existsSync, readFileSync } = require('fs');
const { join } = require('path');

// Load .env file if it exists
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  console.log('Loading environment variables from .env file...');
  try {
    const envContent = readFileSync(envPath, 'utf8');
    const envLines = envContent.split('\n');
    
    for (const line of envLines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    }
    console.log('Environment variables loaded from .env file');
  } catch (error) {
    console.log('Error loading .env file:', error.message);
  }
} else {
  console.log('No .env file found, using system environment variables');
}

console.log('==================== DEBUG START ====================');
console.log('Node.js version:', process.version);
console.log('Process arguments:', process.argv);
console.log('Environment variables:');
console.log(process.env);
console.log('Current working directory:', process.cwd());

const { readdirSync, statSync } = require('fs');

function printDirTree(dir, prefix = '') {
  try {
    const files = readdirSync(dir);
    for (const file of files) {
      const fullPath = join(dir, file);
      const stats = statSync(fullPath);
      console.log(prefix + (stats.isDirectory() ? '[D] ' : '[F] ') + file);
      if (stats.isDirectory()) {
        printDirTree(fullPath, prefix + '  ');
      }
    }
  } catch (e) {
    console.error('Error reading directory', dir, e);
  }
}

console.log('File tree from current directory:');
printDirTree(process.cwd());

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  process.exit(1);
});

console.log('==================== DEBUG END ====================');

console.log('Starting server with debug script...');

async function startServer() {
  try {
    console.log('Setting up environment...');
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    process.env.NUXT_HOST = process.env.NUXT_HOST || '0.0.0.0';
    process.env.NUXT_PORT = process.env.NUXT_PORT || '3000';
    process.env.NITRO_HOST = process.env.NITRO_HOST || '0.0.0.0';
    process.env.NITRO_PORT = process.env.NITRO_PORT || '3000';
    process.env.NITRO_DEBUG = process.env.NITRO_DEBUG || '1';
    process.env.DEBUG = process.env.DEBUG || '*';
    process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || '--trace-warnings --trace-uncaught';
    
    console.log('Environment variables set');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('NUXT_HOST:', process.env.NUXT_HOST);
    console.log('NUXT_PORT:', process.env.NUXT_PORT);
    console.log('NITRO_DEBUG:', process.env.NITRO_DEBUG);
    console.log('DEBUG:', process.env.DEBUG);
    console.log('NODE_OPTIONS:', process.env.NODE_OPTIONS);
    console.log('NUXT_PUBLIC_SUPABASE_URL:', process.env.NUXT_PUBLIC_SUPABASE_URL);
    console.log('NUXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
    console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET');
    
    console.log('Importing server module...');
    const serverModule = await import('./.output/server/index.mjs');
    console.log('Server module imported successfully');
    console.log('Available exports:', Object.keys(serverModule));
    
    if (serverModule.listener) {
      console.log('Creating HTTP server with Nitro listener...');
      const { createServer } = await import('node:http');
      const port = process.env.NUXT_PORT || 3000;
      const host = process.env.NUXT_HOST || '0.0.0.0';
      createServer(serverModule.listener).listen(port, host, () => {
        console.log(`✅ Server listening on http://${host}:${port}`);
      });
    } else {
      console.log('No listener function found');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer(); 