#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Fix Authentication System Issues
.DESCRIPTION
    This script helps recover from authentication system issues by checking and fixing
    common problems with user authentication, role assignments, and database consistency.
.PARAMETER CheckOnly
    Only perform checks without making changes
.PARAMETER Force
    Force fixes without confirmation prompts
#>

param(
    [switch]$CheckOnly,
    [switch]$Force
)

Write-Host "🔐 Auth System Recovery Script" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Error "This script must be run from the project root directory"
    exit 1
}

# Load environment variables
if (Test-Path ".env") {
    Write-Host "📁 Loading environment variables..." -ForegroundColor Yellow
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
} else {
    Write-Warning ".env file not found. Some operations may fail."
}

function Test-DatabaseConnection {
    Write-Host "🔌 Testing database connection..." -ForegroundColor Yellow
    
    try {
        # Test basic connectivity
        node -e "
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(
                process.env.SUPABASE_URL || '',
                process.env.SUPABASE_ANON_KEY || ''
            );
            supabase.from('profiles').select('count').then(result => {
                if (result.error) {
                    console.log('❌ Database connection failed:', result.error.message);
                    process.exit(1);
                } else {
                    console.log('✅ Database connection successful');
                }
            });
        "
        return $true
    } catch {
        Write-Error "❌ Database connection failed: $_"
        return $false
    }
}

function Test-AuthTables {
    Write-Host "📋 Checking auth-related tables..." -ForegroundColor Yellow
    
    $tables = @("profiles", "user-info")
    $missingTables = @()
    
    foreach ($table in $tables) {
        try {
            node -e "
                const { createClient } = require('@supabase/supabase-js');
                const supabase = createClient(
                    process.env.SUPABASE_URL || '',
                    process.env.SUPABASE_ANON_KEY || ''
                );
                supabase.from('$table').select('*').limit(1).then(result => {
                    if (result.error && result.error.code === 'PGRST116') {
                        console.log('❌ Table $table does not exist');
                        process.exit(1);
                    } else {
                        console.log('✅ Table $table exists');
                    }
                });
            "
        } catch {
            $missingTables += $table
            Write-Warning "❌ Table '$table' is missing or inaccessible"
        }
    }
    
    return $missingTables.Count -eq 0
}

function Test-UserRoles {
    Write-Host "👤 Checking user roles consistency..." -ForegroundColor Yellow
    
    try {
        node -e "
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(
                process.env.SUPABASE_URL || '',
                process.env.SUPABASE_SERVICE_ROLE_KEY || ''
            );
            
            supabase.from('profiles').select('id, role').then(result => {
                if (result.error) {
                    console.log('❌ Failed to check user roles:', result.error.message);
                    process.exit(1);
                }
                
                const users = result.data || [];
                const admins = users.filter(u => u.role === 'admin');
                const regularUsers = users.filter(u => u.role === 'user');
                const invalidRoles = users.filter(u => u.role !== 'admin' && u.role !== 'user');
                
                console.log(\`📊 Role Statistics:\`);
                console.log(\`   Admins: \${admins.length}\`);
                console.log(\`   Users: \${regularUsers.length}\`);
                console.log(\`   Invalid roles: \${invalidRoles.length}\`);
                
                if (admins.length === 0) {
                    console.log('⚠️  WARNING: No admin users found!');
                }
                
                if (invalidRoles.length > 0) {
                    console.log('❌ Users with invalid roles found:', invalidRoles.map(u => u.id));
                }
            });
        "
    } catch {
        Write-Error "❌ Failed to check user roles: $_"
        return $false
    }
    
    return $true
}

function Fix-UserRoles {
    if ($CheckOnly) {
        Write-Host "🔍 Check-only mode: Skipping role fixes" -ForegroundColor Yellow
        return
    }
    
    Write-Host "🔧 Fixing user roles..." -ForegroundColor Yellow
    
    if (-not $Force) {
        $confirm = Read-Host "Do you want to fix invalid user roles? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Write-Host "Skipping role fixes" -ForegroundColor Yellow
            return
        }
    }
    
    try {
        node -e "
            const { createClient } = require('@supabase/supabase-js');
            const supabase = createClient(
                process.env.SUPABASE_URL || '',
                process.env.SUPABASE_SERVICE_ROLE_KEY || ''
            );
            
            async function fixRoles() {
                // Get all users with invalid or missing roles
                const { data: users, error } = await supabase
                    .from('profiles')
                    .select('id, role')
                    .not('role', 'in', '(admin,user)');
                
                if (error) {
                    console.log('❌ Failed to get users:', error.message);
                    return;
                }
                
                if (users.length === 0) {
                    console.log('✅ All users have valid roles');
                    return;
                }
                
                // Fix invalid roles by setting them to 'user'
                for (const user of users) {
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({ role: 'user' })
                        .eq('id', user.id);
                    
                    if (updateError) {
                        console.log(\`❌ Failed to fix role for user \${user.id}:\`, updateError.message);
                    } else {
                        console.log(\`✅ Fixed role for user \${user.id}\`);
                    }
                }
            }
            
            fixRoles();
        "
    } catch {
        Write-Error "❌ Failed to fix user roles: $_"
    }
}

function Test-AuthMiddleware {
    Write-Host "🔒 Checking auth middleware files..." -ForegroundColor Yellow
    
    $middlewareFiles = @(
        "middleware/auth.global.ts",
        "middleware/admin.ts", 
        "middleware/auth.ts"
    )
    
    $issues = @()
    
    foreach ($file in $middlewareFiles) {
        if (-not (Test-Path $file)) {
            $issues += "Missing file: $file"
            Write-Warning "❌ Missing middleware file: $file"
        } else {
            Write-Host "✅ Found middleware file: $file" -ForegroundColor Green
        }
    }
    
    return $issues.Count -eq 0
}

function Show-AuthSystemSummary {
    Write-Host "`n📊 Auth System Summary" -ForegroundColor Cyan
    Write-Host "======================" -ForegroundColor Cyan
    
    $dbConnection = Test-DatabaseConnection
    $authTables = Test-AuthTables
    $userRoles = Test-UserRoles
    $authMiddleware = Test-AuthMiddleware
    
    Write-Host "`n🎯 Overall Status:" -ForegroundColor White
    Write-Host "  Database Connection: $(if($dbConnection) {'✅ OK'} else {'❌ FAIL'})" -ForegroundColor $(if($dbConnection) {'Green'} else {'Red'})
    Write-Host "  Auth Tables: $(if($authTables) {'✅ OK'} else {'❌ FAIL'})" -ForegroundColor $(if($authTables) {'Green'} else {'Red'})
    Write-Host "  User Roles: $(if($userRoles) {'✅ OK'} else {'❌ FAIL'})" -ForegroundColor $(if($userRoles) {'Green'} else {'Red'})
    Write-Host "  Auth Middleware: $(if($authMiddleware) {'✅ OK'} else {'❌ FAIL'})" -ForegroundColor $(if($authMiddleware) {'Green'} else {'Red'})
    
    $overallHealth = $dbConnection -and $authTables -and $userRoles -and $authMiddleware
    Write-Host "`n🏥 System Health: $(if($overallHealth) {'✅ HEALTHY'} else {'❌ NEEDS ATTENTION'})" -ForegroundColor $(if($overallHealth) {'Green'} else {'Red'})
}

# Main execution
Write-Host "🚀 Starting auth system diagnostics..." -ForegroundColor Green

# Run diagnostics
Show-AuthSystemSummary

# Run fixes if not in check-only mode
if (-not $CheckOnly) {
    Write-Host "`n🔧 Running fixes..." -ForegroundColor Yellow
    Fix-UserRoles
}

Write-Host "`n✅ Auth system recovery completed!" -ForegroundColor Green
Write-Host "💡 If issues persist, check the following:" -ForegroundColor Yellow
Write-Host "   1. Environment variables in .env file" -ForegroundColor White
Write-Host "   2. Supabase project configuration" -ForegroundColor White
Write-Host "   3. Database RLS policies" -ForegroundColor White
Write-Host "   4. User permissions and roles" -ForegroundColor White
