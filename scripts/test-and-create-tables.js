#!/usr/bin/env node

/**
 * Database Connection Tester and Table Creator
 * Tests various database configurations and creates tables
 */

import pkg from 'pg';
const { Client } = pkg;

const USER_ID = '750226cb-5f6c-4341-a32f-624dfa1408bf';

// Different database configurations to try
const dbConfigs = [
  {
    name: 'Main Database',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'postgres',
    }
  },
  {
    name: 'Supabase Admin',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'supabase_admin',
      password: 'postgres',
    }
  },
  {
    name: 'Authentication Admin',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'postgres',
      user: 'supabase_auth_admin',
      password: 'postgres',
    }
  }
];

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

async function createTablesWithClient(client) {
  try {
    // Check if auth schema exists
    console.log('🔍 Checking database schema...');
    const schemaCheck = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name IN ('auth', 'public')
      ORDER BY schema_name;
    `);
    
    console.log('📋 Available schemas:', schemaCheck.rows.map(r => r.schema_name));

    // Check if auth.users table exists
    const authUsersCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'auth' 
        AND table_name = 'users'
      );
    `);
    
    console.log('👥 Auth users table exists:', authUsersCheck.rows[0].exists);

    // Create profiles table (without foreign key if auth.users doesn't exist)
    console.log('📋 Creating profiles table...');
    let createProfilesTable;
    
    if (authUsersCheck.rows[0].exists) {
      createProfilesTable = `
        CREATE TABLE IF NOT EXISTS public.profiles (
            id UUID REFERENCES auth.users(id) PRIMARY KEY,
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
    } else {
      createProfilesTable = `
        CREATE TABLE IF NOT EXISTS public.profiles (
            id UUID PRIMARY KEY,
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
    }
    
    await client.query(createProfilesTable);
    console.log('✅ Profiles table created');

    // Create user-info table
    console.log('📋 Creating user-info table...');
    let createUserInfoTable;
    
    if (authUsersCheck.rows[0].exists) {
      createUserInfoTable = `
        CREATE TABLE IF NOT EXISTS public."user-info" (
            id UUID REFERENCES auth.users(id) PRIMARY KEY,
            full_name TEXT,
            avatar_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
    } else {
      createUserInfoTable = `
        CREATE TABLE IF NOT EXISTS public."user-info" (
            id UUID PRIMARY KEY,
            full_name TEXT,
            avatar_url TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
    }
    
    await client.query(createUserInfoTable);
    console.log('✅ User-info table created');

    // Insert user profile data
    console.log('👤 Creating user profile...');
    const insertProfile = `
      INSERT INTO public.profiles (id, role) 
      VALUES ($1, 'user')
      ON CONFLICT (id) DO UPDATE SET
        role = EXCLUDED.role,
        updated_at = NOW();
    `;
    
    await client.query(insertProfile, [USER_ID]);
    console.log('✅ User profile created');

    // Insert user info data
    console.log('📝 Creating user info...');
    const insertUserInfo = `
      INSERT INTO public."user-info" (id, full_name) 
      VALUES ($1, 'Themistoklis Baltzakis')
      ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        updated_at = NOW();
    `;
    
    await client.query(insertUserInfo, [USER_ID]);
    console.log('✅ User info created');

    // Verify tables exist
    console.log('\n🔍 Verifying table creation...');
    
    const checkTables = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('profiles', 'user-info')
      ORDER BY table_name;
    `;
    
    const tablesResult = await client.query(checkTables);
    console.log('📋 Created tables:', tablesResult.rows.map(r => r.table_name));

    // Check user data
    const checkProfile = `
      SELECT p.id, p.role, ui.full_name
      FROM public.profiles p
      LEFT JOIN public."user-info" ui ON p.id = ui.id
      WHERE p.id = $1;
    `;
    
    const profileResult = await client.query(checkProfile, [USER_ID]);
    
    if (profileResult.rows.length > 0) {
      console.log('\n✅ User profile verified:');
      console.log('   ID:', profileResult.rows[0].id);
      console.log('   Role:', profileResult.rows[0].role);
      console.log('   Name:', profileResult.rows[0].full_name);
    }

    return true;
  } catch (error) {
    console.error('❌ Table creation error:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Database Connection Tester & Table Creator');
  console.log('===============================================\n');

  let successfulClient = null;
  
  // Try each database configuration
  for (const { name, config } of dbConfigs) {
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
    console.log('\n💡 Please check:');
    console.log('   - Is the database running? (docker-compose up -d db)');
    console.log('   - Are the credentials correct in .env file?');
    console.log('   - Is the database accessible on localhost:5432?');
    return;
  }

  // Create tables with the successful connection
  console.log('🔧 Creating database tables...');
  const success = await createTablesWithClient(successfulClient);
  
  if (success) {
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n🚀 Your user account is ready:');
    console.log('   Email: baltzakis.themis@gmail.com');
    console.log('   Password: TH!123789th!');
    console.log('   Role: user');
    console.log('\n🌐 Try logging in at your app\'s /auth page!');
  }

  await successfulClient.end();
  console.log('\n🔌 Database connection closed');
}

// Run the script
main().catch(console.error);

export { main };
