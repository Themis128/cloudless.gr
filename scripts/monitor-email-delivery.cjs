const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function monitorEmailDelivery() {
  console.log('📧 EMAIL DELIVERY MONITORING SCRIPT\n');
  console.log('=' .repeat(60));

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('❌ Missing Supabase service key for monitoring');
    console.log('ℹ️  This script requires SUPABASE_SERVICE_ROLE_KEY to access auth logs');
    return;
  }

  const supabase = createClient(url, serviceKey);
  const testEmail = 'baltzakis.themis@gmail.com';

  console.log('✅ Configuration:');
  console.log(`   Email to monitor: ${testEmail}`);
  console.log(`   Supabase URL: ${url}`);
  console.log(`   Using service role key: ${serviceKey.substring(0, 20)}...\n`);

  try {
    // Check current user status
    console.log('👤 USER STATUS');
    console.log('-'.repeat(40));
    
    const { data: users, error: usersError } = await supabase
      .from('auth.users')
      .select('*')
      .eq('email', testEmail);

    if (usersError) {
      console.log('❌ Error querying users:', usersError.message);
    } else if (users && users.length > 0) {
      const user = users[0];
      console.log(`✅ User found: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Email confirmed: ${user.email_confirmed_at ? '✅ Yes' : '❌ No'}`);
      console.log(`   Last sign in: ${user.last_sign_in_at || 'Never'}`);
    } else {
      console.log('❌ User not found in database');
    }

    // Check recent auth events
    console.log('\n📊 RECENT AUTH EVENTS');
    console.log('-'.repeat(40));
    
    // Note: This query might not work without proper RLS setup
    const { data: authLogs, error: logsError } = await supabase
      .from('auth.audit_log_entries')
      .select('*')
      .eq('payload->>email', testEmail)
      .order('created_at', { ascending: false })
      .limit(10);

    if (logsError) {
      console.log('ℹ️  Cannot access auth logs (requires special setup):', logsError.message);
    } else if (authLogs && authLogs.length > 0) {
      console.log(`✅ Found ${authLogs.length} recent auth events:`);
      authLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.event_type} - ${log.created_at}`);
        if (log.payload && log.payload.error) {
          console.log(`      Error: ${log.payload.error}`);
        }
      });
    } else {
      console.log('ℹ️  No recent auth events found');
    }

    // Attempt to trigger confirmation email using service key
    console.log('\n🔄 TESTING EMAIL DELIVERY WITH SERVICE KEY');
    console.log('-'.repeat(40));
    
    const { data: adminResend, error: adminError } = await supabase.auth.admin.generateLink({
      type: 'signup',
      email: testEmail,
      options: {
        redirectTo: 'http://localhost:3000/auth/callback'
      }
    });

    if (adminError) {
      console.log('❌ Admin email generation failed:', adminError.message);
    } else {
      console.log('✅ Admin email link generated successfully:');
      console.log(`   Action link: ${adminResend.properties?.action_link || 'N/A'}`);
      console.log(`   Email OTP: ${adminResend.properties?.email_otp || 'N/A'}`);
      console.log(`   Redirect URL: ${adminResend.properties?.redirect_to || 'N/A'}`);
    }

    // Provide monitoring instructions
    console.log('\n📋 MONITORING INSTRUCTIONS');
    console.log('-'.repeat(40));
    console.log('1. Check the user\'s email inbox (including spam folder)');
    console.log('2. Look for emails from your Supabase project');
    console.log('3. Verify the confirmation link works');
    console.log('4. Monitor Supabase Dashboard > Auth > Logs for delivery status');
    console.log('5. Check your email provider\'s delivery logs if available');

    console.log('\n🎯 NEXT STEPS');
    console.log('-'.repeat(40));
    console.log('1. Go to http://localhost:3000/auth/login');
    console.log('2. Enter the email: baltzakis.themis@gmail.com');
    console.log('3. Click "Resend Confirmation Email"');
    console.log('4. Check email delivery');
    console.log('5. If no email arrives, check Supabase Auth settings');

  } catch (err) {
    console.error('💥 Monitoring error:', err);
  }
}

// Run the monitoring
monitorEmailDelivery().catch(console.error);
