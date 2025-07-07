import sql from './db.js';

async function checkAuthRestrictions() {
  try {
    console.log('🔍 Checking auth restrictions and email verification...\n');
    
    // Check if there are any auth restrictions in the database
    console.log('📧 Email verification status:');
    const emailStatus = await sql`
      SELECT email, email_confirmed_at, email_change_sent_at, phone_confirmed_at, confirmed_at
      FROM auth.users 
      WHERE email = 'baltzakis.themis@gmail.com'
    `;
    
    if (emailStatus.length > 0) {
      const user = emailStatus[0];
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Email confirmed at: ${user.email_confirmed_at || 'NOT CONFIRMED'}`);
      console.log(`  - Confirmed at: ${user.confirmed_at || 'NOT CONFIRMED'}`);
      console.log(`  - Phone confirmed at: ${user.phone_confirmed_at || 'NOT CONFIRMED'}`);
      console.log(`  - Email change sent at: ${user.email_change_sent_at || 'None'}`);
    }
    
    // Check auth configuration table if it exists
    console.log('\n⚙️ Auth configuration:');
    try {
      const authConfig = await sql`
        SELECT * FROM auth.config LIMIT 1
      `;
      console.log('  - Auth config found:', authConfig.length > 0);
      if (authConfig.length > 0) {
        console.log('  - Config:', JSON.stringify(authConfig[0], null, 2));
      }
    } catch (configErr) {
      console.log('  - No auth.config table found');
    }
    
    // Check for any functions that might validate authentication
    console.log('\n🔧 Custom auth functions:');
    const authFunctions = await sql`
      SELECT routine_name, routine_type, routine_definition
      FROM information_schema.routines 
      WHERE routine_schema IN ('auth', 'public') 
      AND (routine_name LIKE '%auth%' OR routine_name LIKE '%login%' OR routine_name LIKE '%sign%')
      ORDER BY routine_name
    `;
    
    if (authFunctions.length === 0) {
      console.log('  ✅ No custom auth functions found');
    } else {
      authFunctions.forEach(func => {
        console.log(`  - ${func.routine_type}: ${func.routine_name}`);
      });
    }
    
    // Test manual confirmation of the user
    console.log('\n🧪 Testing manual email confirmation...');
    try {
      const updateResult = await sql`
        UPDATE auth.users 
        SET email_confirmed_at = NOW(), confirmed_at = NOW()
        WHERE email = 'baltzakis.themis@gmail.com'
        RETURNING email, email_confirmed_at, confirmed_at
      `;
      
      if (updateResult.length > 0) {
        console.log('  ✅ Email confirmation updated successfully');
        console.log(`  📧 Email: ${updateResult[0].email}`);
        console.log(`  ⏰ Confirmed at: ${updateResult[0].confirmed_at}`);
        
        // Also update profile
        const profileUpdate = await sql`
          UPDATE profiles 
          SET email_verified = true, updated_at = NOW()
          WHERE email = 'baltzakis.themis@gmail.com'
          RETURNING email, email_verified
        `;
        
        if (profileUpdate.length > 0) {
          console.log('  ✅ Profile email_verified updated to true');
        }
      }
    } catch (updateErr) {
      console.log('  ❌ Failed to update email confirmation:', updateErr.message);
    }
    
  } catch (err) {
    console.error('❌ Auth restrictions check failed:', err);
  } finally {
    process.exit(0);
  }
}

checkAuthRestrictions();
