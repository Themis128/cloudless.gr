#!/usr/bin/env node

/**
 * Direct PostgreSQL Table Creation Script
 * Creates the required tables using direct PostgreSQL connection
 */

import pkg from 'pg';
const { Client } = pkg;

// Database connection configuration
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'postgres',
};

const USER_ID = '750226cb-5f6c-4341-a32f-624dfa1408bf';

async function createTables() {
  console.log('🚀 Creating Database Tables Directly');
  console.log('==================================\n');

  const client = new Client(dbConfig);

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Create profiles table
    console.log('📋 Creating profiles table...');
    const createProfilesTable = `
      CREATE TABLE IF NOT EXISTS public.profiles (
          id UUID REFERENCES auth.users(id) PRIMARY KEY,
          role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
    await client.query(createProfilesTable);
    console.log('✅ Profiles table created');

    // Create user-info table
    console.log('📋 Creating user-info table...');
    const createUserInfoTable = `
      CREATE TABLE IF NOT EXISTS public."user-info" (
          id UUID REFERENCES auth.users(id) PRIMARY KEY,
          full_name TEXT,
          avatar_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    
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

    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n🚀 Your user account is ready:');
    console.log('   Email: baltzakis.themis@gmail.com');
    console.log('   Password: TH!123789th!');
    console.log('   Role: user');
    console.log('\n🌐 Try logging in at your app\'s /auth page!');

  } catch (error) {
    console.error('❌ Database setup error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 PostgreSQL connection failed. Please check:');
      console.log('   - Is PostgreSQL running on localhost:5432?');
      console.log('   - Are the credentials correct?');
      console.log('   - Try: docker-compose up -d postgres');
    }
    
    if (error.code === '42P01') {
      console.log('\n💡 Table reference error. The auth.users table might not exist.');
      console.log('   This is expected if Supabase auth schema isn\'t fully set up.');
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the script
createTables().catch(console.error);

export { createTables };
