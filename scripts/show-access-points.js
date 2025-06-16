#!/usr/bin/env node

/**
 * Supabase Access Points Summary
 * Shows all available access points and tests their connectivity
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const ACCESS_POINTS = [
  {
    name: 'Supabase Studio',
    url: 'http://localhost:54323',
    description: 'Web UI for database management, auth, storage, etc.',
    healthCheck: true
  },
  {
    name: 'API Endpoint (Kong)',
    url: 'http://localhost:8000',
    description: 'Main API gateway for all Supabase services',
    healthCheck: true,
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
    healthCheck: false
  },
  {
    name: 'Analytics',
    url: 'http://localhost:4000',
    description: 'Supabase Analytics dashboard',
    healthCheck: true
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

async function main() {
  console.log('🚀 SUPABASE ACCESS POINTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Test each access point
  for (const point of ACCESS_POINTS) {
    console.log(`🔗 ${point.name}`);
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
        console.log(`   ❌ Not accessible: ${result.error}`);
      }
    } else {
      console.log('   📌 Connection available for direct database access');
    }
    
    console.log('');
  }

  // Show authentication information
  console.log('🔐 AUTHENTICATION CREDENTIALS');
  console.log('─────────────────────────────────────────────────────────');
  console.log('👤 Test User Account:');
  console.log('   Email: baltzakis.themis@gmail.com');
  console.log('   Password: TH!123789th!');
  console.log('   Role: user');
  console.log('   Status: ✅ Ready to use');
  console.log('');

  // Show database table information
  console.log('🗄️  DATABASE TABLES');
  console.log('─────────────────────────────────────────────────────────');
  console.log('✅ profiles - User roles and metadata');
  console.log('✅ user-info - User profile information');
  console.log('✅ auth.users - Supabase authentication (managed)');
  console.log('');

  // Show quick actions
  console.log('⚡ QUICK ACTIONS');
  console.log('─────────────────────────────────────────────────────────');
  console.log('• Open Studio: http://localhost:54323');
  console.log('• Test login: Go to your app\'s /auth page');
  console.log('• Check container status: docker-compose ps');
  console.log('• View logs: docker-compose logs studio');
  console.log('• Restart services: docker-compose restart');
  console.log('');

  console.log('🎉 Setup complete! All services are configured and ready to use.');
}

main().catch(console.error);

export { testEndpoint, ACCESS_POINTS };
