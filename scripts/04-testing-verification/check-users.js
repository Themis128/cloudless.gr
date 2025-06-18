#!/usr/bin/env node

/**
 * Check Users Script
 * Check if users exist in the database and their status
 */

import { createClient } from '@supabase/supabase-js';

// Local Supabase configuration
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkUsers() {
  console.log('🔍 Checking users in auth.users table...');
  
  try {    // Check if we can connect to Supabase
    console.log('🔗 Testing connection...');
    const { error: connectionError } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true });
    
    if (connectionError) {
      console.error('❌ Connection error:', connectionError);
      return;
    } else {
      console.log('✅ Connection successful');
    }

    // Check user_profiles table
    console.log('\n🔍 Checking user_profiles table...');
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (profileError) {
      console.error('❌ Error checking user_profiles:', profileError);
    } else {
      console.log('📊 User Profiles:', profiles || 'No profiles found');
      console.log('📊 Profile count:', profiles?.length || 0);
    }

    // Try to get auth user info via RPC if available
    console.log('\n🔍 Attempting to check auth users...');
    try {
      // This might not work without custom functions, but let's try
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        console.error('❌ Auth users check failed:', authError);
      } else {
        console.log('📊 Auth Users:', authUsers.users || 'No auth users found');
        console.log('📊 Auth user count:', authUsers.users?.length || 0);
        
        // Show unconfirmed users
        const unconfirmed = authUsers.users?.filter(user => !user.email_confirmed_at);
        console.log('📊 Unconfirmed users:', unconfirmed?.length || 0);
        if (unconfirmed && unconfirmed.length > 0) {
          unconfirmed.forEach(user => {
            console.log(`  - ${user.email} (created: ${user.created_at})`);
          });
        }
      }
    } catch (authErr) {
      console.error('❌ Auth API error:', authErr.message);
    }

  } catch (error) {
    console.error('❌ General error:', error);
  }
}

checkUsers();
