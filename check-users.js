import sql from './db.js';

async function checkUsers() {
  try {
    console.log('🔍 Checking users in database...');
    
    // Check auth.users table
    const authUsers = await sql`SELECT email, id, created_at FROM auth.users ORDER BY created_at DESC LIMIT 10`;
    console.log('📧 Users in auth.users:');
    authUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.id})`);
    });
    
    // Check profiles table
    const profiles = await sql`SELECT email, id, role, is_active FROM profiles ORDER BY created_at DESC LIMIT 10`;
    console.log('\n👤 Users in profiles:');
    profiles.forEach(profile => {
      console.log(`  - ${profile.email} (role: ${profile.role}, active: ${profile.is_active})`);
    });
    
    // Check if our test user exists
    const testUser = await sql`SELECT * FROM auth.users WHERE email = 'baltzakis.themis@gmail.com'`;
    console.log('\n🎯 Test user check:');
    if (testUser.length > 0) {
      console.log('  ✅ Test user exists in auth.users');
      const testProfile = await sql`SELECT * FROM profiles WHERE email = 'baltzakis.themis@gmail.com'`;
      if (testProfile.length > 0) {
        console.log('  ✅ Test user profile exists:', testProfile[0]);
      } else {
        console.log('  ❌ Test user profile missing');
      }
    } else {
      console.log('  ❌ Test user does not exist');
    }
    
  } catch (err) {
    console.error('❌ Database query failed:', err);
  } finally {
    process.exit(0);
  }
}

checkUsers();
