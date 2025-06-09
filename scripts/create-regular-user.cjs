const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Error: Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function createRegularUser() {
  try {
    console.log('🔄 Creating regular user...');

    const { data, error } = await supabase.auth.admin.createUser({
      email: 'user@cloudless.gr',
      password: 'userpassword123',
      email_confirm: true,
      user_metadata: { 
        full_name: 'Regular User',
        role: 'user'
      }
    });

    if (error) {
      console.error('❌ Error creating regular user:', error.message);
      return;
    }

    console.log('✅ Regular user created successfully!');
    console.log('📧 Email:', data.user.email);
    console.log('🆔 User ID:', data.user.id);
    console.log('👤 Role: user');
    console.log('🔑 Password: userpassword123');
    
    // Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update the user profile with the correct role
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ 
        full_name: 'Regular User',
        role: 'user'
      })
      .eq('id', data.user.id);

    if (profileError) {
      console.warn('⚠️  Warning: Could not update user profile:', profileError.message);
    } else {
      console.log('✅ User profile updated successfully');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Run the script
createRegularUser();
