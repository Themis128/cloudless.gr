const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testUserEmailFlow() {
  console.log('🧪 Testing User Email Confirmation Flow...\n');

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('❌ Missing Supabase configuration');
    return;
  }

  console.log('✅ Supabase configuration found');
  console.log(`URL: ${url.substring(0, 30)}...`);
  console.log(`Key: ${anonKey.substring(0, 20)}...\n`);

  try {
    const supabase = createClient(url, anonKey);
    
    // Test email from the screenshot
    const testEmail = 'baltzakis.themis@gmail.com';
    
    console.log(`🎯 Testing complete flow for: ${testEmail}\n`);
    
    // 1. Test if user can sign in (should fail if not confirmed)
    console.log('1️⃣ Testing sign-in with existing credentials...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: 'TH!123789th!' // Using the password from auth-troubleshooting.js
    });

    if (signInError) {
      console.log('❌ Sign-in failed:', signInError.message);
      
      if (signInError.message.includes('Invalid login credentials')) {
        console.log('💡 This suggests the email is not confirmed yet.');
      } else if (signInError.message.includes('confirm')) {
        console.log('💡 Email confirmation is definitely needed.');
      }
    } else {
      console.log('✅ Sign-in successful! User is already confirmed.');
      console.log('   User ID:', signInData.user?.id);
      console.log('   Email confirmed:', signInData.user?.email_confirmed_at ? 'Yes' : 'No');
    }

    console.log('\n2️⃣ Testing resend confirmation email...');
    
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: testEmail,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });

    if (resendError) {
      console.log('❌ Resend failed:', resendError.message);
      
      // Analyze the error
      if (resendError.message.includes('already confirmed')) {
        console.log('💡 The email is already confirmed! User should be able to sign in.');
        console.log('🔧 Try signing in with the correct password.');
      } else if (resendError.message.includes('rate limit')) {
        console.log('💡 Rate limited. Wait a few minutes and try again.');
      } else if (resendError.message.includes('User not found')) {
        console.log('💡 User does not exist. They may need to sign up first.');
      } else {
        console.log('❓ Unexpected error. Check Supabase dashboard for more details.');
      }
    } else {
      console.log('✅ Resend email request successful!');
      console.log('📧 New confirmation email should be sent shortly.');
      console.log('🔗 Check email inbox and spam folder.');
    }

    console.log('\n3️⃣ Next steps for the user:');
    console.log('   1. Check email for new confirmation link');
    console.log('   2. Click the confirmation link');
    console.log('   3. Try signing in again');
    console.log('   4. If still issues, check Supabase dashboard → Authentication → Users');

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error('Full error:', err);
  }
}

testUserEmailFlow();
