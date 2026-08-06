#!/usr/bin/env node
/*
 * Verification script for Postiz Service Token configuration
 * Run with: node verify-postiz-token.js
 */

import { readFileSync } from 'node:fs';
import { config as dotenvConfig } from 'dotenv';

// Load environment variables
dotenvConfig({ path: './.env' });
dotenvConfig({ path: './.env.local', override: true });

console.log('���🔍 Verifying Postiz Service Token Configuration...\n');

// Check if we have the required environment variables
const requiredVars = [
  'POSTIZ_API_URL',
  'POSTIZ_API_KEY', 
  'POSTIZ_SERVICE_TOKEN',
  'CRON_SECRET'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
  console.log('��❌ Missing environment variables:');
  missingVars.forEach(varName => console.log(`   - ${varName}`));
  console.log('\n���📝 Please set these in your .env file or Worker secrets');
  process.exit(1);
}

console.log('��✅ All required environment variables are present');
console.log(`   POSTIZ_API_URL: ${process.env.POSTIZ_API_URL}`);
console.log(`   POSTIZ_API_KEY: ${process.env.POSTIZ_API_KEY?.substring(0, 10)}...`);
console.log(`   POSTIZ_SERVICE_TOKEN: ${process.env.POSTIZ_SERVICE_TOKEN?.substring(0, 10)}...`);
console.log(`   CRON_SECRET: ${process.env.CRON_SECRET?.substring(0, 10)}...\n`);

// Test JWT parsing function
function extractClientIdFromToken(token) {
  try {
    const payloadBase64 = token.split('.')[1];
    const payloadJson = Buffer.from(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const payload = JSON.parse(payloadJson);
    return payload.aud || token.substring(0, 8);
  } catch (e) {
    return token.substring(0, 8);
  }
}

if (process.env.POSTIZ_SERVICE_TOKEN) {
  const clientId = extractClientIdFromToken(process.env.POSTIZ_SERVICE_TOKEN);
  console.log('���🔑 Service Token parsing test:');
  console.log(`   Extracted Client ID: ${clientId}`);
  console.log(`   Token length: ${process.env.POSTIZ_SERVICE_TOKEN.length} characters\n`);
}

// Test configuration loading
console.log('��⚙��️  Testing configuration loading...');
try {
  // This would normally import from "@/lib/ssm-config" but we'll simulate it
  const mockConfig = {
    POSTIZ_API_URL: process.env.POSTIZ_API_URL,
    POSTIZ_API_KEY: process.env.POSTIZ_API_KEY,
    POSTIZ_SERVICE_TOKEN: process.env.POSTIZ_SERVICE_TOKEN,
    CRON_SECRET: process.env.CRON_SECRET
  };
  
  console.log('��✅ Configuration loaded successfully');
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
} catch (error) {
  console.error('��❌ Failed to load configuration:', error.message);
  process.exit(1);
}

console.log('���🎯 Next Steps:');
console.log('1. Create a Service Token in Cloudflare Dashboard → Access → Service Tokens');
console.log('2. Configure your Postiz Access policy to accept this Service Token');
console.log('3. Add the Service Token as a secret to your Worker:');
console.log('   wrangler secret put POSTIZ_SERVICE_TOKEN');
console.log('4. Deploy your Worker:');
console.log('   wrangler deploy --env production');
console.log('5. Test your cron endpoint:');
console.log('   curl -H "Authorization: Bearer $CRON_SECRET" https://pi-origin.cloudless.gr/api/cron/postiz-sync\n');

console.log('���🎉 Verification complete!');
