import postgres from 'postgres';

// Connect to local Supabase database
const sql = postgres('postgresql://postgres:postgres@localhost:54322/postgres');

async function resetPassword() {
  try {
    console.log('🔑 Resetting password for test user...\n');
    
    // Update password to password123
    await sql`
      UPDATE auth.users 
      SET encrypted_password = crypt('password123', gen_salt('bf')),
          updated_at = NOW()
      WHERE email = 'baltzakis.themis@gmail.com'
      RETURNING email
    `;
    
    console.log('✅ Password updated to "password123"');
    
    // Also update the profile email_verified to true
    await sql`
      UPDATE profiles 
      SET email_verified = true, updated_at = NOW()
      WHERE email = 'baltzakis.themis@gmail.com'
      RETURNING email, email_verified
    `;
    
    console.log('✅ Profile email_verified set to true');
    
  } catch (err) {
    console.error('❌ Password reset failed:', err);
  } finally {
    process.exit(0);
  }
}

resetPassword();
