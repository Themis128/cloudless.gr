#!/usr/bin/env node
/**
 * Setup script to help with Supabase database initialization
 * This script will guide you through setting up your database tables
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function main() {
  console.log('🗄️  Supabase Database Setup Guide');
  console.log('=====================================\n');
  
  try {
    // Read the environment to get Supabase project info
    const envContent = await fs.readFile(join(projectRoot, '.env'), 'utf-8');
    const supabaseUrl = envContent.match(/SUPABASE_URL=(.+)/)?.[1];
    
    if (supabaseUrl) {
      const projectId = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1];
      console.log(`📋 Your Supabase Project ID: ${projectId}`);
      console.log(`🌐 Your Supabase URL: ${supabaseUrl}\n`);
    }
    
    console.log('📝 To set up your database tables:');
    console.log('1. Open your Supabase dashboard:');
    console.log('   👉 https://supabase.com/dashboard/projects');
    console.log('');
    console.log('2. Navigate to SQL Editor');
    console.log('');
    console.log('3. Run these SQL files in order:');
    console.log('');
    
    // Show the SQL files to run
    const sqlFiles = [
      'supabase-schema.sql',
      'supabase-instruments-setup.sql'
    ];
    
    for (const file of sqlFiles) {
      const filePath = join(projectRoot, file);
      try {
        await fs.access(filePath);
        console.log(`✅ ${file}`);
        console.log(`   Copy contents from: ${filePath}`);
      } catch {
        console.log(`❌ ${file} - FILE NOT FOUND`);
      }
    }
    
    console.log('');
    console.log('4. After running the SQL:');
    console.log('   - Run: npm run test');
    console.log('   - Your Supabase tests should pass! 🎉');
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   - If tests still fail, check RLS policies');
    console.log('   - Make sure your anon key has proper permissions');
    console.log('   - Verify tables exist in Table Editor');
    
  } catch (error) {
    console.error('❌ Error reading environment:', error.message);
  }
}

main().catch(console.error);
