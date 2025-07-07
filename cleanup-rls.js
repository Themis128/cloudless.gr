import sql from './db.js';

async function cleanupRLSPolicies() {
  try {
    console.log('🧹 Cleaning up redundant RLS policies on profiles table...\n');
    
    // First, list all current policies
    console.log('📋 Current policies:');
    const currentPolicies = await sql`
      SELECT policyname, cmd
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'profiles'
      ORDER BY policyname
    `;
    currentPolicies.forEach(policy => {
      console.log(`  - ${policy.policyname} (${policy.cmd})`);
    });
    
    // Drop all existing policies
    console.log('\n🗑️ Dropping all existing policies...');
    const dropCommands = [
      'DROP POLICY IF EXISTS "Allow select for authenticated users" ON profiles',
      'DROP POLICY IF EXISTS "Allow service role to select any profile" ON profiles',
      'DROP POLICY IF EXISTS "Allow user to read own profile" ON profiles',
      'DROP POLICY IF EXISTS "Allow user to update own profile" ON profiles',
      'DROP POLICY IF EXISTS "Allow users to select their own profile" ON profiles',
      'DROP POLICY IF EXISTS "Enable insert for authenticated users" ON profiles',
      'DROP POLICY IF EXISTS "Service role can read any profile" ON profiles',
      'DROP POLICY IF EXISTS "Users can insert their profile" ON profiles',
      'DROP POLICY IF EXISTS "Users can read their profile" ON profiles',
      'DROP POLICY IF EXISTS "Users can update their own profile" ON profiles',
      'DROP POLICY IF EXISTS "Users can update their profile" ON profiles',
      'DROP POLICY IF EXISTS "Users can view their own profile" ON profiles',
      'DROP POLICY IF EXISTS "Users can view their profile" ON profiles'
    ];
    
    for (const dropCmd of dropCommands) {
      try {
        await sql.unsafe(dropCmd);
        console.log(`  ✅ Executed: ${dropCmd}`);
      } catch (dropErr) {
        console.log(`  ⚠️ Failed: ${dropCmd} - ${dropErr.message}`);
      }
    }
    
    // Enable RLS on profiles table
    console.log('\n🛡️ Enabling RLS on profiles table...');
    await sql.unsafe('ALTER TABLE profiles ENABLE ROW LEVEL SECURITY');
    console.log('  ✅ RLS enabled');
    
    // Create simple, non-conflicting policies
    console.log('\n🔧 Creating simplified policies...');
    
    const newPolicies = [
      {
        name: 'profiles_select_own',
        sql: `CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id)`
      },
      {
        name: 'profiles_insert_own', 
        sql: `CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id)`
      },
      {
        name: 'profiles_update_own',
        sql: `CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`
      },
      {
        name: 'profiles_service_role_all',
        sql: `CREATE POLICY "profiles_service_role_all" ON profiles FOR ALL USING (auth.role() = 'service_role')`
      }
    ];
    
    for (const policy of newPolicies) {
      try {
        await sql.unsafe(policy.sql);
        console.log(`  ✅ Created: ${policy.name}`);
      } catch (policyErr) {
        console.log(`  ❌ Failed to create ${policy.name}: ${policyErr.message}`);
      }
    }
    
    // Verify new policies
    console.log('\n✅ New policies:');
    const newPolicyList = await sql`
      SELECT policyname, cmd, permissive, roles, qual, with_check
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'profiles'
      ORDER BY policyname
    `;
    newPolicyList.forEach(policy => {
      console.log(`  - ${policy.policyname} (${policy.cmd})`);
      console.log(`    Using: ${policy.qual || 'None'}`);
      console.log(`    With Check: ${policy.with_check || 'None'}\n`);
    });
    
  } catch (err) {
    console.error('❌ Policy cleanup failed:', err);
  } finally {
    process.exit(0);
  }
}

cleanupRLSPolicies();
