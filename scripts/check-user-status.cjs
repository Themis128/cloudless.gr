const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkUserConfirmationStatus() {
  console.log('🔍 CHECKING USER CONFIRMATION STATUS\n');
  console.log('=' .repeat(50));

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('❌ Missing Supabase configuration');
    return;
  }

  // Use service role key to access user data
  const supabase = createClient(url, serviceKey);
  const testEmail = 'baltzakis.themis@gmail.com';

  try {
    console.log(`📧 Checking status for: ${testEmail}`);
    
    // Get user data from auth.users table
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('❌ Error fetching users:', error.message);
      return;
    }

    const user = users.find(u => u.email === testEmail);
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('\n👤 USER STATUS:');
    console.log('-'.repeat(30));
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Created: ${user.created_at}`);
    console.log(`   Updated: ${user.updated_at}`);
    console.log(`   Confirmed: ${user.email_confirmed_at ? '✅ YES' : '❌ NO'}`);
    
    if (user.email_confirmed_at) {
      console.log(`   Confirmed At: ${user.email_confirmed_at}`);
    } else {
      console.log('   Confirmation Sent: ${user.confirmation_sent_at || 'Unknown'}');
    }
    
    console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}`);
    console.log(`   Role: ${user.role || 'authenticated'}`);

    // Check identity providers
    if (user.identities && user.identities.length > 0) {
      console.log('\n🔗 IDENTITY PROVIDERS:');
      user.identities.forEach(identity => {
        console.log(`   Provider: ${identity.provider}`);
        console.log(`   Created: ${identity.created_at}`);
        console.log(`   Updated: ${identity.updated_at}`);
      });
    }

    // Recommendation
    console.log('\n🎯 RECOMMENDATION:');
    console.log('-'.repeat(30));
    if (user.email_confirmed_at) {
      console.log('✅ User is confirmed - they should be able to sign in normally');
      console.log('   If login fails, check password or try password reset');
    } else {
      console.log('❌ User is NOT confirmed - they need to click confirmation email');
      console.log('   Resend confirmation email functionality should work');
    }

  } catch (err) {
    console.error('💥 Unexpected error:', err.message);
  }
}

// Run the check
checkUserConfirmationStatus().catch(console.error);
