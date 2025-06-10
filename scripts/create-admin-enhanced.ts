import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

console.log('Debug - Environment variables:');
console.log('SUPABASE_URL:', supabaseUrl);
console.log('SUPABASE_SERVICE_KEY exists:', !!supabaseKey);

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing required environment variables');
  console.error('Required: SUPABASE_URL (or NUXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

async function createAdminUser(email: string, password: string, name: string = 'Admin User') {
  try {
    console.log('Starting admin user creation process...');
    console.log('Email:', email);
    console.log('Name:', name);

    // 1. Create the user in Supabase Auth
    console.log('Creating user in Supabase Auth...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'ADMIN',
      },
    });

    if (authError) {
      console.error('Auth Error Details:', authError);
      throw new Error(`Auth Error: ${authError.message}`);
    }

    if (!authUser?.user) {
      throw new Error('User creation succeeded but no user data was returned');
    }

    console.log('User created in Auth system. User ID:', authUser.user.id);

    // 2. Set custom claims for admin role
    console.log('Setting admin role claims...');
    const { error: claimsError } = await supabase.auth.admin.updateUserById(authUser.user.id, {
      user_metadata: { role: 'ADMIN' },
    });

    if (claimsError) {
      console.error('Claims Error Details:', claimsError);
      throw new Error(`Claims Error: ${claimsError.message}`);
    }

    // 3. Create or update profile in profiles table
    console.log('Creating user profile...');
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authUser.user.id,
      full_name: name,
      role: 'ADMIN',
      is_active: true,
      email_verified: true,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error('Profile Error Details:', profileError);
      throw new Error(`Profile Error: ${profileError.message}`);
    }

    console.log('Success! Admin user created:', {
      id: authUser.user.id,
      email: authUser.user.email,
      name,
      role: 'ADMIN',
    });
  } catch (error) {
    console.error('Detailed error:', error);
    process.exit(1);
  }
}

// Get command line arguments
const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('Please provide email and password');
  console.log('Usage: npm run create:admin:supabase <email> <password> [name]');
  process.exit(1);
}

// Execute the function
createAdminUser(email, password, name).catch(error => {
  console.error('Top level error:', error);
  process.exit(1);
});
