#!/usr/bin/env node

/**
 * Test Email Confirmation Error
 * Test what happens when registration encounters email confirmation error
 */

import { createClient } from '@supabase/supabase-js';

// Local Supabase configuration
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testEmailError() {
  console.log('🧪 Testing registration that might trigger email error...');
  
  // Try a different email that might trigger email error
  const testEmail = 'newemail@example.com';
  const testPassword = 'password123';
  
  try {
    console.log(`📧 Attempting to register: ${testEmail}`);
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: 'New',
          last_name: 'User'
        }
      }
    });
    
    console.log('\n📊 Registration response:');
    console.log('Error:', error);
    console.log('Data:', JSON.stringify(data, null, 2));
    
    if (error) {
      console.log('\n❌ Error details:');
      console.log('Message:', error.message);
      console.log('Code:', error.status);
      
      if (error.message.includes('Error sending confirmation email')) {
        console.log('📧 Email confirmation error detected');
        console.log('User data present:', !!data?.user);
        console.log('User ID present:', !!data?.user?.id);
        
        if (data?.user?.id) {
          console.log('✅ User was created with ID:', data.user.id);
        } else {
          console.log('❌ No user was created');
        }
      }
    } else {
      console.log('✅ Registration successful without errors');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEmailError();
