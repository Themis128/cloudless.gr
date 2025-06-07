const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function monitorEmailDelivery() {
  console.log('📧 EMAIL DELIVERY MONITORING STARTED\n');
  console.log('=' .repeat(60));

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    console.error('❌ Missing Supabase configuration');
    return;
  }

  const supabase = createClient(url, anonKey);
  const adminSupabase = serviceKey ? createClient(url, serviceKey) : null;
  const testEmail = 'baltzakis.themis@gmail.com';

  console.log('✅ Configuration:');
  console.log(`   Email: ${testEmail}`);
  console.log(`   URL: ${url}`);
  console.log(`   Admin Access: ${adminSupabase ? 'Available' : 'Not available'}\n`);

  // Check current user status
  console.log('👤 CURRENT USER STATUS');
  console.log('-'.repeat(40));
  
  if (adminSupabase) {
    try {
      const { data: users, error: usersError } = await adminSupabase.auth.admin.listUsers();
      
      if (usersError) {
        console.log('❌ Failed to fetch users:', usersError.message);
      } else {
        const targetUser = users.users.find(u => u.email === testEmail);
        if (targetUser) {
          console.log(`✅ User found in database:`);
          console.log(`   ID: ${targetUser.id}`);
          console.log(`   Email: ${targetUser.email}`);
          console.log(`   Confirmed: ${targetUser.email_confirmed_at ? '✅ Yes' : '❌ No'}`);
          console.log(`   Confirmed At: ${targetUser.email_confirmed_at || 'Never'}`);
          console.log(`   Created: ${targetUser.created_at}`);
          console.log(`   Last Sign In: ${targetUser.last_sign_in_at || 'Never'}`);
          console.log(`   Phone: ${targetUser.phone || 'None'}`);
          console.log(`   Providers: ${targetUser.app_metadata?.providers?.join(', ') || 'email'}`);
        } else {
          console.log('❌ User not found in database');
        }
      }
    } catch (err) {
      console.log('❌ Error checking user status:', err.message);
    }
  } else {
    console.log('ℹ️  Admin access not available - using basic client');
  }

  // Test email delivery methods
  console.log('\n🧪 TESTING EMAIL DELIVERY METHODS');
  console.log('-'.repeat(40));

  // Method 1: Test auth.resend()
  console.log('\n1️⃣ Testing auth.resend() method:');
  try {
    const startTime = Date.now();
    const { data: resendData, error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: testEmail,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    });
    const responseTime = Date.now() - startTime;

    console.log(`   ⏱️  Response time: ${responseTime}ms`);
    if (resendError) {
      console.log(`   ❌ Failed: ${resendError.message}`);
    } else {
      console.log(`   ✅ Success: API call completed`);
      console.log(`   📊 Response data:`, resendData);
    }
  } catch (err) {
    console.log(`   💥 Exception: ${err.message}`);
  }

  // Method 2: Test signUp() fallback
  console.log('\n2️⃣ Testing signUp() fallback method:');
  try {
    const tempPassword = 'TempPass123!@#';
    const startTime = Date.now();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: tempPassword,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
        data: {
          test_attempt: true,
          timestamp: new Date().toISOString()
        }
      }
    });
    const responseTime = Date.now() - startTime;

    console.log(`   ⏱️  Response time: ${responseTime}ms`);
    if (signUpError) {
      console.log(`   ❌ Error: ${signUpError.message}`);
      if (signUpError.message.includes('User already registered')) {
        console.log(`   ✅ Expected error - should still trigger email`);
      }
    } else {
      console.log(`   ✅ Success: SignUp completed`);
      console.log(`   📊 Response data:`, signUpData);
    }
  } catch (err) {
    console.log(`   💥 Exception: ${err.message}`);
  }

  // Method 3: Test magic link
  console.log('\n3️⃣ Testing magic link method:');
  try {
    const startTime = Date.now();
    const { data: magicData, error: magicError } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
        shouldCreateUser: false,
        data: {
          test_magic_link: true
        }
      }
    });
    const responseTime = Date.now() - startTime;

    console.log(`   ⏱️  Response time: ${responseTime}ms`);
    if (magicError) {
      console.log(`   ❌ Failed: ${magicError.message}`);
    } else {
      console.log(`   ✅ Success: Magic link sent`);
      console.log(`   📊 Response data:`, magicData);
    }
  } catch (err) {
    console.log(`   💥 Exception: ${err.message}`);
  }

  // Email delivery verification tips
  console.log('\n📬 EMAIL DELIVERY VERIFICATION CHECKLIST');
  console.log('-'.repeat(40));
  console.log('1. ✅ Check your inbox for: baltzakis.themis@gmail.com');
  console.log('2. ✅ Check spam/junk folder');
  console.log('3. ✅ Check promotions tab (Gmail)');
  console.log('4. ✅ Look for emails from: noreply@mail.app.supabase.io');
  console.log('5. ✅ Subject should be: "Confirm your signup"');
  console.log('6. ✅ Check Supabase dashboard: Auth → Users → Email Templates');
  console.log('7. ✅ Check Supabase dashboard: Auth → Logs for delivery status');

  // Supabase configuration check
  console.log('\n⚙️  SUPABASE CONFIGURATION CHECK');
  console.log('-'.repeat(40));
  console.log('🔍 To verify email settings in Supabase Dashboard:');
  console.log(`   1. Go to: ${url.replace('supabase.co', 'supabase.com/dashboard/project')}`);
  console.log('   2. Navigate to: Authentication → Settings');
  console.log('   3. Check: "Enable email confirmations" is ON');
  console.log('   4. Check: "Secure email change" is configured');
  console.log('   5. Check: "Enable custom SMTP" (if using custom email)');
  console.log('   6. Check: Auth → Email Templates for custom templates');
  console.log('   7. Check: Auth → Logs for email delivery attempts');

  console.log('\n📊 NEXT STEPS FOR MANUAL TESTING:');
  console.log('-'.repeat(40));
  console.log('1. Go to: http://localhost:3000/auth/login');
  console.log('2. Enter email: baltzakis.themis@gmail.com');
  console.log('3. Click "Resend Confirmation Email" button');
  console.log('4. Watch browser console for detailed logs');
  console.log('5. Check email within 1-2 minutes');
  console.log('6. Report back with results!');

  console.log('\n🎯 SUCCESS INDICATORS:');
  console.log('✅ API calls return success (no error messages)');
  console.log('✅ Browser shows green success message');
  console.log('✅ Email arrives in inbox within 1-2 minutes');
  console.log('✅ Email contains valid confirmation link');
  console.log('✅ Clicking link successfully confirms account');
}

// Run the monitoring
monitorEmailDelivery().catch(console.error);
