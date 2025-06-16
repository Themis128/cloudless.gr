#!/usr/bin/env node
// Database Connectivity and Structure Check Script
// Combines database setup and checking functionality
// Tests connectivity, verifies tables, and creates missing structures
//
// Features:
//   • Database connectivity testing
//   • Table structure verification
//   • Permission testing
//   • Automatic table creation for missing structures
//   • Comprehensive database health check
//
// Usage Examples:
//   node scripts/06-check-database.js                # Full check and setup
//   node scripts/06-check-database.js --check-only   # Check only, no creation
//   node scripts/06-check-database.js --create-only  # Create missing tables only

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

// Parse command line arguments
const args = process.argv.slice(2);
const checkOnly = args.includes('--check-only');
const createOnly = args.includes('--create-only');

const adminSupabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Required table definitions
const requiredTables = {
    'profiles': {
        sql: `
            CREATE TABLE IF NOT EXISTS public.profiles (
                id UUID REFERENCES auth.users(id) PRIMARY KEY,
                role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Enable RLS
            ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
            
            -- Allow users to read their own profile
            CREATE POLICY IF NOT EXISTS "Users can view own profile" 
                ON public.profiles FOR SELECT 
                USING (auth.uid() = id);
            
            -- Allow users to update their own profile
            CREATE POLICY IF NOT EXISTS "Users can update own profile" 
                ON public.profiles FOR UPDATE 
                USING (auth.uid() = id);
        `,
        description: 'User profiles with role management'
    },
    'user-info': {
        sql: `
            CREATE TABLE IF NOT EXISTS public."user-info" (
                id UUID REFERENCES auth.users(id) PRIMARY KEY,
                full_name TEXT,
                avatar_url TEXT,
                bio TEXT,
                website TEXT,
                location TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            -- Enable RLS
            ALTER TABLE public."user-info" ENABLE ROW LEVEL SECURITY;
            
            -- Allow users to read their own info
            CREATE POLICY IF NOT EXISTS "Users can view own info" 
                ON public."user-info" FOR SELECT 
                USING (auth.uid() = id);
            
            -- Allow users to update their own info
            CREATE POLICY IF NOT EXISTS "Users can update own info" 
                ON public."user-info" FOR UPDATE 
                USING (auth.uid() = id);
                
            -- Allow users to insert their own info
            CREATE POLICY IF NOT EXISTS "Users can insert own info" 
                ON public."user-info" FOR INSERT 
                WITH CHECK (auth.uid() = id);
        `,
        description: 'Extended user information and profile data'
    }
};

async function checkConnectivity() {
    console.log('🔗 CHECKING DATABASE CONNECTIVITY...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        // Test basic connectivity
        const { data: healthCheck, error: healthError } = await adminSupabase
            .from('profiles')
            .select('count', { count: 'exact' })
            .limit(0);
        
        if (healthError && !healthError.message.includes('relation "public.profiles" does not exist')) {
            throw new Error(`Connectivity test failed: ${healthError.message}`);
        }
        
        console.log('  ✅ Database connection successful');
        
        // Test authentication
        const { data: { user }, error: authError } = await adminSupabase.auth.getUser();
        if (authError) {
            console.log('  ⚠️  Auth service connectivity warning:', authError.message);
        } else {
            console.log('  ✅ Authentication service accessible');
        }
        
        return true;
    } catch (error) {
        console.log('  ❌ Database connectivity failed:', error.message);
        console.log('');
        console.log('💡 Troubleshooting tips:');
        console.log('  • Ensure Supabase is running: docker-compose ps');
        console.log('  • Check environment variables in .env file');
        console.log('  • Verify ports are accessible: telnet localhost 54321');
        return false;
    }
}

async function checkTableStructure() {
    console.log('');
    console.log('📋 CHECKING TABLE STRUCTURE...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const tableStatus = {};
    
    for (const [tableName, tableInfo] of Object.entries(requiredTables)) {
        console.log(`\\n  🔍 Checking table: ${tableName}`);
        
        try {
            // Test table existence by querying it
            const { data, error } = await adminSupabase
                .from(tableName)
                .select('*')
                .limit(1);
            
            if (error) {
                if (error.message.includes('does not exist')) {
                    console.log(`    ❌ Table '${tableName}' does not exist`);
                    tableStatus[tableName] = 'missing';
                } else {
                    console.log(`    ⚠️  Table '${tableName}' has issues: ${error.message}`);
                    tableStatus[tableName] = 'issues';
                }
            } else {
                console.log(`    ✅ Table '${tableName}' exists and accessible`);
                console.log(`    📊 Description: ${tableInfo.description}`);
                tableStatus[tableName] = 'ok';
            }
        } catch (error) {
            console.log(`    ❌ Error checking table '${tableName}': ${error.message}`);
            tableStatus[tableName] = 'error';
        }
    }
    
    return tableStatus;
}

async function testPermissions() {
    console.log('');
    console.log('🔐 TESTING PERMISSIONS...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const testId = '00000000-0000-0000-0000-000000000000';
    const permissionResults = {};
    
    for (const tableName of Object.keys(requiredTables)) {
        console.log(`\\n  🧪 Testing permissions for: ${tableName}`);
        
        try {
            // Test SELECT permission
            const { error: selectError } = await adminSupabase
                .from(tableName)
                .select('*')
                .limit(1);
            
            if (selectError) {
                console.log(`    ❌ SELECT permission failed: ${selectError.message}`);
                permissionResults[tableName] = { select: false };
                continue;
            } else {
                console.log(`    ✅ SELECT permission OK`);
            }
            
            // For tables that exist, test other permissions
            // Note: We use a test ID that won't conflict with real data
            const testData = tableName === 'profiles' 
                ? { id: testId, role: 'user' }
                : { id: testId, full_name: 'Test User' };
            
            // Test INSERT (then immediately delete)
            const { error: insertError } = await adminSupabase
                .from(tableName)
                .insert(testData);
            
            if (insertError) {
                console.log(`    ⚠️  INSERT permission: ${insertError.message}`);
                permissionResults[tableName] = { ...permissionResults[tableName], insert: false };
            } else {
                console.log(`    ✅ INSERT permission OK`);
                permissionResults[tableName] = { ...permissionResults[tableName], insert: true };
                
                // Clean up test data
                await adminSupabase
                    .from(tableName)
                    .delete()
                    .eq('id', testId);
            }
            
        } catch (error) {
            console.log(`    ❌ Permission test failed: ${error.message}`);
            permissionResults[tableName] = { error: error.message };
        }
    }
    
    return permissionResults;
}

async function createMissingTables(tableStatus) {
    console.log('');
    console.log('🔧 CREATING MISSING TABLES...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const creationResults = {};
    
    for (const [tableName, status] of Object.entries(tableStatus)) {
        if (status === 'missing' || status === 'issues') {
            console.log(`\\n  🔧 Creating table: ${tableName}`);
            
            try {
                // Use the SQL from our table definitions
                const { error } = await adminSupabase.rpc('exec_sql', {
                    sql: requiredTables[tableName].sql
                });
                
                if (error) {
                    console.log(`    ❌ Failed to create ${tableName}: ${error.message}`);
                    creationResults[tableName] = false;
                } else {
                    console.log(`    ✅ Successfully created ${tableName}`);
                    console.log(`    📋 ${requiredTables[tableName].description}`);
                    creationResults[tableName] = true;
                }
            } catch (error) {
                console.log(`    ❌ Error creating ${tableName}: ${error.message}`);
                creationResults[tableName] = false;
            }
        } else if (status === 'ok') {
            console.log(`  ✅ Table ${tableName} already exists and is healthy`);
            creationResults[tableName] = true;
        }
    }
    
    return creationResults;
}

async function generateSummaryReport(connectivity, tableStatus, permissions, creationResults) {
    console.log('');
    console.log('📊 DATABASE HEALTH SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Connectivity status
    console.log(`\\n🔗 Connectivity: ${connectivity ? '✅ OK' : '❌ FAILED'}`);
    
    // Table status
    console.log('\\n📋 Table Status:');
    for (const [tableName, status] of Object.entries(tableStatus)) {
        const statusIcon = {
            'ok': '✅',
            'missing': '❌',
            'issues': '⚠️',
            'error': '❌'
        }[status] || '❓';
        
        console.log(`  ${statusIcon} ${tableName}: ${status.toUpperCase()}`);
        
        if (creationResults && creationResults[tableName] === true && status !== 'ok') {
            console.log(`    ✨ Fixed during this run`);
        }
    }
    
    // Permission status
    if (permissions && Object.keys(permissions).length > 0) {
        console.log('\\n🔐 Permissions:');
        for (const [tableName, perms] of Object.entries(permissions)) {
            if (perms.error) {
                console.log(`  ❌ ${tableName}: Error - ${perms.error}`);
            } else {
                const selectStatus = perms.select !== false ? '✅' : '❌';
                const insertStatus = perms.insert === true ? '✅' : '⚠️';
                console.log(`  ${tableName}: SELECT ${selectStatus} | INSERT ${insertStatus}`);
            }
        }
    }
    
    // Overall health
    const allTablesHealthy = Object.values(tableStatus).every(status => 
        status === 'ok' || (creationResults && creationResults[Object.keys(tableStatus).find(key => tableStatus[key] === status)] === true)
    );
    
    console.log('\\n🏥 Overall Health:');
    if (connectivity && allTablesHealthy) {
        console.log('  🎉 Database is healthy and ready for use!');
        return true;
    } else {
        console.log('  ⚠️  Database has issues that need attention');
        return false;
    }
}

// Main execution
async function main() {
    console.log('🗄️  DATABASE CHECK AND SETUP UTILITY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Mode: ${checkOnly ? 'CHECK ONLY' : createOnly ? 'CREATE ONLY' : 'CHECK AND CREATE'}`);
    
    const startTime = Date.now();
    
    try {
        let connectivity = true;
        let tableStatus = {};
        let permissions = {};
        let creationResults = {};
        
        // Step 1: Check connectivity (unless create-only mode)
        if (!createOnly) {
            connectivity = await checkConnectivity();
            if (!connectivity) {
                console.log('\\n❌ Cannot proceed without database connectivity');
                process.exit(1);
            }
        }
        
        // Step 2: Check table structure (unless create-only mode)
        if (!createOnly) {
            tableStatus = await checkTableStructure();
        }
        
        // Step 3: Create missing tables (unless check-only mode)
        if (!checkOnly) {
            if (createOnly) {
                // In create-only mode, assume all tables need creation
                tableStatus = Object.keys(requiredTables).reduce((acc, tableName) => {
                    acc[tableName] = 'missing';
                    return acc;
                }, {});
            }
            
            creationResults = await createMissingTables(tableStatus);
        }
        
        // Step 4: Test permissions (unless create-only mode)
        if (!createOnly && !checkOnly) {
            permissions = await testPermissions();
        }
        
        // Step 5: Generate summary
        const healthy = await generateSummaryReport(connectivity, tableStatus, permissions, creationResults);
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log(`\\n⏱️  Completed in ${duration} seconds`);
        
        if (healthy) {
            console.log('\\n📋 Next steps:');
            console.log('  • Run user management: node scripts/10-manage-users.js');
            console.log('  • Test authentication: node scripts/11-test-authentication.js');
            console.log('  • Check access points: node scripts/13-show-access-points.js');
            process.exit(0);
        } else {
            process.exit(1);
        }
        
    } catch (error) {
        console.log('\\n❌ FATAL ERROR:', error.message);
        console.log('\\n💡 Troubleshooting:');
        console.log('  • Ensure Supabase is running: docker-compose up -d');
        console.log('  • Check your .env file configuration');
        console.log('  • Run environment setup: .\\scripts\\01-setup-environment.ps1');
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);
