import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service key for admin operations

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables'
  );
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

async function createAdminUser(email: string, password: string, name: string = 'Admin User') {
  try {
    console.log('Creating admin user...');

    // 1. Create the user in Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
        role: 'ADMIN',
      },
    });

    if (authError) {
      throw new Error(`Auth Error: ${authError.message}`);
    }

    if (!authUser.user) {
      throw new Error('No user was created');
    }

    // 2. Update user's role in the database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        role: 'ADMIN',
        is_active: true,
        name: name,
      })
      .eq('id', authUser.user.id);

    if (updateError) {
      throw new Error(`Database Error: ${updateError.message}`);
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
  console.log('Usage: npm run create:admin:supabase <email> <password> [name]');
  process.exit(1);
}

// Execute the function
createAdminUser(email, password, name);
