// create-admin.js

import { createClient } from '@supabase/supabase-js';

// Use your Supabase project's service role key here (NOT the anon/public key)
const supabase = createClient(
  'https://your-project.supabase.co',
  'your-service-role-key', // WARNING: keep this safe and NEVER expose to frontend
);

async function createAdminUser() {
  // Step 1: Create user in auth.users
  const { data: user, error: authError } = await supabase.auth.admin.createUser({
    email: 'admin@cloudless.gr',
    password: 'cloudless2025',
    email_confirm: true,
  });

  if (authError) {
    console.error('Error creating user:', authError.message);
    return;
  }

  console.log('✅ User created:', user.id);

  // Step 2: Insert into admins table
  const { error: insertError } = await supabase.from('admins').insert({
    id: user.id, // foreign key to auth.users
    email: user.email,
    password: null, // or optionally store hash if managing your own (see note below)
  });

  if (insertError) {
    console.error('❌ Error inserting into admins table:', insertError.message);
    return;
  }

  console.log('✅ Admin inserted successfully');
}

createAdminUser();
