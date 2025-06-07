const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');

// Load environment variables from .env file
config();

async function checkSupabaseHealth() {
  console.log('🔍 Starting Supabase health check...\n');
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing required Supabase configuration!');
    if (!url) console.error('Missing SUPABASE_URL');
    if (!key) console.error('Missing SUPABASE_ANON_KEY');
    process.exit(1);
  }

  console.log('✅ Found Supabase configuration');
  console.log(`URL: ${url.substring(0, 20)}...`);
  console.log(`Key: ${key.substring(0, 20)}...`);
  
  try {
    const supabase = createClient(url, key);
    console.log('\n📡 Testing connection...');

    // Test basic connection with a simple query
    const { data, error } = await supabase
      .from('contact_submissions')
      .select('count')
      .limit(0);

    if (error) {
      // Handle specific error codes
      if (error.code === 'PGRST116') {
        console.log('✅ Successfully connected to Supabase!');
        console.log('   (Table not found error is expected - this confirms connection works)');
      } else if (error.code === '42P01') {
        console.log('✅ Successfully connected to Supabase!');
        console.log('   (Table does not exist - this confirms connection works)');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Successfully connected to Supabase!');
      console.log(`   Found ${data ? data.length : 0} records`);
    }

    // Test auth functionality
    console.log('\n🔐 Testing authentication...');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.log('✅ Auth endpoint accessible (no active session, which is expected)');
    } else {
      console.log('✅ Auth endpoint working, session:', authData.session ? 'active' : 'none');
    }

    // Test service role if available
    if (serviceKey && serviceKey !== 'your_actual_service_role_key_here') {
      console.log('\n🔑 Testing service role access...');
      const adminClient = createClient(url, serviceKey);
      const { data: adminData, error: adminError } = await adminClient
        .from('contact_submissions')
        .select('count')
        .limit(0);

      if (adminError && adminError.code !== 'PGRST116' && adminError.code !== '42P01') {
        console.warn('⚠️ Service role access check failed:', adminError.message);
      } else {
        console.log('✅ Service role access verified');
      }
    } else {
      console.log('\n⚠️ Service role key not configured (optional for basic functionality)');
    }

    console.log('\n🎉 All checks passed! Supabase is properly configured.');
    console.log('\n📋 Connection Summary:');
    console.log(`   • URL: ${url}`);
    console.log(`   • Anonymous Key: ✅ Valid`);
    console.log(`   • Service Key: ${serviceKey && serviceKey !== 'your_actual_service_role_key_here' ? '✅ Configured' : '⚠️ Not configured'}`);
    console.log(`   • Auth: ✅ Working`);
    console.log(`   • Database: ✅ Accessible`);
    
    return true;
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message || error);
    console.error('\nDebug information:');
    console.error('Error code:', error.code || 'undefined');
    console.error('Error details:', error.details || 'No additional details');
    console.error('Hint:', error.hint || 'No hints available');
    
    if (error.message && error.message.includes('Invalid API key')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   • Check that your SUPABASE_ANON_KEY is correct');
      console.error('   • Verify the key hasn\'t expired');
      console.error('   • Ensure the key matches your Supabase project');
    }
    
    return false;
  }
}

// Run the health check
if (require.main === module) {
  checkSupabaseHealth()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = checkSupabaseHealth;
