import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config(); // Load environment variables

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase Connection...');

  const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables');
    console.error('   Make sure NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY are set');
    process.exit(1);
  }

  console.log(`🌐 Using Supabase URL: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase.from('user_profiles').select('count');

    if (error) {
      if (error.code === 'PGRST116') {
        console.log('✅ Connected to Supabase successfully');
        console.log('ℹ️ Note: Table "user_profiles" may not exist yet (this is normal for new projects)');
      } else {
        throw error;
      }
    } else {
      console.log('✅ Connected to Supabase successfully');
      console.log(`📊 Found ${data?.length || 0} profiles`);
    }
  } catch (err: any) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
}

testSupabaseConnection().catch(console.error);
