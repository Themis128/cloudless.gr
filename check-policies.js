import sql from './db.js';

async function checkSupabasePolicies() {
  try {
    console.log('🔍 Checking Supabase RLS policies and rules...\n');
    
    // Check RLS status on tables
    console.log('📋 RLS Status on Tables:');
    const rlsStatus = await sql`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname IN ('public', 'auth') 
      ORDER BY schemaname, tablename
    `;
    rlsStatus.forEach(table => {
      console.log(`  - ${table.schemaname}.${table.tablename}: RLS ${table.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
    });
    
    // Check policies on profiles table
    console.log('\n🛡️ Policies on profiles table:');
    const profilesPolicies = await sql`
      SELECT policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies 
      WHERE schemaname = 'public' AND tablename = 'profiles'
      ORDER BY policyname
    `;
    
    if (profilesPolicies.length === 0) {
      console.log('  ❌ No RLS policies found on profiles table');
    } else {
      profilesPolicies.forEach(policy => {
        console.log(`  - Policy: ${policy.policyname}`);
        console.log(`    Command: ${policy.cmd}`);
        console.log(`    Roles: ${policy.roles}`);
        console.log(`    Condition: ${policy.qual || 'None'}`);
        console.log(`    With Check: ${policy.with_check || 'None'}\n`);
      });
    }
    
    // Check auth.users table permissions
    console.log('🔐 Auth schema table permissions:');
    const authPerms = await sql`
      SELECT table_name, privilege_type, grantee
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'auth' AND table_name = 'users'
      ORDER BY table_name, grantee
    `;
    authPerms.forEach(perm => {
      console.log(`  - ${perm.table_name}: ${perm.privilege_type} granted to ${perm.grantee}`);
    });
    
    // Check public schema permissions
    console.log('\n📁 Public schema table permissions:');
    const publicPerms = await sql`
      SELECT table_name, privilege_type, grantee
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'public' AND table_name = 'profiles'
      ORDER BY table_name, grantee
    `;
    publicPerms.forEach(perm => {
      console.log(`  - ${perm.table_name}: ${perm.privilege_type} granted to ${perm.grantee}`);
    });
    
    // Check for any triggers that might interfere
    console.log('\n⚡ Triggers on profiles table:');
    const triggers = await sql`
      SELECT trigger_name, event_manipulation, action_timing, action_statement
      FROM information_schema.triggers 
      WHERE event_object_schema = 'public' AND event_object_table = 'profiles'
      ORDER BY trigger_name
    `;
    
    if (triggers.length === 0) {
      console.log('  ✅ No triggers found on profiles table');
    } else {
      triggers.forEach(trigger => {
        console.log(`  - Trigger: ${trigger.trigger_name}`);
        console.log(`    Event: ${trigger.event_manipulation} ${trigger.action_timing}`);
        console.log(`    Action: ${trigger.action_statement}\n`);
      });
    }
    
    // Check Supabase auth configuration
    console.log('🔧 Supabase Auth Configuration:');
    try {
      const authConfig = await sql`
        SELECT name, setting 
        FROM pg_settings 
        WHERE name LIKE '%supabase%' OR name LIKE '%jwt%'
        ORDER BY name
      `;
      
      if (authConfig.length === 0) {
        console.log('  ℹ️ No specific Supabase settings found in pg_settings');
      } else {
        authConfig.forEach(config => {
          console.log(`  - ${config.name}: ${config.setting}`);
        });
      }
    } catch (configErr) {
      console.log('  ⚠️ Could not retrieve auth configuration');
    }
    
    // Test direct profile access with service role
    console.log('\n🧪 Testing Profile Access:');
    try {
      const profileTest = await sql`
        SELECT id, email, role, is_active, email_verified
        FROM profiles 
        WHERE email = 'baltzakis.themis@gmail.com'
      `;
      
      if (profileTest.length > 0) {
        console.log('  ✅ Profile accessible via service role');
        console.log(`  📊 Profile data: ${JSON.stringify(profileTest[0], null, 2)}`);
      } else {
        console.log('  ❌ Profile not found or not accessible');
      }
    } catch (profileErr) {
      console.log('  ❌ Error accessing profile:', profileErr.message);
    }
    
  } catch (err) {
    console.error('❌ Database policy check failed:', err);
  } finally {
    process.exit(0);
  }
}

checkSupabasePolicies();
