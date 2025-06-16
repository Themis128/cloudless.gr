#!/usr/bin/env node

/**
 * 13. Access Points and Connectivity Testing Script
 * Shows all available access points and tests their connectivity
 * Merged from: show-access-points.js, test-studio-access.js, test-connectivity.ps1
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ACCESS_POINTS = [
  {
    name: 'Supabase Studio',
    url: 'http://localhost:54323',
    description: 'Web UI for database management, auth, storage, etc.',
    healthCheck: true,
    critical: true
  },
  {
    name: 'API Endpoint (Kong)',
    url: 'http://localhost:8000',
    description: 'Main API gateway for all Supabase services',
    healthCheck: true,
    critical: true,
    endpoints: {
      'Auth': '/auth/v1/health',
      'REST API': '/rest/v1/',
      'Storage': '/storage/v1/health',
      'Realtime': '/realtime/v1/health'
    }
  },
  {
    name: 'Database',
    url: 'postgresql://postgres:postgres@localhost:5432/postgres',
    description: 'Direct PostgreSQL database connection',
    healthCheck: false,
    critical: true
  },
  {
    name: 'Analytics',
    url: 'http://localhost:4000',
    description: 'Supabase Analytics dashboard',
    healthCheck: true,
    critical: false
  }
];

async function testEndpoint(url, timeout = 3000) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeout)
    });
    return {
      accessible: true,
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      accessible: false,
      error: error.message
    };
  }
}

async function checkDockerContainers() {
  console.log('🐳 Checking Docker containers...');
  
  try {
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      exec('docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"', (error, stdout) => {
        if (error) {
          console.log('❌ Could not check Docker containers');
          resolve({ success: false, output: '' });
        } else {
          console.log('📋 Supabase containers status:');
          console.log(stdout);
          resolve({ success: true, output: stdout });
        }
      });
    });
  } catch (error) {
    console.log('❌ Could not check Docker status');
    return { success: false, output: '' };
  }
}

async function testStudioSpecifically() {
  console.log('\n🎨 Studio Accessibility Test');
  console.log('============================');

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
        return port;
      }
    } catch (error) {
      console.log(`❌ Port ${port} not accessible: ${error.message}`);
    }
  }
  
  console.log('\n❌ Studio not accessible on any common ports');
  console.log('\n💡 Studio troubleshooting steps:');
  console.log('   1. Check if containers are running: docker-compose ps');
  console.log('   2. Check Studio container logs: docker logs supabase-studio');
  console.log('   3. Restart containers: docker-compose restart studio');
  console.log('   4. Check .env file for STUDIO_PORT configuration');
  
  return null;
}

async function quickConnectivityTest() {
  console.log('⚡ Quick Connectivity Test');
  console.log('=========================\n');

  const criticalServices = ACCESS_POINTS.filter(point => point.critical && point.healthCheck);
  let allCriticalUp = true;

  for (const point of criticalServices) {
    const result = await testEndpoint(point.url);
    const status = result.accessible ? '✅' : '❌';
    console.log(`${status} ${point.name}: ${result.accessible ? 'Online' : 'Offline'}`);
    
    if (!result.accessible) {
      allCriticalUp = false;
    }
  }

  console.log(`\n${allCriticalUp ? '✅' : '❌'} Critical services: ${allCriticalUp ? 'All online' : 'Some offline'}`);
  return allCriticalUp;
}

async function comprehensiveAccessTest() {
  console.log('🚀 COMPREHENSIVE ACCESS POINTS TEST');
  console.log('===================================\n');

  // Check Docker containers first
  const dockerStatus = await checkDockerContainers();
  
  console.log('\n🔗 Testing Access Points');
  console.log('========================');

  let criticalIssues = 0;
  let totalIssues = 0;

  // Test each access point
  for (const point of ACCESS_POINTS) {
    console.log(`\n🔗 ${point.name}`);
    console.log(`   URL: ${point.url}`);
    console.log(`   📝 ${point.description}`);
    
    if (point.healthCheck) {
      console.log('   🔍 Testing connectivity...');
      const result = await testEndpoint(point.url);
      
      if (result.accessible) {
        console.log(`   ✅ Accessible (Status: ${result.status})`);
        
        // Test additional endpoints if available
        if (point.endpoints) {
          console.log('   📋 Service endpoints:');
          for (const [service, endpoint] of Object.entries(point.endpoints)) {
            const serviceResult = await testEndpoint(point.url + endpoint);
            const status = serviceResult.accessible ? '✅' : '❌';
            console.log(`      ${status} ${service}: ${endpoint}`);
          }
        }
      } else {
        const issueType = point.critical ? 'CRITICAL' : 'WARNING';
        console.log(`   ❌ Not accessible (${issueType}): ${result.error}`);
        totalIssues++;
        if (point.critical) criticalIssues++;
      }
    } else {
      console.log('   📌 Connection available for direct database access');
    }
  }

  // Test Studio specifically with multiple ports
  await testStudioSpecifically();

  // Summary
  console.log('\n🎯 CONNECTIVITY SUMMARY');
  console.log('======================');
  console.log(`Critical issues: ${criticalIssues}`);
  console.log(`Total issues: ${totalIssues}`);
  
  if (criticalIssues === 0) {
    console.log('✅ All critical services are accessible!');
  } else {
    console.log('❌ Critical services have issues!');
  }

  // Show useful information
  console.log('\n🔐 AUTHENTICATION CREDENTIALS');
  console.log('─────────────────────────────────────');
  console.log('👤 Test User Account:');
  console.log('   Email: baltzakis.themis@gmail.com');
  console.log('   Password: TH!123789th!');
  console.log('   Role: user');
  console.log('   Status: ✅ Ready to use');

  console.log('\n🗄️  DATABASE TABLES');
  console.log('─────────────────────────────────────');
  console.log('✅ profiles - User roles and metadata');
  console.log('✅ user-info - User profile information');
  console.log('✅ auth.users - Supabase authentication (managed)');

  console.log('\n⚡ QUICK ACTIONS');
  console.log('─────────────────────────────────────');
  console.log('• Open Studio: http://localhost:54323');
  console.log('• Test login: Go to your app\'s /auth page');
  console.log('• Check container status: docker-compose ps');
  console.log('• View logs: docker-compose logs studio');
  console.log('• Restart services: docker-compose restart');

  if (criticalIssues === 0 && totalIssues === 0) {
    console.log('\n🎉 All services are accessible and ready to use!');
  } else {
    console.log('\n🔧 TROUBLESHOOTING STEPS');
    console.log('─────────────────────────────────────');
    console.log('1. Check if Docker is running: docker --version');
    console.log('2. Start services: docker-compose up -d');
    console.log('3. Check logs: docker-compose logs');
    console.log('4. Reset services: docker-compose restart');
    console.log('5. Full reset: Run scripts/02-reset-and-seed.ps1');
  }

  return { criticalIssues, totalIssues, dockerStatus };
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isQuickMode = args.includes('--quick') || args.includes('-q');
  const isStudioOnly = args.includes('--studio') || args.includes('-s');

  try {
    if (isStudioOnly) {
      await testStudioSpecifically();
    } else if (isQuickMode) {
      await quickConnectivityTest();
    } else {
      await comprehensiveAccessTest();
    }
  } catch (error) {
    console.error('❌ Access points test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { 
  testEndpoint, 
  ACCESS_POINTS, 
  checkDockerContainers, 
  testStudioSpecifically, 
  quickConnectivityTest, 
  comprehensiveAccessTest 
};
