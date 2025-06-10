import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = 'https://oflctqligzouzshimuqh.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY must be set in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createAdminUser(email: string, password: string, name: string = 'Admin User') {
  try {
    console.log('Starting admin user creation process...');
    console.log('Email:', email);
    console.log('Name:', name);

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

    if (!authUser || !authUser.user) {
      throw new Error('No user was created');
    }

    console.log('User created successfully in Auth system');

    // Update user's role in the profiles table
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authUser.user.id,
      full_name: name,
      role: 'ADMIN',
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error('Profile Error Details:', profileError);
      throw new Error(`Profile Error: ${profileError.message}`);
    }

    console.log('Admin user created successfully:', {
      id: authUser.user.id,
      email: authUser.user.email,
      name: name,
      role: 'ADMIN',
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Get command line arguments
const [email, password, name] = process.argv.slice(2);

if (!email || !password) {
  console.error('Please provide email and password');
  console.log('Usage: npm run create:admin <email> <password> [name]');
  process.exit(1);
}

// Execute the function
createAdminUser(email, password, name);
