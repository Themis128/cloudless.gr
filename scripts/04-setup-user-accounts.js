#!/usr/bin/env node
// User Account Setup Script
// Creates test user accounts for development and testing
//
// Features:
//   • Admin account creation
//   • Test user account creation
//   • Bulk user creation from templates
//   • Account verification and testing
//   • Role assignment and management
//
// Usage Examples:
//   node scripts/04-setup-user-accounts.js                    # Interactive setup
//   node scripts/04-setup-user-accounts.js --admin           # Create admin only
//   node scripts/04-setup-user-accounts.js --test-users      # Create test users only
//   node scripts/04-setup-user-accounts.js --batch           # Batch create from config

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import readline from 'readline';

config();

// Parse command line arguments
const args = process.argv.slice(2);
const adminOnly = args.includes('--admin');
const testUsersOnly = args.includes('--test-users');
const batchMode = args.includes('--batch');

const adminSupabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Create readline interface for user interaction
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

// Default test users configuration
const defaultTestUsers = [
    {
        email: 'admin@example.com',
        password: 'admin123456',
        role: 'admin',
        full_name: 'System Administrator',
        bio: 'System administrator account for testing'
    },
    {
        email: 'user@example.com',
        password: 'user123456',
        role: 'user',
        full_name: 'Test User',
        bio: 'Regular user account for testing'
    },
    {
        email: 'demo@example.com',
        password: 'demo123456',
        role: 'user',
        full_name: 'Demo User',
        bio: 'Demo account for presentations and testing'
    }
];

async function createUserAccount(userConfig) {
    console.log(`\\n  🔧 Creating account: ${userConfig.email}`);
    
    try {
        // Create user in auth.users
        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
            email: userConfig.email,
            password: userConfig.password,
            email_confirm: true
        });
        
        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log(`    ⚠️  User already exists: ${userConfig.email}`);
                return await updateExistingUser(userConfig);
            } else {
                throw authError;
            }
        }
        
        const userId = authData.user.id;
        console.log(`    ✅ Auth user created with ID: ${userId}`);
        
        // Create profile record
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .insert({
                id: userId,
                role: userConfig.role || 'user'
            });
        
        if (profileError) {
            console.log(`    ⚠️  Profile creation warning: ${profileError.message}`);
        } else {
            console.log(`    ✅ Profile created with role: ${userConfig.role || 'user'}`);
        }
        
        // Create user-info record if additional info provided
        if (userConfig.full_name || userConfig.bio || userConfig.avatar_url) {
            const { error: userInfoError } = await adminSupabase
                .from('user-info')
                .insert({
                    id: userId,
                    full_name: userConfig.full_name,
                    bio: userConfig.bio,
                    avatar_url: userConfig.avatar_url,
                    website: userConfig.website,
                    location: userConfig.location
                });
            
            if (userInfoError) {
                console.log(`    ⚠️  User info creation warning: ${userInfoError.message}`);
            } else {
                console.log(`    ✅ User info created`);
            }
        }
        
        return { success: true, userId, email: userConfig.email };
        
    } catch (error) {
        console.log(`    ❌ Failed to create ${userConfig.email}: ${error.message}`);
        return { success: false, email: userConfig.email, error: error.message };
    }
}

async function updateExistingUser(userConfig) {
    try {
        // Get existing user
        const { data: existingUsers, error: getUserError } = await adminSupabase.auth.admin.listUsers();
        if (getUserError) throw getUserError;
        
        const existingUser = existingUsers.users.find(u => u.email === userConfig.email);
        if (!existingUser) {
            throw new Error('User not found after creation attempt');
        }
        
        const userId = existingUser.id;
        console.log(`    🔄 Updating existing user: ${userId}`);
        
        // Update or create profile
        const { error: profileError } = await adminSupabase
            .from('profiles')
            .upsert({
                id: userId,
                role: userConfig.role || 'user',
                updated_at: new Date().toISOString()
            });
        
        if (profileError) {
            console.log(`    ⚠️  Profile update warning: ${profileError.message}`);
        } else {
            console.log(`    ✅ Profile updated with role: ${userConfig.role || 'user'}`);
        }
        
        // Update or create user-info
        if (userConfig.full_name || userConfig.bio) {
            const { error: userInfoError } = await adminSupabase
                .from('user-info')
                .upsert({
                    id: userId,
                    full_name: userConfig.full_name,
                    bio: userConfig.bio,
                    avatar_url: userConfig.avatar_url,
                    website: userConfig.website,
                    location: userConfig.location,
                    updated_at: new Date().toISOString()
                });
            
            if (userInfoError) {
                console.log(`    ⚠️  User info update warning: ${userInfoError.message}`);
            } else {
                console.log(`    ✅ User info updated`);
            }
        }
        
        return { success: true, userId, email: userConfig.email, updated: true };
        
    } catch (error) {
        console.log(`    ❌ Failed to update ${userConfig.email}: ${error.message}`);
        return { success: false, email: userConfig.email, error: error.message };
    }
}

async function testUserAuthentication(email, password) {
    console.log(`\\n  🧪 Testing authentication for: ${email}`);
    
    try {
        // Create a separate client for testing user authentication
        const testClient = createClient(
            process.env.SUPABASE_URL || 'http://localhost:54321',
            process.env.SUPABASE_ANON_KEY
        );
        
        // Test sign in
        const { data, error } = await testClient.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            console.log(`    ❌ Authentication failed: ${error.message}`);
            return false;
        }
        
        console.log(`    ✅ Authentication successful`);
        console.log(`    👤 User ID: ${data.user.id}`);
        console.log(`    📧 Email: ${data.user.email}`);
        
        // Test profile access
        const { data: profile, error: profileError } = await testClient
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
        
        if (profileError) {
            console.log(`    ⚠️  Profile access warning: ${profileError.message}`);
        } else {
            console.log(`    ✅ Profile accessible, role: ${profile.role}`);
        }
        
        // Sign out
        await testClient.auth.signOut();
        console.log(`    🚪 Signed out successfully`);
        
        return true;
        
    } catch (error) {
        console.log(`    ❌ Authentication test failed: ${error.message}`);
        return false;
    }
}

async function createInteractiveUser() {
    console.log('\\n📝 INTERACTIVE USER CREATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const email = await question('📧 Email address: ');
    const password = await question('🔐 Password (min 6 chars): ');
    const role = await question('👤 Role (admin/user) [user]: ') || 'user';
    const fullName = await question('📛 Full name (optional): ');
    const bio = await question('📝 Bio (optional): ');
    
    const userConfig = {
        email,
        password,
        role,
        full_name: fullName || null,
        bio: bio || null
    };
    
    console.log('\\n🔧 Creating user with provided information...');
    const result = await createUserAccount(userConfig);
    
    if (result.success) {
        console.log('\\n🧪 Testing authentication...');
        await testUserAuthentication(email, password);
    }
    
    return result;
}

async function createBatchUsers(users) {
    console.log('\\n🔄 BATCH USER CREATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const results = [];
    
    for (const userConfig of users) {
        const result = await createUserAccount(userConfig);
        results.push(result);
        
        // Small delay between creations
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
}

async function listExistingUsers() {
    console.log('\\n👥 EXISTING USERS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        const { data: users, error } = await adminSupabase.auth.admin.listUsers();
        if (error) throw error;
        
        if (users.users.length === 0) {
            console.log('  📭 No users found');
            return [];
        }
        
        console.log(`  📊 Found ${users.users.length} user(s):`);
        
        for (const user of users.users) {
            console.log(`\\n    👤 ${user.email}`);
            console.log(`       ID: ${user.id}`);
            console.log(`       Created: ${new Date(user.created_at).toLocaleString()}`);
            console.log(`       Confirmed: ${user.email_confirmed_at ? '✅' : '❌'}`);
            
            // Get profile info
            try {
                const { data: profile } = await adminSupabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                
                if (profile) {
                    console.log(`       Role: ${profile.role}`);
                }
            } catch (e) {
                console.log(`       Role: ⚠️  No profile found`);
            }
        }
        
        return users.users;
        
    } catch (error) {
        console.log(`  ❌ Error listing users: ${error.message}`);
        return [];
    }
}

// Main execution
async function main() {
    console.log('👥 USER ACCOUNT SETUP SCRIPT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const startTime = Date.now();
    
    try {
        // Test database connectivity first
        console.log('🔗 Testing database connectivity...');
        const { error: connectivityError } = await adminSupabase
            .from('profiles')
            .select('count', { count: 'exact' })
            .limit(0);
        
        if (connectivityError && !connectivityError.message.includes('does not exist')) {
            throw new Error(`Database connectivity failed: ${connectivityError.message}`);
        }
        console.log('  ✅ Database connectivity OK');
        
        // List existing users
        const existingUsers = await listExistingUsers();
        
        let results = [];
        
        if (batchMode) {
            // Batch mode - create default test users
            console.log('\\n🚀 Running in batch mode with default test users');
            results = await createBatchUsers(defaultTestUsers);
            
        } else if (adminOnly) {
            // Admin only mode
            const adminUser = defaultTestUsers.find(u => u.role === 'admin');
            console.log('\\n👑 Creating admin user only');
            results = [await createUserAccount(adminUser)];
            
        } else if (testUsersOnly) {
            // Test users only mode
            const testUsers = defaultTestUsers.filter(u => u.role === 'user');
            console.log('\\n👤 Creating test users only');
            results = await createBatchUsers(testUsers);
            
        } else {
            // Interactive mode
            if (existingUsers.length > 0) {
                console.log('\\n❓ Users already exist. What would you like to do?');
                console.log('  1. Create additional user interactively');
                console.log('  2. Create default test users');
                console.log('  3. Exit');
                
                const choice = await question('\\nChoose an option (1-3): ');
                
                switch (choice) {
                    case '1':
                        results = [await createInteractiveUser()];
                        break;
                    case '2':
                        results = await createBatchUsers(defaultTestUsers);
                        break;
                    case '3':
                        console.log('👋 Exiting...');
                        rl.close();
                        return;
                    default:
                        console.log('Invalid choice, exiting...');
                        rl.close();
                        return;
                }
            } else {
                console.log('\\n🆕 No existing users found. Creating default test users...');
                results = await createBatchUsers(defaultTestUsers);
            }
        }
        
        // Test authentication for created users
        if (results.some(r => r.success)) {
            console.log('\\n🧪 TESTING AUTHENTICATION');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            for (const result of results) {
                if (result.success && !result.updated) {
                    const userConfig = defaultTestUsers.find(u => u.email === result.email) || 
                                     { password: 'defaultpassword123' };
                    await testUserAuthentication(result.email, userConfig.password);
                }
            }
        }
        
        // Summary
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log('\\n📊 SETUP SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const updated = results.filter(r => r.updated).length;
        
        console.log(`⏱️  Completed in ${duration} seconds`);
        console.log(`✅ Successfully created/updated: ${successful} accounts`);
        if (updated > 0) console.log(`🔄 Updated existing: ${updated} accounts`);
        if (failed > 0) console.log(`❌ Failed: ${failed} accounts`);
        
        if (successful > 0) {
            console.log('\\n📋 Next steps:');
            console.log('  • Test authentication: node scripts/11-test-authentication.js');
            console.log('  • Check access points: node scripts/13-show-access-points.js');
            console.log('  • View users in Supabase Studio: http://localhost:54323');
        }
        
        rl.close();
        
    } catch (error) {
        console.log('\\n❌ FATAL ERROR:', error.message);
        console.log('\\n💡 Troubleshooting:');
        console.log('  • Ensure database tables exist: node scripts/06-check-database.js');
        console.log('  • Check Supabase is running: docker-compose ps');
        console.log('  • Verify environment variables in .env file');
        
        rl.close();
        process.exit(1);
    }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\\n👋 Exiting...');
    rl.close();
    process.exit(0);
});

// Run the script
main().catch(console.error);
