#!/usr/bin/env node
// Database Seeding Script
// Seeds the database with test data, user accounts, and initial configuration
//
// Features:
//   • Test user creation with profiles
//   • Admin account setup
//   • Sample data insertion
//   • Configurable seeding options
//   • Verification of seeded data
//
// Usage Examples:
//   node scripts/07-seed-database.js                    # Full seeding
//   node scripts/07-seed-database.js --users-only      # Users only
//   node scripts/07-seed-database.js --admin-only      # Admin users only
//   node scripts/07-seed-database.js --clear-first     # Clear existing data first

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

// Parse command line arguments
const args = process.argv.slice(2);
const usersOnly = args.includes('--users-only');
const adminOnly = args.includes('--admin-only');
const clearFirst = args.includes('--clear-first');

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables');
    console.log('Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Seed data configuration
const seedUsers = [
    {
        email: 'admin@cloudless.gr',
        password: 'Admin123456!',
        firstName: 'System',
        lastName: 'Administrator',
        username: 'admin',
        role: 'admin',
        bio: 'System administrator account',
        avatar_url: null,
        website: 'https://cloudless.gr',
        location: 'Greece'
    },
    {
        email: 'demo@cloudless.gr',
        password: 'Demo123456!',
        firstName: 'Demo',
        lastName: 'User',
        username: 'demo',
        role: 'user',
        bio: 'Demo user account for testing and presentations',
        avatar_url: null,
        website: null,
        location: 'Demo Location'
    },
    {
        email: 'test@example.com',
        password: 'Test123456!',
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        role: 'user',
        bio: 'Test user account for development',
        avatar_url: null,
        website: null,
        location: null
    },
    {
        email: 'john.doe@example.com',
        password: 'John123456!',
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        role: 'user',
        bio: 'Sample user account with complete profile',
        avatar_url: null,
        website: 'https://johndoe.example.com',
        location: 'New York, USA'
    }
];

async function clearExistingData() {
    console.log('🧹 CLEARING EXISTING DATA...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        // Get all existing users
        console.log('  🔍 Finding existing users...');
        const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
        
        if (listError) {
            console.log('  ⚠️  Warning: Could not list users:', listError.message);
            return;
        }
        
        if (existingUsers.users.length === 0) {
            console.log('  ✅ No existing users to clear');
            return;
        }
        
        console.log(`  🗑️  Removing ${existingUsers.users.length} existing user(s)...`);
        
        // Delete users (this will cascade to profiles and user-info)
        for (const user of existingUsers.users) {
            try {
                const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
                if (deleteError) {
                    console.log(`    ⚠️  Warning: Could not delete user ${user.email}: ${deleteError.message}`);
                } else {
                    console.log(`    ✅ Deleted user: ${user.email}`);
                }
            } catch (error) {
                console.log(`    ⚠️  Warning: Error deleting user ${user.email}: ${error.message}`);
            }
        }
        
        // Small delay to allow cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('  ✅ Data clearing completed');
        
    } catch (error) {
        console.log('  ⚠️  Warning: Data clearing had issues:', error.message);
    }
}

async function createSeedUser(userData) {
    console.log(`\\n  🔧 Creating user: ${userData.email}`);
    
    try {
        // Create user in auth.users
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: userData.email,
            password: userData.password,
            email_confirm: true,
            user_metadata: {
                full_name: `${userData.firstName} ${userData.lastName}`,
                username: userData.username
            }
        });
        
        if (authError) {
            if (authError.message.includes('already registered')) {
                console.log(`    ⚠️  User already exists: ${userData.email}`);
                return await updateExistingUser(userData);
            } else {
                throw authError;
            }
        }
        
        const userId = authData.user.id;
        console.log(`    ✅ Auth user created with ID: ${userId}`);
        
        // Create profile record
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: userId,
                role: userData.role
            });
        
        if (profileError) {
            console.log(`    ⚠️  Profile creation warning: ${profileError.message}`);
        } else {
            console.log(`    ✅ Profile created with role: ${userData.role}`);
        }
        
        // Create user-info record
        const { error: userInfoError } = await supabase
            .from('user-info')
            .insert({
                id: userId,
                full_name: `${userData.firstName} ${userData.lastName}`,
                bio: userData.bio,
                avatar_url: userData.avatar_url,
                website: userData.website,
                location: userData.location
            });
        
        if (userInfoError) {
            console.log(`    ⚠️  User info creation warning: ${userInfoError.message}`);
        } else {
            console.log(`    ✅ User info created`);
        }
        
        return { success: true, userId, email: userData.email, role: userData.role };
        
    } catch (error) {
        console.log(`    ❌ Failed to create ${userData.email}: ${error.message}`);
        return { success: false, email: userData.email, error: error.message };
    }
}

async function updateExistingUser(userData) {
    try {
        // Get existing user
        const { data: existingUsers, error: getUserError } = await supabase.auth.admin.listUsers();
        if (getUserError) throw getUserError;
        
        const existingUser = existingUsers.users.find(u => u.email === userData.email);
        if (!existingUser) {
            throw new Error('User not found after creation attempt');
        }
        
        const userId = existingUser.id;
        console.log(`    🔄 Updating existing user: ${userId}`);
        
        // Update or create profile
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: userId,
                role: userData.role,
                updated_at: new Date().toISOString()
            });
        
        if (profileError) {
            console.log(`    ⚠️  Profile update warning: ${profileError.message}`);
        } else {
            console.log(`    ✅ Profile updated with role: ${userData.role}`);
        }
        
        // Update or create user-info
        const { error: userInfoError } = await supabase
            .from('user-info')
            .upsert({
                id: userId,
                full_name: `${userData.firstName} ${userData.lastName}`,
                bio: userData.bio,
                avatar_url: userData.avatar_url,
                website: userData.website,
                location: userData.location,
                updated_at: new Date().toISOString()
            });
        
        if (userInfoError) {
            console.log(`    ⚠️  User info update warning: ${userInfoError.message}`);
        } else {
            console.log(`    ✅ User info updated`);
        }
        
        return { success: true, userId, email: userData.email, role: userData.role, updated: true };
        
    } catch (error) {
        console.log(`    ❌ Failed to update ${userData.email}: ${error.message}`);
        return { success: false, email: userData.email, error: error.message };
    }
}

async function seedUsers() {
    console.log('👥 SEEDING USERS...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    let usersToSeed = seedUsers;
    
    // Filter users based on command line options
    if (adminOnly) {
        usersToSeed = seedUsers.filter(user => user.role === 'admin');
        console.log('  📋 Mode: Admin users only');
    } else if (usersOnly) {
        usersToSeed = seedUsers.filter(user => user.role === 'user');
        console.log('  📋 Mode: Regular users only');
    } else {
        console.log('  📋 Mode: All users');
    }
    
    console.log(`  📊 Creating ${usersToSeed.length} user(s)...`);
    
    const results = [];
    
    for (const userData of usersToSeed) {
        const result = await createSeedUser(userData);
        results.push(result);
        
        // Small delay between user creations
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
}

async function verifySeededData() {
    console.log('\\n🔍 VERIFYING SEEDED DATA...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    try {
        // Check users
        const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
        if (usersError) throw usersError;
        
        console.log(`  👥 Auth users: ${users.users.length}`);
        
        // Check profiles
        const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*');
        
        if (profilesError) {
            console.log(`  ⚠️  Profiles check warning: ${profilesError.message}`);
        } else {
            console.log(`  📋 Profiles: ${profiles.length}`);
            
            const adminCount = profiles.filter(p => p.role === 'admin').length;
            const userCount = profiles.filter(p => p.role === 'user').length;
            console.log(`    • Admin users: ${adminCount}`);
            console.log(`    • Regular users: ${userCount}`);
        }
        
        // Check user-info
        const { data: userInfo, error: userInfoError } = await supabase
            .from('user-info')
            .select('*');
        
        if (userInfoError) {
            console.log(`  ⚠️  User info check warning: ${userInfoError.message}`);
        } else {
            console.log(`  📝 User info records: ${userInfo.length}`);
        }
        
        // Test authentication with first user
        if (users.users.length > 0) {
            console.log('\\n  🧪 Testing authentication with seeded user...');
            const testUser = seedUsers.find(u => u.email === users.users[0].email);
            
            if (testUser) {
                const testClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY);
                
                const { data, error } = await testClient.auth.signInWithPassword({
                    email: testUser.email,
                    password: testUser.password
                });
                
                if (error) {
                    console.log(`    ⚠️  Authentication test failed: ${error.message}`);
                } else {
                    console.log(`    ✅ Authentication test successful for: ${data.user.email}`);
                    await testClient.auth.signOut();
                }
            }
        }
        
        return true;
        
    } catch (error) {
        console.log(`  ❌ Verification failed: ${error.message}`);
        return false;
    }
}

// Main execution
async function main() {
    console.log('🌱 DATABASE SEEDING SCRIPT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const modeDesc = adminOnly ? 'ADMIN ONLY' : usersOnly ? 'USERS ONLY' : 'ALL USERS';
    console.log(`Mode: ${modeDesc}${clearFirst ? ' (CLEAR FIRST)' : ''}`);
    
    const startTime = Date.now();
    
    try {
        // Test database connectivity
        console.log('🔗 Testing database connectivity...');
        const { error: connectError } = await supabase
            .from('profiles')
            .select('count', { count: 'exact' })
            .limit(0);
        
        if (connectError && !connectError.message.includes('does not exist')) {
            throw new Error(`Database connectivity failed: ${connectError.message}`);
        }
        console.log('  ✅ Database connectivity OK');
        
        // Clear existing data if requested
        if (clearFirst) {
            await clearExistingData();
        }
        
        // Seed users
        const results = await seedUsers();
        
        // Verify seeded data
        const verificationOk = await verifySeededData();
        
        // Summary
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log('\\n📊 SEEDING SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const updated = results.filter(r => r.updated).length;
        
        console.log(`⏱️  Completed in ${duration} seconds`);
        console.log(`✅ Successfully created: ${successful} users`);
        if (updated > 0) console.log(`🔄 Updated existing: ${updated} users`);
        if (failed > 0) console.log(`❌ Failed: ${failed} users`);
        
        // Show created accounts
        if (successful > 0) {
            console.log('\\n👥 Created accounts:');
            for (const result of results.filter(r => r.success)) {
                console.log(`  • ${result.email} (${result.role})`);
            }
        }
        
        if (verificationOk && successful > 0) {
            console.log('\\n🎉 Database seeding completed successfully!');
            console.log('\\n📋 Next steps:');
            console.log('  • Test authentication: node scripts/11-test-authentication.js');
            console.log('  • Verify setup: node scripts/05-verify-setup.js');
            console.log('  • Access Supabase Studio: http://localhost:54323');
            process.exit(0);
        } else {
            console.log('\\n⚠️  Seeding completed with issues');
            process.exit(1);
        }
        
    } catch (error) {
        console.log('\\n❌ SEEDING FAILED:', error.message);
        console.log('\\n💡 Troubleshooting:');
        console.log('  • Ensure database tables exist: node scripts/06-check-database.js');
        console.log('  • Check Supabase is running: docker-compose ps');
        console.log('  • Reset environment: .\\scripts\\02-reset-and-seed.ps1');
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);
