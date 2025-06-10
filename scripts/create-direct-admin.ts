// One-time script to create an admin user with hardcoded Supabase credentials
import { createClient } from '@supabase/supabase-js';

// Hardcode the Supabase URL and service key for this one-time operation
const supabaseUrl = 'https://oflctqligzouzshimuqh.supabase.co';
const supabaseServiceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY4NjUwOTk1NSwiZXhwIjoyMDAyMDg1OTU1fQ.Z_q1bhKu6-EExULZHM4zzp0UFi6iswVJLA2kjwjfBHE';

// Initialize the Supabase client with the service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createAdminUser(email: string, password: string, name: string) {
  console.log('Starting admin user creation with direct credentials...');
  console.log(`Email: ${email}`);
  console.log(`Name: ${name}`);

  try {
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
      console.error('Auth Error:', authError.message);
      if (authError.message === 'User already registered') {
        console.log('User already exists. Attempting to update role...');
        // Could implement logic to find and update the user here if needed
      }
      return;
    }

    if (!authUser || !authUser.user) {
      console.error('No user data returned from Supabase');
      return;
    }

    console.log('User created successfully in Auth');
    console.log('User ID:', authUser.user.id);

    // 2. Add custom claims for the admin role
    const { error: claimsError } = await supabase.rpc('set_claim', {
      uid: authUser.user.id,
      claim: 'role',
      value: 'ADMIN',
    });

    if (claimsError) {
      console.error('Error setting admin claim:', claimsError.message);
      return;
    }

    // 3. Insert or update profile data in the profiles table (if it exists)
    try {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authUser.user.id,
        full_name: name,
        role: 'ADMIN',
        is_active: true,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.error('Profile update error:', profileError.message);
      } else {
        console.log('Profile updated successfully');
      }
    } catch (err) {
      console.log('Skipping profile update - table might not exist');
    }

    console.log('✅ Admin user creation complete!');
    console.log({
      id: authUser.user.id,
      email: authUser.user.email,
      name: name,
      role: 'ADMIN',
    });
  } catch (error: any) {
    console.error('Unexpected error:', error.message || error);
  }
}

// Get command line arguments
const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('Please provide email and password');
  console.log('Usage: npx tsx create-direct-admin.ts <email> <password> [name]');
  process.exit(1);
}

// Execute the function
createAdminUser(email, password, name || 'Admin User');
