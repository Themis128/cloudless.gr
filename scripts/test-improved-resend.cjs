const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testImprovedResendLogic() {
  console.log('🧪 TESTING IMPROVED RESEND CONFIRMATION LOGIC\n');
  console.log('=' .repeat(60));

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error('❌ Missing Supabase configuration');
    return;
  }

  const supabase = createClient(url, anonKey);
  const testEmail = 'baltzakis.themis@gmail.com';
  const redirectUrl = 'http://localhost:3000/auth/callback';

  console.log('✅ Configuration:');
  console.log(`   Email: ${testEmail}`);
  console.log(`   Redirect: ${redirectUrl}`);
  console.log(`   URL: ${url}\n`);

  // Helper function to generate a temporary strong password
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  try {
    // Method 1: Test auth.resend()
    console.log('🔄 METHOD 1: Testing auth.resend()');
    console.log('-'.repeat(40));
    
    const startTime1 = Date.now();
    const { data: resendData, error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: testEmail,
      options: {
        emailRedirectTo: redirectUrl
      }
    });

    const responseTime1 = Date.now() - startTime1;
    console.log(`⏱️  Response Time: ${responseTime1}ms`);
    
    if (resendError) {
      console.log('❌ auth.resend() Failed:');
      console.log(`   Error: ${resendError.message}`);
      console.log(`   Status: ${resendError.status || 'unknown'}`);
      
      // Method 2: Test signUp() fallback
      console.log('\n🔄 METHOD 2: Testing signUp() fallback');
      console.log('-'.repeat(40));
      
      const tempPassword = generateTempPassword();
      console.log(`🔑 Generated temp password: ${tempPassword.substring(0, 8)}...`);
      
      const startTime2 = Date.now();
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: testEmail,
        password: tempPassword,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            resend_attempt: true,
            timestamp: new Date().toISOString()
          }
        }
      });

      const responseTime2 = Date.now() - startTime2;
      console.log(`⏱️  Response Time: ${responseTime2}ms`);
      
      if (signUpError) {
        console.log('❌ signUp() Response:');
        console.log(`   Error: ${signUpError.message}`);
        console.log(`   Status: ${signUpError.status || 'unknown'}`);
        
        if (signUpError.message.includes('User already registered')) {
          console.log('✅ Expected "User already registered" - This should trigger confirmation email');
        }
        
        // Method 3: Test magic link fallback
        console.log('\n🔄 METHOD 3: Testing magic link fallback');
        console.log('-'.repeat(40));
        
        const startTime3 = Date.now();
        const { data: magicData, error: magicError } = await supabase.auth.signInWithOtp({
          email: testEmail,
          options: {
            emailRedirectTo: redirectUrl,
            shouldCreateUser: false,
            data: {
              resend_attempt: true,
              method: 'magic_link_fallback'
            }
          }
        });

        const responseTime3 = Date.now() - startTime3;
        console.log(`⏱️  Response Time: ${responseTime3}ms`);
        
        if (magicError) {
          console.log('❌ Magic Link Failed:');
          console.log(`   Error: ${magicError.message}`);
          console.log(`   Status: ${magicError.status || 'unknown'}`);
        } else {
          console.log('✅ Magic Link Success:');
          console.log(`   Data:`, magicData);
        }
        
      } else {
        console.log('✅ signUp() Success:');
        console.log(`   User ID: ${signUpData.user?.id || 'N/A'}`);
        console.log(`   Confirmation Sent: ${signUpData.user?.email_confirmed_at ? 'Already confirmed' : 'Pending'}`);
      }
      
    } else {
      console.log('✅ auth.resend() Success:');
      console.log(`   Data:`, resendData);
    }

    // Summary
    console.log('\n📊 SUMMARY');
    console.log('=' .repeat(60));
    console.log('Methods tested:');
    console.log(`1. auth.resend(): ${resendError ? '❌ Failed' : '✅ Success'}`);
    if (resendError) {
      console.log(`2. signUp() fallback: ${typeof signUpError !== 'undefined' ? (signUpError ? '❌ Failed' : '✅ Success') : '⏭️ Skipped'}`);
      console.log(`3. Magic link fallback: ${typeof magicError !== 'undefined' ? (magicError ? '❌ Failed' : '✅ Success') : '⏭️ Skipped'}`);
    }

    console.log('\n🎯 RECOMMENDATIONS:');
    if (!resendError) {
      console.log('✅ Primary auth.resend() method is working - use this');
    } else {
      console.log('❌ Primary auth.resend() method failed');
      if (typeof signUpError !== 'undefined' && signUpError?.message.includes('User already registered')) {
        console.log('✅ signUp() fallback should work for triggering confirmation emails');
      }
      if (typeof magicError !== 'undefined' && !magicError) {
        console.log('✅ Magic link fallback is working as final option');
      }
    }

    // Check user status
    console.log('\n👤 USER STATUS CHECK');
    console.log('-'.repeat(40));
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.log('ℹ️  No active session (expected for testing)');
    } else {
      console.log(`✅ Current user: ${user?.email || 'None'}`);
    }

  } catch (err) {
    console.error('💥 Unexpected error during testing:', err);
  }
}

// Run the test
testImprovedResendLogic().catch(console.error);
