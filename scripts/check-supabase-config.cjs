const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkSupabaseConfiguration() {
  console.log('🔧 SUPABASE CONFIGURATION CHECKER\n');
  console.log('=' .repeat(50));

  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('📋 ENVIRONMENT VARIABLES:');
  console.log('-'.repeat(30));
  console.log(`   SUPABASE_URL: ${url ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${anonKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${serviceKey ? '✅ Set' : '❌ Missing'}`);

  if (!url || !serviceKey) {
    console.error('\n❌ Missing required Supabase configuration');
    return;
  }

  // Extract project reference from URL
  const projectRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  console.log(`   Project Reference: ${projectRef || 'Unknown'}`);

  const supabase = createClient(url, serviceKey);

  try {
    console.log('\n🌐 TESTING CONNECTIVITY:');
    console.log('-'.repeat(30));
    
    // Test basic connectivity
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.log(`   ❌ Connection Error: ${error.message}`);
    } else {
      console.log('   ✅ Supabase connection successful');
    }

    console.log('\n🔐 AUTH CONFIGURATION CHECK:');
    console.log('-'.repeat(30));
    
    // Check if we can access auth admin
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });
    
    if (usersError) {
      console.log(`   ❌ Auth Admin Access: ${usersError.message}`);
    } else {
      console.log('   ✅ Auth admin access working');
      console.log(`   📊 Total users found: ${users?.users?.length || 0}`);
    }

    console.log('\n🔧 CONFIGURATION RECOMMENDATIONS:');
    console.log('-'.repeat(30));
    
    console.log('\n📍 IMPORTANT SUPABASE DASHBOARD SETTINGS TO CHECK:');
    console.log('\n1. 🌐 Site URL Configuration:');
    console.log('   Go to: Supabase Dashboard → Authentication → URL Configuration');
    console.log('   Site URL should be: http://localhost:3000 (for development)');
    console.log('   OR: https://your-domain.com (for production)');
    
    console.log('\n2. 🔗 Redirect URLs:');
    console.log('   Add these to "Redirect URLs" list:');
    console.log('   - http://localhost:3000/auth/callback');
    console.log('   - http://localhost:3000/**');
    console.log('   - https://your-domain.com/auth/callback (if using custom domain)');
    
    console.log('\n3. ⏰ Email Settings:');
    console.log('   Go to: Supabase Dashboard → Authentication → Email Templates');
    console.log('   Check "Confirm signup" template redirect URL:');
    console.log('   Should be: {{ .SiteURL }}/auth/callback');
    
    console.log('\n4. 🛡️ Rate Limiting:');
    console.log('   Go to: Supabase Dashboard → Authentication → Rate Limits');
    console.log('   Consider increasing OTP expiry if needed (default: 60 minutes)');

    console.log('\n🔍 PROJECT-SPECIFIC LINKS:');
    console.log('-'.repeat(30));
    if (projectRef) {
      console.log(`   🎯 Direct Dashboard: https://supabase.com/dashboard/project/${projectRef}`);
      console.log(`   🔐 Auth Settings: https://supabase.com/dashboard/project/${projectRef}/auth/users`);
      console.log(`   🌐 URL Config: https://supabase.com/dashboard/project/${projectRef}/auth/url-configuration`);
      console.log(`   📧 Email Templates: https://supabase.com/dashboard/project/${projectRef}/auth/templates`);
    }

    console.log('\n✅ NEXT STEPS:');
    console.log('-'.repeat(30));
    console.log('1. Visit the Supabase Dashboard links above');
    console.log('2. Verify Site URL is set correctly');
    console.log('3. Add proper redirect URLs');
    console.log('4. Test authentication again');
    console.log('5. If still failing, check browser console for detailed errors');

  } catch (err) {
    console.error('\n💥 Unexpected error:', err.message);
  }
}

// Run the configuration check
checkSupabaseConfiguration().catch(console.error);
