const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugEmailDelivery() {
  console.log('🔍 COMPREHENSIVE EMAIL DELIVERY DEBUGGING\n');
  console.log('=' * 60);

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    console.error('❌ Missing Supabase configuration');
    return;
  }

  console.log('✅ Environment Configuration:');
  console.log(`   URL: ${url.substring(0, 30)}...`);
  console.log(`   Anon Key: ${anonKey.substring(0, 20)}...`);
  console.log(`   Service Key: ${serviceKey ? serviceKey.substring(0, 20) + '...' : 'Not provided'}\n`);

  const supabase = createClient(url, anonKey);
  const testEmail = 'baltzakis.themis@gmail.com';
  const testPassword = 'TH!123789th!'; // From auth-troubleshooting.js

  try {
    console.log('🧪 TEST 1: Current auth.resend() Method');
    console.log('-'.repeat(50));
    
    const startTime = Date.now();
    const { data: resendData, error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: testEmail,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });

    const responseTime = Date.now() - startTime;
    
    console.log(`⏱️  Response Time: ${responseTime}ms`);
    console.log(`📤 Request sent to: https://${url.split('//')[1]}/auth/v1/otp`);
    console.log(`📧 Target Email: ${testEmail}`);
    
    if (resendError) {
      console.log('❌ auth.resend() Failed:');
      console.log(`   Error: ${resendError.message}`);
      console.log(`   Status: ${resendError.status || 'unknown'}`);
      console.log(`   Full Error:`, resendError);
    } else {
      console.log('✅ auth.resend() Success:');
      console.log(`   Response:`, resendData);
    }

    console.log('\n🧪 TEST 2: signUp() Workaround Method');
    console.log('-'.repeat(50));

    const startTime2 = Date.now();
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });

    const responseTime2 = Date.now() - startTime2;
    
    console.log(`⏱️  Response Time: ${responseTime2}ms`);
    console.log(`📤 Request sent to: https://${url.split('//')[1]}/auth/v1/signup`);
    console.log(`📧 Target Email: ${testEmail}`);
    
    if (signupError) {
      console.log('❌ signUp() Result:');
      console.log(`   Error: ${signupError.message}`);
      console.log(`   Status: ${signupError.status || 'unknown'}`);
      
      // Analyze specific error types
      if (signupError.message.includes('already registered')) {
        console.log('💡 Analysis: User exists - this is expected');
        console.log('   ⚠️  Email may or may not be triggered (depends on Supabase config)');
      } else if (signupError.message.includes('invalid credentials')) {
        console.log('💡 Analysis: Wrong password provided');
        console.log('   🔑 Need to use the EXACT original signup password');
      }
    } else {
      console.log('✅ signUp() Success:');
      console.log(`   User ID: ${signupData.user?.id || 'N/A'}`);
      console.log(`   Email: ${signupData.user?.email || 'N/A'}`);
      console.log(`   Confirmed: ${signupData.user?.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`   Session: ${signupData.session ? 'Created' : 'None'}`);
    }

    console.log('\n🧪 TEST 3: Alternative Email Address Test');
    console.log('-'.repeat(50));

    const altEmail = 'baltzakis.themis+test@gmail.com';
    console.log(`📧 Testing with alias: ${altEmail}`);

    const { data: altData, error: altError } = await supabase.auth.signUp({
      email: altEmail,
      password: 'TestPassword123!',
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });

    if (altError) {
      console.log('❌ Alternative email test failed:', altError.message);
    } else {
      console.log('✅ Alternative email test succeeded');
      console.log('   💡 This means email delivery system is working');
      console.log('   🔍 Issue is specific to the original email/password combo');
    }

    console.log('\n📊 DEBUGGING RECOMMENDATIONS:');
    console.log('=' * 60);
    
    console.log('1️⃣  Check Supabase Dashboard → Auth → Logs');
    console.log('   Look for: email.confirmation.sent, user.signup events');
    console.log(`   Time range: ${new Date().toISOString()}`);
    
    console.log('\n2️⃣  Verify Email Settings');
    console.log('   Go to: Auth → Email Templates → SMTP Settings');
    console.log('   Check: Custom SMTP vs Default Supabase email');
    
    console.log('\n3️⃣  Check Email Folders');
    console.log('   📥 Inbox, 📁 Spam, 📁 Promotions, 📁 Updates');
    console.log('   🕐 Allow 5-10 minutes for delivery');
    
    console.log('\n4️⃣  Network Inspection');
    console.log('   Open browser dev tools → Network tab');
    console.log('   Look for POST requests to /auth/v1/otp or /auth/v1/signup');
    console.log('   Check response status and body');

    console.log('\n📋 NEXT ACTIONS:');
    if (resendError && signupError) {
      console.log('❌ Both methods failed - check Supabase configuration');
    } else if (!resendError && !signupError) {
      console.log('✅ Both methods succeeded - check email delivery/spam folders');
    } else {
      console.log('⚠️  Mixed results - use the working method in frontend');
    }

  } catch (err) {
    console.error('❌ Debugging script failed:', err.message);
    console.error('Full error:', err);
  }
}

debugEmailDelivery();
