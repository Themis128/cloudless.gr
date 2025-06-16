#!/usr/bin/env node

/**
 * 10. User Management Script
 * Comprehensive user account management including adding users, admins, and managing roles
 * Merged from: add-admin.js, add-admin-simple.js, add-user.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:8000';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ';

const supabase = createClient(supabaseUrl, supabaseKey);

// Predefined test users
const TEST_USERS = [
  {
    email: 'baltzakis.themis@gmail.com',
    password: 'TH!123789th!',
    fullName: 'Themistoklis Baltzakis',
    role: 'user'
  },
  {
    email: 'admin@cloudless.gr',
    password: 'Admin123!@#',
    fullName: 'System Administrator',
    role: 'admin'
  },
  {
    email: 'user@cloudless.gr',
    password: 'User123!@#',
    fullName: 'Test User',
    role: 'user'
  }
];

async function createUser(email, password, fullName, role = 'user') {
  console.log(`🔧 Creating ${role} user: ${email}`);
  
  try {
    // Step 1: Create user account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });

    if (authError) {
      console.log(`❌ Failed to create user account: ${authError.message}`);
      return null;
    }

    if (!authData.user) {
      console.log('❌ No user data returned from signup');
      return null;
    }

    const userId = authData.user.id;
    console.log(`✅ User account created: ${userId}`);

    // Step 2: Create profile
    console.log(`👤 Creating ${role} profile...`);
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: userId,
        role: role
      }]);

    if (profileError) {
      console.log(`❌ Failed to create profile: ${profileError.message}`);
      // User account was created but profile failed
      return { userId, profileCreated: false, userInfoCreated: false };
    }

    console.log(`✅ Profile created with role: ${role}`);

    // Step 3: Create user info
    console.log(`📝 Creating user info...`);
    const { error: userInfoError } = await supabase
      .from('user-info')
      .insert([{
        id: userId,
        full_name: fullName
      }]);

    if (userInfoError) {
      console.log(`❌ Failed to create user info: ${userInfoError.message}`);
      return { userId, profileCreated: true, userInfoCreated: false };
    }

    console.log(`✅ User info created`);

    // Sign out the newly created user
    await supabase.auth.signOut();

    return { 
      userId, 
      profileCreated: true, 
      userInfoCreated: true,
      email,
      fullName,
      role
    };

  } catch (error) {
    console.log(`❌ Error creating user: ${error.message}`);
    return null;
  }
}

async function createMultipleUsers(users) {
  console.log(`🔧 Creating ${users.length} users...`);
  const results = [];

  for (const user of users) {
    console.log(`\n--- Creating user: ${user.email} ---`);
    const result = await createUser(user.email, user.password, user.fullName, user.role);
    results.push({ ...user, result });
    
    // Small delay between user creations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}

async function updateUserRole(email, newRole) {
  console.log(`🔧 Updating user role: ${email} → ${newRole}`);
  
  try {
    // First, find the user by email
    const { data: users, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email);

    if (fetchError || !users || users.length === 0) {
      console.log(`❌ User not found: ${email}`);
      return false;
    }

    const userId = users[0].id;

    // Update the role
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      console.log(`❌ Failed to update role: ${updateError.message}`);
      return false;
    }

    console.log(`✅ Role updated successfully`);
    return true;

  } catch (error) {
    console.log(`❌ Error updating role: ${error.message}`);
    return false;
  }
}

async function listUsers() {
  console.log('👥 Listing all users...\n');
  
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select(`
        id,
        role,
        created_at,
        user-info (
          full_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.log(`❌ Failed to fetch users: ${error.message}`);
      return [];
    }

    if (!profiles || profiles.length === 0) {
      console.log('📭 No users found');
      return [];
    }

    console.log('📋 User List:');
    console.log('═══════════════════════════════════════════════════════════');
    
    for (const profile of profiles) {
      const name = profile['user-info']?.[0]?.full_name || 'No name';
      const date = new Date(profile.created_at).toLocaleDateString();
      console.log(`${profile.role === 'admin' ? '🛡️ ' : '👤'} ${name}`);
      console.log(`   ID: ${profile.id}`);
      console.log(`   Role: ${profile.role}`);
      console.log(`   Created: ${date}`);
      console.log('');
    }

    return profiles;

  } catch (error) {
    console.log(`❌ Error listing users: ${error.message}`);
    return [];
  }
}

async function deleteUser(email) {
  console.log(`🗑️  Deleting user: ${email}`);
  
  try {
    // Note: This only deletes the profile and user-info
    // The auth.users entry cannot be deleted via client-side API
    
    // Find user first
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email);

    if (fetchError || !profiles || profiles.length === 0) {
      console.log(`❌ User not found: ${email}`);
      return false;
    }

    const userId = profiles[0].id;

    // Delete user-info
    const { error: userInfoError } = await supabase
      .from('user-info')
      .delete()
      .eq('id', userId);

    if (userInfoError) {
      console.log(`⚠️  Failed to delete user info: ${userInfoError.message}`);
    } else {
      console.log('✅ User info deleted');
    }

    // Delete profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.log(`❌ Failed to delete profile: ${profileError.message}`);
      return false;
    }

    console.log('✅ Profile deleted');
    console.log('⚠️  Note: Auth user entry still exists (requires admin API)');
    
    return true;

  } catch (error) {
    console.log(`❌ Error deleting user: ${error.message}`);
    return false;
  }
}

async function setupDefaultUsers() {
  console.log('🚀 Setting up default test users...\n');
  
  const results = await createMultipleUsers(TEST_USERS);
  
  console.log('\n📊 Setup Summary:');
  console.log('═════════════════');
  
  let successCount = 0;
  for (const { email, role, result } of results) {
    if (result && result.userId) {
      console.log(`✅ ${email} (${role}): Created successfully`);
      successCount++;
    } else {
      console.log(`❌ ${email} (${role}): Failed to create`);
    }
  }
  
  console.log(`\n🎯 ${successCount}/${results.length} users created successfully`);
  
  if (successCount > 0) {
    console.log('\n🔐 Login Credentials:');
    console.log('────────────────────');
    for (const user of TEST_USERS) {
      console.log(`${user.role === 'admin' ? '🛡️ ' : '👤'} ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log(`   Role: ${user.role}`);
    }
  }

  return results;
}

// Interactive mode helpers
function showUsage() {
  console.log('👥 USER MANAGEMENT SCRIPT');
  console.log('=========================\n');
  console.log('Usage: node scripts/10-manage-users.js [command] [options]\n');
  console.log('Commands:');
  console.log('  setup              Setup default test users');
  console.log('  list               List all users');
  console.log('  create             Create a single user (interactive)');
  console.log('  role <email> <role> Update user role');
  console.log('  delete <email>     Delete user profile');
  console.log('\nExamples:');
  console.log('  node scripts/10-manage-users.js setup');
  console.log('  node scripts/10-manage-users.js list');
  console.log('  node scripts/10-manage-users.js role user@example.com admin');
  console.log('  node scripts/10-manage-users.js delete user@example.com');
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    switch (command) {
      case 'setup':
        await setupDefaultUsers();
        break;
        
      case 'list':
        await listUsers();
        break;
        
      case 'create':
        // Interactive creation - could be enhanced with prompts
        console.log('📝 Interactive user creation not implemented yet');
        console.log('💡 Use "setup" command to create default users');
        break;
        
      case 'role':
        if (args.length < 3) {
          console.log('❌ Usage: role <email> <new-role>');
          process.exit(1);
        }
        await updateUserRole(args[1], args[2]);
        break;
        
      case 'delete':
        if (args.length < 2) {
          console.log('❌ Usage: delete <email>');
          process.exit(1);
        }
        await deleteUser(args[1]);
        break;
        
      default:
        showUsage();
        break;
    }
  } catch (error) {
    console.error('❌ User management failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { 
  createUser, 
  createMultipleUsers, 
  updateUserRole, 
  listUsers, 
  deleteUser, 
  setupDefaultUsers,
  TEST_USERS 
};
