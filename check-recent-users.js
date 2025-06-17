#!/usr/bin/env node

/**
 * Check Recent Users Script
 * Check for the most recent users in the database
 */

import { createClient } from '@supabase/supabase-js';

// Local Supabase configuration
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkRecentUsers() {
  console.log('🔍 Checking for recent auth users...');
  
  try {
    // Get all auth users with more details
    const { data: authResponse, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Auth users check failed:', authError);
      return;
    }
    
    const users = authResponse.users || [];
    console.log(`📊 Total auth users found: ${users.length}`);
    
    if (users.length > 0) {
      console.log('\n📋 All users:');
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. User ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
        console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`);
        console.log(`   Metadata:`, JSON.stringify(user.user_metadata, null, 2));
      });
      
      // Show unconfirmed users
      const unconfirmed = users.filter(user => !user.email_confirmed_at);
      console.log(`\n🔓 Unconfirmed users: ${unconfirmed.length}`);
      if (unconfirmed.length > 0) {
        unconfirmed.forEach(user => {
          console.log(`   - ${user.email} (created: ${user.created_at})`);
        });
      }
    } else {
      console.log('❌ No users found');
    }

  } catch (error) {
    console.error('❌ General error:', error);
  }
}

checkRecentUsers();
