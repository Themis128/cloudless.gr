#!/usr/bin/env node

/**
 * Studio Access Tester
 * Tests if Supabase Studio is accessible on the configured port
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

async function testStudioAccess() {
  console.log('🔍 Testing Supabase Studio Access');
  console.log('==================================\n');

  const ports = [54323, 3000, 8082]; // Common Studio ports
  
  for (const port of ports) {
    try {
      console.log(`🔌 Testing port ${port}...`);
      
      const response = await fetch(`http://localhost:${port}`, {
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        console.log(`✅ Studio accessible on port ${port}!`);
        console.log(`🌐 Access URL: http://localhost:${port}`);
        
        // Check if it looks like Studio
        const html = await response.text();
        if (html.includes('Supabase') || html.includes('studio')) {
          console.log('✅ Confirmed: This is Supabase Studio');
        } else {
          console.log('⚠️  Service responding but may not be Studio');
        }
        console.log('');
        return port;
      }
    } catch (error) {
      console.log(`❌ Port ${port} not accessible: ${error.message}`);
    }
  }
  
  console.log('\n❌ Studio not accessible on any common ports');
  console.log('\n💡 Troubleshooting steps:');
  console.log('   1. Check if containers are running: docker-compose ps');
  console.log('   2. Check Studio container logs: docker logs supabase-studio');
  console.log('   3. Restart containers: docker-compose restart studio');
  console.log('   4. Check .env file for STUDIO_PORT configuration');
  
  return null;
}

async function checkDockerContainers() {
  console.log('🐳 Checking Docker containers...');
  
  try {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec('docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', (error, stdout) => {
        if (error) {
          console.log('❌ Could not check Docker containers');
          resolve(false);
        } else {
          console.log('📋 Supabase containers status:');
          console.log(stdout);
          resolve(true);
        }
      });
    });
  } catch (error) {
    console.log('❌ Could not check Docker status');
    return false;
  }
}

// Run the tests
async function main() {
  await checkDockerContainers();
  console.log('');
  const accessiblePort = await testStudioAccess();
  
  if (accessiblePort) {
    console.log(`🎉 Studio is accessible! Use: http://localhost:${accessiblePort}`);
  }
}

main().catch(console.error);

export { testStudioAccess };
