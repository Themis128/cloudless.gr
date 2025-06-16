#!/usr/bin/env node

/**
 * 03. Create Database Tables Script
 * Creates all required database tables and verifies their structure
 * Merged from: create-tables-direct.js, setup-database.js, test-and-create-tables.js
 */

import pkg from 'pg';
const { Client } = pkg;

// Database configuration
const DB_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
};

// Alternative configurations to try
const DB_CONFIGS = [
  {
    name: 'Standard PostgreSQL',
    config: DB_CONFIG
  },
  {
    name: 'Supabase Admin',
    config: {
      ...DB_CONFIG,
      user: 'supabase_admin'
    }
  },
  {
    name: 'Auth Admin',
    config: {
      ...DB_CONFIG,
      user: 'supabase_auth_admin'
    }
  }
];

// Table creation SQL
const CREATE_TABLES_SQL = {
  profiles: `
    CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,
  
  userInfo: `
    CREATE TABLE IF NOT EXISTS public."user-info" (
        id UUID PRIMARY KEY,
        full_name TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `,
  
  // Create indexes for better performance
  profilesIndex: `
    CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
  `,
  
  userInfoIndex: `
    CREATE INDEX IF NOT EXISTS idx_user_info_name ON public."user-info"(full_name);
  `
};

async function testConnection(config) {
  const client = new Client(config);
  try {
    await client.connect();
    console.log(`✅ Connected successfully with: ${config.user}@${config.database}`);
    return client;
  } catch (error) {
    console.log(`❌ Failed to connect with: ${config.user}@${config.database} - ${error.message}`);
    return null;
  }
}

async function checkDatabaseSchema(client) {
  try {
    console.log('🔍 Checking database schema...');
    
    // Check available schemas
    const schemaResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('auth', 'public', 'storage')
      ORDER BY schema_name;
    `);
    
    console.log('📋 Available schemas:', schemaResult.rows.map(r => r.schema_name));

    // Check if auth.users table exists (Supabase managed)
    const authUsersResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' 
        AND table_name = 'users'
      );
    `);
    
    const authUsersExists = authUsersResult.rows[0].exists;
    console.log('👥 Auth users table exists:', authUsersExists ? '✅' : '❌');

    return { authUsersExists };
  } catch (error) {
    console.log('❌ Error checking schema:', error.message);
    return { authUsersExists: false };
  }
}

async function createTable(client, tableName, sql) {
  try {
    console.log(`📋 Creating ${tableName} table...`);
    await client.query(sql);
    console.log(`✅ ${tableName} table created successfully`);
    return true;
  } catch (error) {
    console.log(`❌ Failed to create ${tableName} table: ${error.message}`);
    return false;
  }
}

async function verifyTablesExist(client) {
  try {
    console.log('🔍 Verifying table creation...');
    
    const result = await client.query(`
      SELECT table_name, 
             column_name, 
             data_type, 
             is_nullable,
             column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('profiles', 'user-info')
      ORDER BY table_name, ordinal_position;
    `);

    if (result.rows.length === 0) {
      console.log('❌ No tables found');
      return false;
    }

    console.log('📊 Table Structure:');
    console.log('══════════════════════════════════════════════════════════');
    
    let currentTable = '';
    for (const row of result.rows) {
      if (row.table_name !== currentTable) {
        currentTable = row.table_name;
        console.log(`\n📋 Table: ${currentTable}`);
        console.log('─────────────────────────────────────────────────────');
      }
      
      const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
      console.log(`   ${row.column_name}: ${row.data_type} ${nullable}${defaultVal}`);
    }

    // Check table counts
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('profiles', 'user-info')
      ORDER BY table_name;
    `);

    const createdTables = tablesResult.rows.map(r => r.table_name);
    console.log(`\n✅ Created tables: ${createdTables.join(', ')}`);
    
    return createdTables.length === 2;
  } catch (error) {
    console.log('❌ Error verifying tables:', error.message);
    return false;
  }
}

async function createAllTables(client, schemaInfo) {
  console.log('\n🔧 Creating database tables...');
  console.log('═══════════════════════════════════════════════════════════');

  let successCount = 0;
  const totalTables = 2; // profiles and user-info

  // Create profiles table
  if (await createTable(client, 'profiles', CREATE_TABLES_SQL.profiles)) {
    successCount++;
  }

  // Create user-info table
  if (await createTable(client, 'user-info', CREATE_TABLES_SQL.userInfo)) {
    successCount++;
  }

  // Create indexes
  console.log('\n🔗 Creating indexes...');
  try {
    await client.query(CREATE_TABLES_SQL.profilesIndex);
    await client.query(CREATE_TABLES_SQL.userInfoIndex);
    console.log('✅ Indexes created successfully');
  } catch (error) {
    console.log('⚠️  Warning: Some indexes may not have been created:', error.message);
  }

  // Enable RLS (Row Level Security) if this is a Supabase setup
  if (schemaInfo.authUsersExists) {
    console.log('\n🔒 Configuring Row Level Security...');
    try {
      await client.query('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;');
      await client.query('ALTER TABLE public."user-info" ENABLE ROW LEVEL SECURITY;');
      console.log('✅ RLS enabled on tables');
    } catch (error) {
      console.log('⚠️  Warning: Could not enable RLS:', error.message);
    }
  }

  return { successCount, totalTables };
}

async function quickTableCheck() {
  console.log('⚡ Quick Table Check');
  console.log('==================\n');

  try {
    // Try Docker exec first (fastest method)
    const { exec } = require('child_process');
    
    return new Promise((resolve) => {
      const checkCommand = `docker exec supabase-db psql -U postgres -d postgres -c "
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('profiles', 'user-info');"`;

      exec(checkCommand, (error, stdout) => {
        if (error) {
          console.log('❌ Docker check failed, trying direct connection...');
          resolve(false);
        } else {
          const hasProfiles = stdout.includes('profiles');
          const hasUserInfo = stdout.includes('user-info');
          
          console.log(`${hasProfiles ? '✅' : '❌'} profiles table`);
          console.log(`${hasUserInfo ? '✅' : '❌'} user-info table`);
          
          if (hasProfiles && hasUserInfo) {
            console.log('\n✅ All required tables exist!');
            resolve(true);
          } else {
            console.log('\n❌ Some tables are missing');
            resolve(false);
          }
        }
      });
    });
  } catch (error) {
    console.log('❌ Quick check failed:', error.message);
    return false;
  }
}

async function comprehensiveTableCreation() {
  console.log('🗄️  COMPREHENSIVE DATABASE TABLE CREATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  let successfulClient = null;
  
  // Try each database configuration
  for (const { name, config } of DB_CONFIGS) {
    console.log(`🔌 Trying: ${name}...`);
    const client = await testConnection(config);
    
    if (client) {
      successfulClient = client;
      console.log(`✅ Using: ${name}\n`);
      break;
    }
  }

  if (!successfulClient) {
    console.log('❌ Could not connect to any database configuration');
    console.log('\n💡 Troubleshooting steps:');
    console.log('   1. Check if PostgreSQL is running: docker-compose ps db');
    console.log('   2. Verify credentials in .env file');
    console.log('   3. Try: docker-compose restart db');
    console.log('   4. Check database logs: docker-compose logs db');
    return false;
  }

  // Check database schema
  const schemaInfo = await checkDatabaseSchema(successfulClient);

  // Create tables
  const { successCount, totalTables } = await createAllTables(successfulClient, schemaInfo);
  
  // Verify creation
  const verificationSuccess = await verifyTablesExist(successfulClient);
  
  // Close connection
  await successfulClient.end();
  console.log('\n🔌 Database connection closed');

  // Summary
  console.log('\n🎯 TABLE CREATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Tables created: ${successCount}/${totalTables}`);
  console.log(`Verification: ${verificationSuccess ? 'Passed' : 'Failed'}`);
  
  if (successCount === totalTables && verificationSuccess) {
    console.log('\n🎉 All database tables created successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Setup user accounts: node scripts/10-manage-users.js setup');
    console.log('   2. Test authentication: node scripts/11-test-authentication.js');
    console.log('   3. Verify setup: node scripts/13-show-access-points.js');
    return true;
  } else {
    console.log('\n❌ Table creation incomplete!');
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check database permissions');
    console.log('   2. Verify Supabase is running properly');
    console.log('   3. Try running reset script: scripts/02-reset-and-seed.ps1');
    return false;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isQuickMode = args.includes('--quick') || args.includes('-q');

  try {
    if (isQuickMode) {
      await quickTableCheck();
    } else {
      await comprehensiveTableCreation();
    }
  } catch (error) {
    console.error('❌ Database table creation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { 
  testConnection, 
  createAllTables, 
  verifyTablesExist, 
  quickTableCheck, 
  comprehensiveTableCreation,
  CREATE_TABLES_SQL 
};
