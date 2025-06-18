#!/usr/bin/env node

/**
 * Test Registration Script
 * Test the registration process programmatically
 */

import { createClient } from '@supabase/supabase-js';

// Local Supabase configuration
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testRegistration() {
  console.log('🧪 Testing registration process...');
  
  const testEmail = 'test@example.com';
  const testPassword = 'testpassword123';
  const firstName = 'Test';
  const lastName = 'User';
  
  try {
    console.log(`📧 Attempting to register: ${testEmail}`);
    
    // Attempt registration
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName
        }
      }
    });
    
    console.log('\n📊 Registration response:');
    console.log('Data:', data);
    console.log('Error:', error);
    
    if (error) {
      console.log('\n❌ Registration failed with error:', error.message);
      
      if (error.message.includes('Error sending confirmation email')) {
        console.log('📧 Email confirmation error detected - this is expected in local dev');
        
        if (data?.user?.id) {
          console.log('✅ User was created despite email error');
          console.log('User ID:', data.user.id);
          console.log('Email confirmed:', !!data.user.email_confirmed_at);
          
          // Try to create user profile
          console.log('\n🔧 Attempting to create user profile...');
          const { error: profileError } = await supabase
            .from('user_profiles')
            .insert([{
              id: data.user.id,
              full_name: `${firstName} ${lastName}`,
              role: 'user'
            }]);
          
          if (profileError) {
            console.log('❌ Profile creation failed:', profileError);
          } else {
            console.log('✅ Profile created successfully');
          }
        }
      }
    } else {
      console.log('✅ Registration successful!');
      if (data.user) {
        console.log('User ID:', data.user.id);
        console.log('Email confirmed:', !!data.user.email_confirmed_at);
      }
    }
    
    // Now test login
    console.log('\n🔐 Testing login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });
    
    console.log('Login Data:', loginData);
    console.log('Login Error:', loginError);
    
    if (loginError) {
      console.log('❌ Login failed:', loginError.message);
    } else {
      console.log('✅ Login successful!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRegistration();
