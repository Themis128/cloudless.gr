const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function testResendEmail() {
  console.log('🔍 Testing Resend Email Function...\n');

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
    
    console.log(`🧪 Testing resend confirmation for: ${testEmail}`);
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: testEmail,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });

    if (error) {
      console.error('❌ Resend failed:', error.message);
      console.error('Error code:', error.status || 'unknown');
      console.error('Error details:', error);
      
      // Check common issues
      if (error.message.includes('rate limit')) {
        console.log('\n💡 This is a rate limiting issue. Wait a few minutes and try again.');
      } else if (error.message.includes('User not found')) {
        console.log('\n💡 User might not exist or email might be already confirmed.');
      } else if (error.message.includes('already confirmed')) {
        console.log('\n💡 Email is already confirmed - user can sign in normally.');
      }
    } else {
      console.log('✅ Resend email request successful!');
      console.log('📧 Confirmation email should be sent shortly.');
    }

  } catch (err) {
    console.error('❌ Test failed:', err.message);
    console.error('Full error:', err);
  }
}

testResendEmail();
