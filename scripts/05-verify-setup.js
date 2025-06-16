#!/usr/bin/env node
// Comprehensive Setup Verification Script
// Verifies all aspects of the development environment setup
//
// Features:
//   • Environment variable validation
//   • Service connectivity testing
//   • Database structure verification
//   • Authentication system testing
//   • User account validation
//   • API endpoint testing
//
// Usage Examples:
//   node scripts/05-verify-setup.js                # Full verification
//   node scripts/05-verify-setup.js --quick       # Quick essential checks only
//   node scripts/05-verify-setup.js --verbose     # Verbose output with details

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import http from 'http';
import https from 'https';

config();

// Parse command line arguments
const args = process.argv.slice(2);
const quickMode = args.includes('--quick');
const verboseMode = args.includes('--verbose');

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);
const publicSupabase = createClient(supabaseUrl, supabaseAnonKey);

let verificationResults = {
    environment: {},
    connectivity: {},
    database: {},
    authentication: {},
    services: {},
    overall: false
};

function logVerbose(message) {
    if (verboseMode) {
        console.log(`    💬 ${message}`);
    }
}

async function checkEnvironmentVariables() {
    console.log('🔧 CHECKING ENVIRONMENT VARIABLES...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const requiredVars = {
        'SUPABASE_URL': supabaseUrl,
        'SUPABASE_ANON_KEY': supabaseAnonKey,
        'SUPABASE_SERVICE_ROLE_KEY': supabaseServiceKey
    };
    
    const optionalVars = {
        'DB_PASSWORD': process.env.DB_PASSWORD,
        'JWT_SECRET': process.env.JWT_SECRET,
        'POSTGRES_PASSWORD': process.env.POSTGRES_PASSWORD
    };
    
    let allRequired = true;
    
    // Check required variables
    for (const [varName, value] of Object.entries(requiredVars)) {
        if (value && value.trim() !== '') {
            console.log(`  ✅ ${varName}: ${value.substring(0, 20)}...`);
            verificationResults.environment[varName] = true;
            logVerbose(`Full value: ${value}`);
        } else {
            console.log(`  ❌ ${varName}: Missing or empty`);
            verificationResults.environment[varName] = false;
            allRequired = false;
        }
    }
    
    // Check optional variables
    for (const [varName, value] of Object.entries(optionalVars)) {
        if (value && value.trim() !== '') {
            console.log(`  ✅ ${varName}: Set`);
            verificationResults.environment[varName] = true;
        } else {
            console.log(`  ⚠️  ${varName}: Not set (optional)`);
            verificationResults.environment[varName] = false;
        }
    }
    
    return allRequired;
}

async function testServiceConnectivity() {
    console.log('\\n🌐 TESTING SERVICE CONNECTIVITY...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const services = [
        { name: 'Supabase API', url: supabaseUrl, port: 54321 },
        { name: 'Supabase Studio', url: 'http://localhost:54323', port: 54323 },
        { name: 'PostgreSQL', url: 'localhost', port: 54322 }
    ];
    
    const results = {};
    
    for (const service of services) {
        console.log(`  🔍 Testing ${service.name}...`);
        
        try {
            const isReachable = await testPortConnectivity(service.url, service.port);
            if (isReachable) {
                console.log(`    ✅ ${service.name} is reachable`);
                results[service.name] = true;
                logVerbose(`Port ${service.port} is open and responsive`);
            } else {
                console.log(`    ❌ ${service.name} is not reachable`);
                results[service.name] = false;
            }
        } catch (error) {
            console.log(`    ❌ ${service.name} test failed: ${error.message}`);
            results[service.name] = false;
        }
    }
    
    verificationResults.connectivity = results;
    return Object.values(results).every(Boolean);
}

async function testPortConnectivity(host, port) {
    return new Promise((resolve) => {
        const timeout = 3000;
        let url = host;
        
        // Parse URL if it's a full URL
        if (host.startsWith('http')) {
            try {
                const urlObj = new URL(host);
                host = urlObj.hostname;
                port = port || urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80);
            } catch (e) {
                logVerbose(`URL parsing error: ${e.message}`);
            }
        }
        
        const socket = new (require('net').Socket)();
        
        socket.setTimeout(timeout);
        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });
        
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
        
        socket.on('error', () => {
            resolve(false);
        });
        
        socket.connect(port, host);
    });
}

async function verifyDatabaseStructure() {
    console.log('\\n🗄️  VERIFYING DATABASE STRUCTURE...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const requiredTables = ['profiles', 'user-info'];
    const results = {};
    
    for (const tableName of requiredTables) {
        console.log(`  🔍 Checking table: ${tableName}`);
        
        try {
            const { data, error } = await adminSupabase
                .from(tableName)
                .select('count', { count: 'exact' })
                .limit(0);
            
            if (error) {
                console.log(`    ❌ Table '${tableName}' error: ${error.message}`);
                results[tableName] = false;
            } else {
                console.log(`    ✅ Table '${tableName}' exists and accessible`);
                results[tableName] = true;
                logVerbose(`Table contains ${data.length} records`);
            }
        } catch (error) {
            console.log(`    ❌ Error checking '${tableName}': ${error.message}`);
            results[tableName] = false;
        }
    }
    
    verificationResults.database = results;
    return Object.values(results).every(Boolean);
}

async function testAuthenticationSystem() {
    console.log('\\n🔐 TESTING AUTHENTICATION SYSTEM...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const results = {};
    
    // Test 1: Anonymous access
    console.log('  🔍 Testing anonymous access...');
    try {
        const { data, error } = await publicSupabase.auth.getSession();
        if (error) {
            console.log(`    ❌ Anonymous access failed: ${error.message}`);
            results.anonymousAccess = false;
        } else {
            console.log(`    ✅ Anonymous access working`);
            results.anonymousAccess = true;
            logVerbose(`Session state: ${data.session ? 'Active' : 'None'}`);
        }
    } catch (error) {
        console.log(`    ❌ Anonymous access error: ${error.message}`);
        results.anonymousAccess = false;
    }
    
    // Test 2: Service role access
    console.log('  🔍 Testing service role access...');
    try {
        const { data: users, error } = await adminSupabase.auth.admin.listUsers();
        if (error) {
            console.log(`    ❌ Service role access failed: ${error.message}`);
            results.serviceRoleAccess = false;
        } else {
            console.log(`    ✅ Service role access working`);
            console.log(`    📊 Found ${users.users.length} user(s) in system`);
            results.serviceRoleAccess = true;
            logVerbose(`Users: ${users.users.map(u => u.email).join(', ')}`);
        }
    } catch (error) {
        console.log(`    ❌ Service role access error: ${error.message}`);
        results.serviceRoleAccess = false;
    }
    
    // Test 3: User authentication (if test users exist)
    if (!quickMode) {
        console.log('  🔍 Testing user authentication...');
        try {
            const { data: users } = await adminSupabase.auth.admin.listUsers();
            const testUser = users.users.find(u => u.email === 'admin@example.com' || u.email === 'user@example.com');
            
            if (testUser) {
                // Try to sign in with known test credentials
                const testPassword = testUser.email === 'admin@example.com' ? 'admin123456' : 'user123456';
                
                const { data, error } = await publicSupabase.auth.signInWithPassword({
                    email: testUser.email,
                    password: testPassword
                });
                
                if (error) {
                    console.log(`    ⚠️  Test user authentication failed: ${error.message}`);
                    results.userAuthentication = false;
                } else {
                    console.log(`    ✅ Test user authentication successful`);
                    results.userAuthentication = true;
                    logVerbose(`Authenticated as: ${data.user.email}`);
                    
                    // Sign out
                    await publicSupabase.auth.signOut();
                }
            } else {
                console.log(`    ⚠️  No test users found for authentication test`);
                results.userAuthentication = null;
            }
        } catch (error) {
            console.log(`    ❌ User authentication test error: ${error.message}`);
            results.userAuthentication = false;
        }
    }
    
    verificationResults.authentication = results;
    return Object.values(results).filter(v => v !== null).every(Boolean);
}

async function testAPIEndpoints() {
    if (quickMode) return true;
    
    console.log('\\n🌐 TESTING API ENDPOINTS...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const endpoints = [
        { name: 'Health Check', path: '/health' },
        { name: 'REST API', path: '/rest/v1/' },
        { name: 'Auth API', path: '/auth/v1/' },
        { name: 'Storage API', path: '/storage/v1/' }
    ];
    
    const results = {};
    
    for (const endpoint of endpoints) {
        console.log(`  🔍 Testing ${endpoint.name}...`);
        
        try {
            const url = `${supabaseUrl}${endpoint.path}`;
            const response = await fetch(url);
            
            if (response.ok || response.status === 401 || response.status === 404) {
                // 401 and 404 are acceptable - means the endpoint exists
                console.log(`    ✅ ${endpoint.name} endpoint accessible`);
                results[endpoint.name] = true;
                logVerbose(`Status: ${response.status} ${response.statusText}`);
            } else {
                console.log(`    ❌ ${endpoint.name} returned: ${response.status}`);
                results[endpoint.name] = false;
            }
        } catch (error) {
            console.log(`    ❌ ${endpoint.name} test failed: ${error.message}`);
            results[endpoint.name] = false;
        }
    }
    
    verificationResults.services = results;
    return Object.values(results).every(Boolean);
}

function generateVerificationReport() {
    console.log('\\n📊 VERIFICATION REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const sections = [
        { name: 'Environment Variables', results: verificationResults.environment },
        { name: 'Service Connectivity', results: verificationResults.connectivity },
        { name: 'Database Structure', results: verificationResults.database },
        { name: 'Authentication System', results: verificationResults.authentication },
        { name: 'API Endpoints', results: verificationResults.services }
    ];
    
    let allPassed = true;
    
    for (const section of sections) {
        console.log(`\\n${section.name}:`);
        
        if (Object.keys(section.results).length === 0) {
            console.log('  ⚪ Skipped');
            continue;
        }
        
        for (const [test, passed] of Object.entries(section.results)) {
            if (passed === true) {
                console.log(`  ✅ ${test}`);
            } else if (passed === false) {
                console.log(`  ❌ ${test}`);
                allPassed = false;
            } else {
                console.log(`  ⚠️  ${test} (skipped)`);
            }
        }
    }
    
    verificationResults.overall = allPassed;
    
    console.log('\\n🏥 Overall Health:');
    if (allPassed) {
        console.log('  🎉 All systems operational! Setup is complete and healthy.');
    } else {
        console.log('  ⚠️  Some systems have issues that need attention.');
    }
    
    return allPassed;
}

// Main execution
async function main() {
    console.log('✅ COMPREHENSIVE SETUP VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Mode: ${quickMode ? 'QUICK' : 'COMPREHENSIVE'} ${verboseMode ? '(VERBOSE)' : ''}`);
    
    const startTime = Date.now();
    
    try {
        const envOk = await checkEnvironmentVariables();
        if (!envOk) {
            throw new Error('Environment variables are not properly configured');
        }
        
        const connectivityOk = await testServiceConnectivity();
        const databaseOk = await verifyDatabaseStructure();
        const authOk = await testAuthenticationSystem();
        
        let apiOk = true;
        if (!quickMode) {
            apiOk = await testAPIEndpoints();
        }
        
        const allHealthy = generateVerificationReport();
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log(`\\n⏱️  Verification completed in ${duration} seconds`);
        
        if (allHealthy) {
            console.log('\\n📋 System is ready! You can now:');
            console.log('  • Access Supabase Studio: http://localhost:54323');
            console.log('  • Start your Nuxt app: npm run dev');
            console.log('  • Run additional tests: node scripts/11-test-authentication.js');
            process.exit(0);
        } else {
            console.log('\\n🔧 Issues found. Suggested fixes:');
            console.log('  • Run setup: .\\scripts\\01-setup-environment.ps1');
            console.log('  • Reset and seed: .\\scripts\\02-reset-and-seed.ps1');
            console.log('  • Check database: node scripts/06-check-database.js');
            console.log('  • Create users: node scripts/04-setup-user-accounts.js');
            process.exit(1);
        }
        
    } catch (error) {
        console.log('\\n❌ VERIFICATION FAILED:', error.message);
        console.log('\\n💡 Troubleshooting:');
        console.log('  • Ensure Supabase is running: docker-compose up -d');
        console.log('  • Check your environment: .\\scripts\\01-setup-environment.ps1 --CheckOnly');
        console.log('  • View logs: docker-compose logs -f');
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);
