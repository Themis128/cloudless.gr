#!/usr/bin/env node

/**
 * User Account Troubleshooter
 * Checks specific user account issues and helps resolve them
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

class UserAccountTroubleshooter {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
    }

    log(message, type = 'info') {
        const symbols = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            check: '🔍'
        };
        console.log(`${symbols[type]} ${message}`);
    }

    async checkUserAccount(email) {
        this.log(`Checking account for: ${email}`, 'check');
        
        try {
            // Check if user exists in auth.users
            const { data: authUsers, error: authError } = await this.supabase.auth.admin.listUsers();
            
            if (authError) {
                this.log(`Failed to list users: ${authError.message}`, 'error');
                return false;
            }

            const authUser = authUsers.users.find(u => u.email === email);
            
            if (!authUser) {
                this.log(`User not found in auth.users table`, 'error');
                return false;
            }

            this.log(`User found in auth.users:`, 'success');
            console.log(`   ID: ${authUser.id}`);
            console.log(`   Email: ${authUser.email}`);
            console.log(`   Email Confirmed: ${authUser.email_confirmed_at ? 'Yes' : 'No'}`);
            console.log(`   Created: ${authUser.created_at}`);
            console.log(`   Last Sign In: ${authUser.last_sign_in_at || 'Never'}`);

            // Check profile
            const { data: profile, error: profileError } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (profileError || !profile) {
                this.log(`Profile not found or error: ${profileError?.message}`, 'warning');
                this.log(`Creating profile for user...`, 'info');
                await this.createProfile(authUser.id, 'user');
            } else {
                this.log(`Profile found:`, 'success');
                console.log(`   Role: ${profile.role}`);
                console.log(`   Created: ${profile.created_at}`);
            }

            // Check user-info
            const { data: userInfo, error: userInfoError } = await this.supabase
                .from('user-info')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (userInfoError || !userInfo) {
                this.log(`User info not found: ${userInfoError?.message}`, 'warning');
            } else {
                this.log(`User info found:`, 'success');
                console.log(`   Full Name: ${userInfo.full_name}`);
                console.log(`   Avatar URL: ${userInfo.avatar_url || 'None'}`);
            }

            return true;

        } catch (error) {
            this.log(`Error checking user account: ${error.message}`, 'error');
            return false;
        }
    }

    async createProfile(userId, role = 'user') {
        try {
            const { error } = await this.supabase
                .from('profiles')
                .insert({
                    id: userId,
                    role: role
                });

            if (error) {
                this.log(`Failed to create profile: ${error.message}`, 'error');
                return false;
            }

            this.log(`Profile created successfully with role: ${role}`, 'success');
            return true;
        } catch (error) {
            this.log(`Error creating profile: ${error.message}`, 'error');
            return false;
        }
    }

    async createUserInfo(userId, fullName, avatarUrl = null) {
        try {
            const { error } = await this.supabase
                .from('user-info')
                .insert({
                    id: userId,
                    full_name: fullName,
                    avatar_url: avatarUrl
                });

            if (error) {
                this.log(`Failed to create user info: ${error.message}`, 'error');
                return false;
            }

            this.log(`User info created successfully`, 'success');
            return true;
        } catch (error) {
            this.log(`Error creating user info: ${error.message}`, 'error');
            return false;
        }
    }

    async resetUserPassword(email, newPassword) {
        try {
            const { data, error } = await this.supabase.auth.admin.updateUserById(
                email,
                { password: newPassword }
            );

            if (error) {
                this.log(`Failed to reset password: ${error.message}`, 'error');
                return false;
            }

            this.log(`Password reset successfully`, 'success');
            return true;
        } catch (error) {
            this.log(`Error resetting password: ${error.message}`, 'error');
            return false;
        }
    }

    async testLogin(email, password) {
        this.log(`Testing login for: ${email}`, 'check');
        
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                this.log(`Login failed: ${error.message}`, 'error');
                return false;
            }

            if (data.user) {
                this.log(`Login successful!`, 'success');
                console.log(`   User ID: ${data.user.id}`);
                console.log(`   Email: ${data.user.email}`);
                
                // Sign out after test
                await this.supabase.auth.signOut();
                return true;
            }

            return false;
        } catch (error) {
            this.log(`Error testing login: ${error.message}`, 'error');
            return false;
        }
    }

    async createMissingUser(email, password, fullName) {
        this.log(`Creating new user account...`, 'info');
        
        try {
            // Create user in auth
            const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true
            });

            if (authError) {
                this.log(`Failed to create user: ${authError.message}`, 'error');
                return false;
            }

            this.log(`User created in auth.users`, 'success');

            // Create profile
            await this.createProfile(authData.user.id, 'user');

            // Create user info
            await this.createUserInfo(authData.user.id, fullName);

            this.log(`User account fully set up!`, 'success');
            return true;

        } catch (error) {
            this.log(`Error creating user: ${error.message}`, 'error');
            return false;
        }
    }

    async fixUserAccount(email, password, fullName) {
        this.log(`🔧 Starting user account fix process...`, 'info');
        
        // First check if user exists
        const userExists = await this.checkUserAccount(email);
        
        if (!userExists) {
            this.log(`User doesn't exist, creating new account...`, 'info');
            return await this.createMissingUser(email, password, fullName);
        }

        // Test login
        const loginWorks = await this.testLogin(email, password);
        
        if (loginWorks) {
            this.log(`Login is working! The issue might be elsewhere.`, 'success');
            return true;
        }

        this.log(`Login failed, investigating further...`, 'warning');
        
        // Get user ID for additional fixes
        const { data: authUsers } = await this.supabase.auth.admin.listUsers();
        const authUser = authUsers.users.find(u => u.email === email);
        
        if (authUser) {
            // Check if email is confirmed
            if (!authUser.email_confirmed_at) {
                this.log(`Email not confirmed, confirming now...`, 'info');
                const { error: confirmError } = await this.supabase.auth.admin.updateUserById(
                    authUser.id,
                    { email_confirm: true }
                );
                
                if (confirmError) {
                    this.log(`Failed to confirm email: ${confirmError.message}`, 'error');
                } else {
                    this.log(`Email confirmed successfully`, 'success');
                }
            }

            // Ensure profile exists
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (!profile) {
                await this.createProfile(authUser.id, 'user');
            }

            // Ensure user-info exists
            const { data: userInfo } = await this.supabase
                .from('user-info')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (!userInfo) {
                await this.createUserInfo(authUser.id, fullName);
            }

            // Test login again
            return await this.testLogin(email, password);
        }

        return false;
    }
}

// Main execution
async function main() {
    const troubleshooter = new UserAccountTroubleshooter();
    
    const email = process.argv[2];
    const password = process.argv[3]; 
    const fullName = process.argv[4];
    
    if (!email) {
        console.log('Usage: node user-troubleshooter.js <email> [password] [fullName]');
        console.log('Example: node user-troubleshooter.js user@example.com mypassword "John Doe"');
        process.exit(1);
    }
    
    try {
        console.log('👤 User Account Troubleshooter');
        console.log('==============================');
        
        if (password && fullName) {
            // Full fix mode
            const success = await troubleshooter.fixUserAccount(email, password, fullName);
            if (success) {
                console.log('\n✅ User account has been fixed and is ready to use!');
            } else {
                console.log('\n❌ Failed to fix user account. Check the logs above for details.');
            }
        } else {
            // Check mode only
            await troubleshooter.checkUserAccount(email);
        }
        
    } catch (err) {
        console.error('❌ Troubleshooter failed:', err.message);
        process.exit(1);
    }
}

// Check if this script is being run directly
const currentFileUrl = import.meta.url;
const isMainModule = process.argv[1] === new URL(currentFileUrl).pathname;

if (isMainModule) {
    main();
}

export { UserAccountTroubleshooter };
