const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixSupabaseConfiguration() {
  console.log('🔧 SUPABASE CONFIGURATION FIX SCRIPT');
  console.log('=====================================\n');

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  // Check environment variables
  console.log('📋 Environment Check:');
  console.log(`   SUPABASE_URL: ${url ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${anonKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? '✅ Set' : '❌ Missing'}\n`);

  if (!url || !serviceKey) {
    console.error('❌ Missing required Supabase configuration');
    console.log('\n💡 Please check your .env file and ensure all Supabase variables are set correctly.');
    return;
  }

  // Test connection
  console.log('🔌 Testing Supabase Connection...');
  const supabase = createClient(url, serviceKey);

  try {
    // Test basic connectivity
    const { data, error } = await supabase.from('_test').select('*').limit(1);
    if (error && !error.message.includes('does not exist')) {
      console.log('❌ Connection failed:', error.message);
      return;
    }
    console.log('✅ Connection successful\n');

    // Check user status
    console.log('👤 User Status Check:');
    const testEmail = 'baltzakis.themis@gmail.com';
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error('❌ Error fetching users:', userError.message);
      return;
    }

    const user = users.find(u => u.email === testEmail);
    
    if (user) {
      console.log(`   Found user: ${user.email}`);
      console.log(`   Confirmed: ${user.email_confirmed_at ? '✅ YES' : '❌ NO'}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Last Sign In: ${user.last_sign_in_at || 'Never'}\n`);

      // Offer to confirm user if not confirmed
      if (!user.email_confirmed_at) {
        console.log('🛠️  User is not confirmed. Attempting to confirm...');
        
        const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email_confirm: true }
        );

        if (updateError) {
          console.error('❌ Failed to confirm user:', updateError.message);
        } else {
          console.log('✅ User has been manually confirmed!');
          console.log('   They should now be able to sign in directly.\n');
        }
      }
    } else {
      console.log(`   User ${testEmail} not found in database\n`);
    }

    // Configuration recommendations
    console.log('⚙️  Configuration Recommendations:');
    console.log('   1. Supabase Dashboard → Auth → URL Configuration:');
    console.log('      - Site URL: http://localhost:3000 (for dev) or your production domain');
    console.log('      - Redirect URLs: Add both localhost:3000/* and production domain/*');
    console.log('   2. Auth → Settings → Email Templates:');
    console.log('      - Ensure redirect URLs use {{ .RedirectTo }} or correct base URL');
    console.log('   3. Auth → Settings → Email:');
    console.log('      - Check SMTP configuration if using custom email provider\n');

    // Test auth flow
    console.log('🧪 Testing Auth Flow:');
    console.log('   You can now test the login flow:');
    console.log('   1. Visit http://localhost:3000/auth/login');
    console.log('   2. Try signing in with the confirmed user');
    console.log('   3. Check browser console for detailed logs\n');

  } catch (err) {
    console.error('💥 Unexpected error:', err.message);
    console.log('\n🔍 Debug Info:');
    console.log(`   Error type: ${err.name}`);
    console.log(`   Stack: ${err.stack?.split('\n')[0]}`);
  }
}

// Additional utility functions
async function createTestUser() {
  console.log('\n➕ Creating Test User...');
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey);

  const testEmail = 'test@cloudless.gr';
  const testPassword = 'TestPassword123!';

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true // Auto-confirm for testing
    });

    if (error) {
      console.error('❌ Failed to create test user:', error.message);
    } else {
      console.log('✅ Test user created successfully!');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
      console.log('   Status: Confirmed and ready to use\n');
    }
  } catch (err) {
    console.error('💥 Error creating test user:', err.message);
  }
}

// Main execution
async function main() {
  await fixSupabaseConfiguration();
  
  // Offer to create test user
  const args = process.argv.slice(2);
  if (args.includes('--create-test-user')) {
    await createTestUser();
  } else {
    console.log('💡 To create a test user, run: node scripts/supabase-fix.cjs --create-test-user');
  }
}

main().catch(console.error);
