#!/usr/bin/env node

/**
 * 11. Authentication Testing Script
 * Comprehensive authentication testing including user login, profile verification, and troubleshooting
 * Merged from: debug-user-login.js, verify-user-setup.js, user-troubleshooter.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ';

const supabase = createClient(supabaseUrl, supabaseKey);

// Test user credentials
const TEST_USER = {
  email: 'baltzakis.themis@gmail.com',
  password: 'TH!123789th!',
  name: 'Themistoklis Baltzakis'
};

async function testUserExists() {
  console.log('1️⃣ Checking if user exists in auth...');
  
  try {
    // Login to get user info
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: TEST_USER.email,
      password: TEST_USER.password,
    });

    if (loginError || !loginData.user) {
      console.log('❌ User not found or login failed:', loginError?.message);
      return null;
    }

    console.log('✅ User found in auth.users');
    console.log('   ID:', loginData.user.id);
    console.log('   Email confirmed:', loginData.user.email_confirmed_at ? 'Yes' : 'No');
    console.log('   Last sign in:', loginData.user.last_sign_in_at);

    // Sign out after verification
    await supabase.auth.signOut();
    
    return loginData.user;
  } catch (error) {
    console.log('❌ Error checking user:', error.message);
    return null;
  }
}

async function checkUserProfile(userId) {
  console.log('\n📋 Checking user profile...');
  
  try {
    // Check profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.log('❌ Profile not found:', profileError?.message);
      return { hasProfile: false, profile: null };
    }

    console.log('✅ Profile found, role:', profile.role);
    return { hasProfile: true, profile };
  } catch (error) {
    console.log('❌ Error checking profile:', error.message);
    return { hasProfile: false, profile: null };
  }
}

async function checkUserInfo(userId) {
  console.log('\n👤 Checking user info...');
  
  try {
    const { data: userInfo, error: userInfoError } = await supabase
      .from('user-info')
      .select('*')
      .eq('id', userId)
      .single();

    if (userInfoError || !userInfo) {
      console.log('❌ User info not found:', userInfoError?.message);
      return { hasUserInfo: false, userInfo: null };
    }

    console.log('✅ User info found:', userInfo.full_name);
    return { hasUserInfo: true, userInfo };
  } catch (error) {
    console.log('❌ Error checking user info:', error.message);
    return { hasUserInfo: false, userInfo: null };
  }
}

async function testLogin() {
  console.log('\n2️⃣ Testing login...');
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_USER.email,
      password: TEST_USER.password,
    });

    if (error) {
      console.log('❌ Login failed:', error.message);
      return false;
    }

    console.log('✅ Login successful!');
    console.log('   User ID:', data.user.id);
    console.log('   Email:', data.user.email);

    // Test sign out
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      console.log('⚠️  Sign out failed:', signOutError.message);
    } else {
      console.log('✅ Signed out successfully');
    }

    return true;
  } catch (error) {
    console.log('❌ Login error:', error.message);
    return false;
  }
}

async function comprehensiveAuthTest() {
  console.log('🔐 COMPREHENSIVE AUTHENTICATION TEST');
  console.log('=====================================');
  console.log(`Testing user: ${TEST_USER.email}\n`);

  // Test 1: Check if user exists
  const user = await testUserExists();
  if (!user) {
    console.log('\n❌ Authentication test failed: User not found');
    console.log('\n💡 Troubleshooting steps:');
    console.log('   1. Run setup script: node scripts/04-setup-user-accounts.js');
    console.log('   2. Check if Supabase is running: docker-compose ps');
    console.log('   3. Verify database tables exist: node scripts/06-check-database.js');
    return false;
  }

  // Test 2: Check profile
  const { hasProfile, profile } = await checkUserProfile(user.id);
  
  // Test 3: Check user info
  const { hasUserInfo, userInfo } = await checkUserInfo(user.id);

  // Test 4: Test login/logout
  const loginSuccess = await testLogin();

  // Summary
  console.log('\n🎯 Authentication Test Summary');
  console.log('==============================');
  console.log(`✅ User exists: ${user ? 'Yes' : 'No'}`);
  console.log(`${hasProfile ? '✅' : '❌'} Profile exists: ${hasProfile ? 'Yes' : 'No'}`);
  console.log(`${hasUserInfo ? '✅' : '❌'} User info exists: ${hasUserInfo ? 'Yes' : 'No'}`);
  console.log(`${loginSuccess ? '✅' : '❌'} Login/logout works: ${loginSuccess ? 'Yes' : 'No'}`);

  if (hasProfile && profile) {
    console.log(`   Role: ${profile.role}`);
  }
  if (hasUserInfo && userInfo) {
    console.log(`   Full name: ${userInfo.full_name}`);
  }

  const allTestsPassed = user && hasProfile && hasUserInfo && loginSuccess;
  
  if (allTestsPassed) {
    console.log('\n🎉 All authentication tests passed!');
    console.log('\n🚀 User account is ready:');
    console.log(`   Email: ${TEST_USER.email}`);
    console.log(`   Password: ${TEST_USER.password}`);
    console.log(`   Role: ${profile?.role || 'unknown'}`);
    console.log('\n🌐 Try logging in at your app\'s /auth page!');
  } else {
    console.log('\n❌ Some authentication tests failed!');
    console.log('\n🔧 Recommended fixes:');
    
    if (!hasProfile) {
      console.log('   • Run: node scripts/03-create-database-tables.js');
    }
    if (!hasUserInfo) {
      console.log('   • Run: node scripts/04-setup-user-accounts.js');
    }
    if (!loginSuccess) {
      console.log('   • Check Supabase configuration and restart services');
    }
  }

  return allTestsPassed;
}

// Quick verification mode
async function quickVerification() {
  console.log('🔍 Quick Authentication Verification');
  console.log('====================================');
  console.log(`Verifying user: ${TEST_USER.email}\n`);

  try {
    // Quick login test
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_USER.email,
      password: TEST_USER.password,
    });

    if (error || !data.user) {
      console.log('❌ Quick verification failed:', error?.message);
      return false;
    }

    const userId = data.user.id;
    console.log('✅ User found:', userId);

    // Quick profile check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile) {
      console.log('✅ Profile found, role:', profile.role);
    } else {
      console.log('❌ Profile not found');
    }

    // Quick user info check
    const { data: userInfo } = await supabase
      .from('user-info')
      .select('full_name')
      .eq('id', userId)
      .single();

    if (userInfo) {
      console.log('✅ User info found:', userInfo.full_name);
    } else {
      console.log('❌ User info not found');
    }

    await supabase.auth.signOut();

    console.log('\n✅ Quick verification completed!');
    return true;
  } catch (error) {
    console.log('❌ Quick verification error:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const isQuickMode = args.includes('--quick') || args.includes('-q');

  try {
    if (isQuickMode) {
      await quickVerification();
    } else {
      await comprehensiveAuthTest();
    }
  } catch (error) {
    console.error('❌ Authentication test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { comprehensiveAuthTest, quickVerification, testUserExists, checkUserProfile, checkUserInfo, testLogin };
