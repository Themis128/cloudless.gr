// One-time script to create an admin user with hardcoded Supabase credentials - alternate method
import { createClient } from '@supabase/supabase-js';

// Hardcode the Supabase URL and service key for this one-time operation
const supabaseUrl = 'https://oflctqligzouzshimuqh.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mbGN0cWxpZ3pvdXpzaGltdXFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODY1MDk5NTUsImV4cCI6MjAwMjA4NTk1NX0.Bybf2ukVbEGRGSzVXbEpg-EZfEIGmTiBRXGAIWl4Kjc';

async function createAdminUser(email: string, password: string, name: string) {
  console.log('Starting admin user creation using sign-up approach...');
  console.log(`Email: ${email}`);
  console.log(`Name: ${name}`);

  try {
    // Initialize the Supabase client with the anon key
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Sign up the user directly
    console.log('Creating user via sign-up...');

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: 'ADMIN',
        },
      },
    });

    if (signUpError) {
      console.error('Sign-up Error:', signUpError.message);
      return;
    }

    if (!signUpData || !signUpData.user) {
      console.error('No user data returned from sign-up');
      return;
    }

    console.log('User signed up successfully');
    console.log('User ID:', signUpData.user.id);

    // 2. Now let's sign in to get a session
    console.log('Signing in as the new user...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error('Sign-in Error:', signInError.message);
      return;
    }

    console.log('Signed in successfully');

    // 3. Update the user's metadata
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        role: 'ADMIN',
        is_admin: true,
      },
    });

    if (updateError) {
      console.error('Update metadata error:', updateError.message);
    } else {
      console.log('User metadata updated to set admin role');
    }

    // 4. Create a record in a custom "admins" table if available
    try {
      const { error: adminError } = await supabase.from('admins').insert({
        user_id: signUpData.user.id,
        name: name,
        created_at: new Date().toISOString(),
      });

      if (adminError) {
        console.log('Admin table entry error (may be ignorable):', adminError.message);
      } else {
        console.log('Admin record created successfully');
      }
    } catch (err) {
      console.log('Skipping admin table insert - table might not exist');
    }

    console.log('✅ Admin user creation complete!');
    console.log({
      id: signUpData.user.id,
      email: signUpData.user.email,
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
