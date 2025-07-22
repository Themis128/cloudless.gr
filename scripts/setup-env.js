#!/usr/bin/env node

/**
 * Environment Setup Script for Cloudless LLM Dev Agent
 * Helps users configure their environment variables
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Cloudless LLM Dev Agent - Environment Setup\n');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupEnvironment() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), 'env.example');
  
  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    const overwrite = await question('⚠️  .env file already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('❌ Setup cancelled.');
      rl.close();
      return;
    }
  }

  console.log('📝 Setting up environment variables...\n');

  // Read the example file
  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  let envContent = envExample;

  // Supabase Configuration
  console.log('🔧 SUPABASE CONFIGURATION (Required)');
  console.log('Get these from your Supabase project dashboard: https://supabase.com/dashboard\n');
  
  const supabaseUrl = await question('Enter your Supabase URL (https://your-project.supabase.co): ');
  const supabaseAnonKey = await question('Enter your Supabase Anon Key: ');
  const supabaseServiceKey = await question('Enter your Supabase Service Role Key (optional): ');

  // Redis Configuration
  console.log('\n🔧 REDIS CONFIGURATION (Optional)');
  console.log('Set SKIP_REDIS=true to disable Redis and use in-memory storage\n');
  
  const skipRedis = await question('Skip Redis? (y/N): ');
  const useRedis = skipRedis.toLowerCase() !== 'y';

  let redisHost = 'localhost';
  let redisPort = '6379';
  let redisPassword = '';

  if (useRedis) {
    redisHost = await question('Redis Host (default: localhost): ') || 'localhost';
    redisPort = await question('Redis Port (default: 6379): ') || '6379';
    redisPassword = await question('Redis Password (optional): ') || '';
  }

  // Build Configuration
  console.log('\n🔧 BUILD CONFIGURATION');
  const enablePrerender = await question('Enable prerendering? (Y/n): ');
  const prerender = enablePrerender.toLowerCase() !== 'n';

  // Replace placeholders in the content
  envContent = envContent.replace('https://your-project.supabase.co', supabaseUrl);
  envContent = envContent.replace('your-anon-key-here', supabaseAnonKey);
  envContent = envContent.replace('your-service-role-key-here', supabaseServiceKey || '');
  
  envContent = envContent.replace('SKIP_REDIS=false', `SKIP_REDIS=${skipRedis.toLowerCase() === 'y'}`);
  envContent = envContent.replace('REDIS_HOST=localhost', `REDIS_HOST=${redisHost}`);
  envContent = envContent.replace('REDIS_PORT=6379', `REDIS_PORT=${redisPort}`);
  envContent = envContent.replace('REDIS_PASSWORD=', `REDIS_PASSWORD=${redisPassword}`);
  
  envContent = envContent.replace('NUXT_PRERENDER=true', `NUXT_PRERENDER=${prerender}`);

  // Write the .env file
  fs.writeFileSync(envPath, envContent);

  console.log('\n✅ Environment setup completed!');
  console.log('📁 Created .env file with your configuration');
  console.log('\n🔧 Next steps:');
  console.log('1. Review the .env file and adjust any settings');
  console.log('2. Run: npm install');
  console.log('3. Run: npm run dev');
  
  if (useRedis) {
    console.log('\n⚠️  Note: Make sure Redis is running on your system');
    console.log('   - For Docker: docker run -d -p 6379:6379 redis:alpine');
    console.log('   - For local: brew install redis && brew services start redis');
  } else {
    console.log('\nℹ️  Redis is disabled - using in-memory storage');
  }

  rl.close();
}

setupEnvironment().catch(console.error); 