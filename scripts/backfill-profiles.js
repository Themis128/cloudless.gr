// scripts/backfill-profiles.js


import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Explicitly load .env from project root
config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testFetchProfiles() {
  // Fetch all rows from the 'profiles' table
  const { data, error } = await supabase.from('profiles').select('*').limit(5);
  if (error) {
    console.error('❌ Error fetching profiles:', error.message);
  } else {
    console.log('✅ Profiles fetched:', data);
  }
}

testFetchProfiles();
