import postgres from 'postgres';

// Connect to local Supabase database
const sql = postgres('postgresql://postgres:postgres@localhost:54322/postgres');

async function checkUserSetup() {
  try {
    console.log('🔍 Checking user setup in database...\n');
    
    // Check if the user exists in auth.users
    const authUsers = await sql`
      SELECT id, email, email_confirmed_at, encrypted_password IS NOT NULL as has_password
      FROM auth.users 
      WHERE email = 'baltzakis.themis@gmail.com'
    `;
    
    if (authUsers.length === 0) {
      console.log('❌ User not found in auth.users table');
      
      // Create the user
      console.log('🛠️ Creating user in auth.users...');
      const newUserId = crypto.randomUUID();
      
      await sql`
        INSERT INTO auth.users (
          id, 
          email, 
          encrypted_password, 
          email_confirmed_at, 
          confirmed_at,
          created_at,
          updated_at,
          raw_app_meta_data,
          raw_user_meta_data
        ) VALUES (
          ${newUserId},
          'baltzakis.themis@gmail.com',
          crypt('password123', gen_salt('bf')),
          NOW(),
          NOW(),
          NOW(),
          NOW(),
          '{"provider":"email","providers":["email"]}',
          '{"email":"baltzakis.themis@gmail.com"}'
        )
      `;
      
      console.log('✅ User created in auth.users');
      
      // Also create in profiles
      const profileExists = await sql`
        SELECT id FROM profiles WHERE email = 'baltzakis.themis@gmail.com'
      `;
      
      if (profileExists.length === 0) {
        await sql`
          INSERT INTO profiles (
            id, email, full_name, role, is_active, email_verified, failed_login_attempts
          ) VALUES (
            ${newUserId}, 'baltzakis.themis@gmail.com', 'Test User', 'user', true, true, 0
          )
        `;
        console.log('✅ User created in profiles');
      }
    } else {
      const user = authUsers[0];
      console.log('✅ User found in auth.users:');
      console.log(`  - ID: ${user.id}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
      console.log(`  - Has password: ${user.has_password ? 'Yes' : 'No'}`);
      
      if (!user.has_password) {
        console.log('🛠️ Setting password for user...');
        await sql`
          UPDATE auth.users 
          SET encrypted_password = crypt('password123', gen_salt('bf'))
          WHERE email = 'baltzakis.themis@gmail.com'
        `;
        console.log('✅ Password set for user');
      }
    }
    
    // Check profile
    const profiles = await sql`
      SELECT * FROM profiles WHERE email = 'baltzakis.themis@gmail.com'
    `;
    
    if (profiles.length > 0) {
      console.log('\n✅ Profile found:');
      console.log(`  - Full name: ${profiles[0].full_name}`);
      console.log(`  - Role: ${profiles[0].role}`);
      console.log(`  - Active: ${profiles[0].is_active}`);
      console.log(`  - Email verified: ${profiles[0].email_verified}`);
    } else {
      console.log('\n❌ No profile found');
    }
    
  } catch (err) {
    console.error('❌ User setup check failed:', err);
  } finally {
    process.exit(0);
  }
}

checkUserSetup();
