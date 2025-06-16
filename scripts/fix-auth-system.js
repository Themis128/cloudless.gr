#!/usr/bin/env node

/**
 * Auth System Recovery and Testing Script
 * Helps diagnose and fix authentication system issues
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { config } from 'dotenv';

config();

class AuthSystemRecovery {
    constructor() {
        this.supabase = createClient(
            process.env.SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        this.issues = [];
        this.fixes = [];
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

    async testDatabaseConnection() {
        this.log('Testing database connection...', 'check');
        try {
            const { error } = await this.supabase.from('profiles').select('count').limit(1);
            if (error) {
                this.log(`Database connection failed: ${error.message}`, 'error');
                this.issues.push('Database connection failed');
                return false;
            }
            this.log('Database connection successful', 'success');
            return true;
        } catch (err) {
            this.log(`Database connection error: ${err.message}`, 'error');
            this.issues.push('Database connection error');
            return false;
        }
    }

    async testAuthTables() {
        this.log('Checking auth-related tables...', 'check');
        const tables = ['profiles', 'user-info'];
        let allTablesExist = true;

        for (const table of tables) {
            try {
                const { error } = await this.supabase.from(table).select('*').limit(1);
                if (error && error.code === 'PGRST116') {
                    this.log(`Table '${table}' does not exist`, 'error');
                    this.issues.push(`Missing table: ${table}`);
                    allTablesExist = false;
                } else if (error) {
                    this.log(`Table '${table}' has issues: ${error.message}`, 'warning');
                    this.issues.push(`Table ${table} has issues: ${error.message}`);
                } else {
                    this.log(`Table '${table}' exists and is accessible`, 'success');
                }
            } catch (err) {
                this.log(`Error checking table '${table}': ${err.message}`, 'error');
                this.issues.push(`Error checking table ${table}`);
                allTablesExist = false;
            }
        }

        return allTablesExist;
    }

    async checkUserRoles() {
        this.log('Checking user roles consistency...', 'check');
        try {
            const { data: users, error } = await this.supabase
                .from('profiles')
                .select('id, role');

            if (error) {
                this.log(`Failed to check user roles: ${error.message}`, 'error');
                this.issues.push('Cannot access user roles');
                return false;
            }

            const admins = users.filter(u => u.role === 'admin');
            const regularUsers = users.filter(u => u.role === 'user');
            const invalidRoles = users.filter(u => u.role !== 'admin' && u.role !== 'user');

            this.log(`Role Statistics:`, 'info');
            console.log(`   📊 Admins: ${admins.length}`);
            console.log(`   👥 Users: ${regularUsers.length}`);
            console.log(`   ❓ Invalid roles: ${invalidRoles.length}`);

            if (admins.length === 0) {
                this.log('WARNING: No admin users found!', 'warning');
                this.issues.push('No admin users found');
            }

            if (invalidRoles.length > 0) {
                this.log(`Users with invalid roles: ${invalidRoles.map(u => u.id).join(', ')}`, 'error');
                this.issues.push(`${invalidRoles.length} users with invalid roles`);
                return false;
            }

            this.log('User roles are consistent', 'success');
            return true;
        } catch (err) {
            this.log(`Error checking user roles: ${err.message}`, 'error');
            this.issues.push('Error checking user roles');
            return false;
        }
    }

    async fixInvalidRoles() {
        this.log('Fixing invalid user roles...', 'check');
        try {
            // Get all users with invalid or missing roles
            const { data: users, error } = await this.supabase
                .from('profiles')
                .select('id, role')
                .not('role', 'in', '(admin,user)');

            if (error) {
                this.log(`Failed to get users with invalid roles: ${error.message}`, 'error');
                return false;
            }

            if (users.length === 0) {
                this.log('All users have valid roles', 'success');
                return true;
            }

            this.log(`Found ${users.length} users with invalid roles, fixing...`, 'info');

            // Fix invalid roles by setting them to 'user'
            for (const user of users) {
                const { error: updateError } = await this.supabase
                    .from('profiles')
                    .update({ role: 'user' })
                    .eq('id', user.id);

                if (updateError) {
                    this.log(`Failed to fix role for user ${user.id}: ${updateError.message}`, 'error');
                } else {
                    this.log(`Fixed role for user ${user.id}`, 'success');
                    this.fixes.push(`Fixed role for user ${user.id}`);
                }
            }

            return true;
        } catch (err) {
            this.log(`Error fixing user roles: ${err.message}`, 'error');
            return false;
        }
    }

    async createDefaultAdminUser() {
        this.log('Checking for default admin user...', 'check');
        
        const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@cloudless.gr';
        const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD;

        if (!adminPassword) {
            this.log('DEFAULT_ADMIN_PASSWORD not set in environment variables', 'warning');
            return false;
        }

        try {
            // Check if admin user already exists
            const { data: existingAdmin } = await this.supabase
                .from('profiles')
                .select('id')
                .eq('role', 'admin')
                .limit(1);

            if (existingAdmin && existingAdmin.length > 0) {
                this.log('Admin user already exists', 'info');
                return true;
            }

            // Create admin user
            const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
                email: adminEmail,
                password: adminPassword,
                email_confirm: true
            });

            if (authError) {
                this.log(`Failed to create admin user: ${authError.message}`, 'error');
                return false;
            }

            // Set admin role
            const { error: profileError } = await this.supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    role: 'admin'
                });

            if (profileError) {
                this.log(`Failed to set admin role: ${profileError.message}`, 'error');
                return false;
            }

            this.log(`Created default admin user: ${adminEmail}`, 'success');
            this.fixes.push(`Created default admin user: ${adminEmail}`);
            return true;
        } catch (err) {
            this.log(`Error creating default admin user: ${err.message}`, 'error');
            return false;
        }
    }

    checkMiddlewareFiles() {
        this.log('Checking auth middleware files...', 'check');
        const middlewareFiles = [
            'middleware/auth.global.ts',
            'middleware/admin.ts',
            'middleware/auth.ts'
        ];

        let allFilesExist = true;

        for (const file of middlewareFiles) {
            if (fs.existsSync(file)) {
                this.log(`Found middleware file: ${file}`, 'success');
            } else {
                this.log(`Missing middleware file: ${file}`, 'error');
                this.issues.push(`Missing middleware file: ${file}`);
                allFilesExist = false;
            }
        }

        return allFilesExist;
    }

    checkComposables() {
        this.log('Checking auth composables...', 'check');
        const composableFiles = [
            'composables/useSupabaseAuth.ts',
            'composables/useSupabase.ts',
            'composables/useAuthGuard.ts'
        ];

        let allFilesExist = true;

        for (const file of composableFiles) {
            if (fs.existsSync(file)) {
                this.log(`Found composable file: ${file}`, 'success');
            } else {
                this.log(`Missing composable file: ${file}`, 'error');
                this.issues.push(`Missing composable file: ${file}`);
                allFilesExist = false;
            }
        }

        return allFilesExist;
    }

    async runDiagnostics() {
        this.log('🔐 Starting Auth System Diagnostics', 'info');
        console.log('==========================================');

        const results = {
            dbConnection: await this.testDatabaseConnection(),
            authTables: await this.testAuthTables(),
            userRoles: await this.checkUserRoles(),
            middlewareFiles: this.checkMiddlewareFiles(),
            composableFiles: this.checkComposables()
        };

        return results;
    }

    async runFixes() {
        this.log('🔧 Running Auth System Fixes', 'info');
        console.log('==============================');

        await this.fixInvalidRoles();
        await this.createDefaultAdminUser();
    }

    showSummary(results) {
        console.log('\n📊 Auth System Summary');
        console.log('======================');

        const status = (isOk) => isOk ? '✅ OK' : '❌ FAIL';
        
        console.log(`  Database Connection: ${status(results.dbConnection)}`);
        console.log(`  Auth Tables: ${status(results.authTables)}`);
        console.log(`  User Roles: ${status(results.userRoles)}`);
        console.log(`  Middleware Files: ${status(results.middlewareFiles)}`);
        console.log(`  Composable Files: ${status(results.composableFiles)}`);

        const overallHealth = Object.values(results).every(r => r);
        console.log(`\n🏥 System Health: ${overallHealth ? '✅ HEALTHY' : '❌ NEEDS ATTENTION'}`);

        if (this.issues.length > 0) {
            console.log('\n⚠️  Issues Found:');
            this.issues.forEach(issue => console.log(`   - ${issue}`));
        }

        if (this.fixes.length > 0) {
            console.log('\n🔧 Fixes Applied:');
            this.fixes.forEach(fix => console.log(`   - ${fix}`));
        }

        console.log('\n💡 If issues persist, check:');
        console.log('   1. Environment variables in .env file');
        console.log('   2. Supabase project configuration');
        console.log('   3. Database RLS policies');
        console.log('   4. User permissions and roles');
    }
}

// Main execution
async function main() {
    const recovery = new AuthSystemRecovery();
    
    const checkOnly = process.argv.includes('--check-only');
    
    try {
        const results = await recovery.runDiagnostics();
        
        if (!checkOnly) {
            await recovery.runFixes();
        }
        
        recovery.showSummary(results);
        
        console.log('\n✅ Auth system recovery completed!');
    } catch (err) {
        console.error('❌ Recovery process failed:', err.message);
        process.exit(1);
    }
}

// Check if this script is being run directly
const currentFileUrl = import.meta.url;
const isMainModule = process.argv[1] === new URL(currentFileUrl).pathname;

if (isMainModule) {
    main();
}

export { AuthSystemRecovery };
