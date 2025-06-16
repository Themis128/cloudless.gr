#!/usr/bin/env node
// JWT Secrets and Keys Generation Script
// Generates secure secrets for JWT tokens, API keys, and other cryptographic needs
//
// Features:
//   • JWT secret generation
//   • API key generation
//   • Database password generation
//   • Encryption key generation
//   • Secure random string generation
//   • Environment file integration
//
// Usage Examples:
//   node scripts/16-generate-secrets.js                    # Generate all secrets
//   node scripts/16-generate-secrets.js --jwt-only        # JWT secrets only
//   node scripts/16-generate-secrets.js --update-env      # Update .env file
//   node scripts/16-generate-secrets.js --length 32       # Custom length

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const jwtOnly = args.includes('--jwt-only');
const updateEnv = args.includes('--update-env');
const customLength = args.find(arg => arg.startsWith('--length'))?.split('=')[1] || 
                    parseInt(args[args.indexOf('--length') + 1]) || null;

function generateSecureSecret(bytes = 64) {
    return crypto.randomBytes(bytes).toString('hex');
}

function generateJWTSecret(bytes = 64) {
    return crypto.randomBytes(bytes).toString('hex');
}

function generateApiKey(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

function generatePassword(length = 32) {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, charset.length);
        password += charset[randomIndex];
    }
    
    return password;
}

function generateUUID() {
    return crypto.randomUUID();
}

function generateAllSecrets() {
    console.log('🔐 GENERATING SECURE SECRETS AND KEYS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const secrets = {};
    
    if (jwtOnly) {
        console.log('\\n🎫 JWT SECRETS (JWT Only Mode):');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        secrets.JWT_SECRET = generateJWTSecret(customLength || 64);
        secrets.JWT_REFRESH_SECRET = generateJWTSecret(customLength || 64);
        
        console.log(`JWT_SECRET=${secrets.JWT_SECRET}`);
        console.log(`JWT_REFRESH_SECRET=${secrets.JWT_REFRESH_SECRET}`);
        
    } else {
        console.log('\\n🎫 JWT AND AUTHENTICATION SECRETS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        secrets.JWT_SECRET = generateJWTSecret(customLength || 64);
        secrets.JWT_REFRESH_SECRET = generateJWTSecret(customLength || 64);
        secrets.SESSION_SECRET = generateSecureSecret(32);
        
        console.log(`JWT_SECRET=${secrets.JWT_SECRET}`);
        console.log(`JWT_REFRESH_SECRET=${secrets.JWT_REFRESH_SECRET}`);
        console.log(`SESSION_SECRET=${secrets.SESSION_SECRET}`);
        
        console.log('\\n🔑 API AND SERVICE KEYS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        secrets.API_SECRET_KEY = generateApiKey(32);
        secrets.SERVICE_ROLE_SECRET = generateSecureSecret(64);
        secrets.WEBHOOK_SECRET = generateSecureSecret(32);
        
        console.log(`API_SECRET_KEY=${secrets.API_SECRET_KEY}`);
        console.log(`SERVICE_ROLE_SECRET=${secrets.SERVICE_ROLE_SECRET}`);
        console.log(`WEBHOOK_SECRET=${secrets.WEBHOOK_SECRET}`);
        
        console.log('\\n🗄️  DATABASE SECRETS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        secrets.DB_PASSWORD = generatePassword(32);
        secrets.POSTGRES_PASSWORD = generatePassword(32);
        secrets.DB_ENCRYPTION_KEY = generateSecureSecret(32);
        
        console.log(`DB_PASSWORD=${secrets.DB_PASSWORD}`);
        console.log(`POSTGRES_PASSWORD=${secrets.POSTGRES_PASSWORD}`);
        console.log(`DB_ENCRYPTION_KEY=${secrets.DB_ENCRYPTION_KEY}`);
        
        console.log('\\n🔒 ENCRYPTION AND SECURITY:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        secrets.ENCRYPTION_KEY = generateSecureSecret(32);
        secrets.SALT_ROUNDS = '12';
        secrets.APP_SECRET = generateSecureSecret(32);
        
        console.log(`ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}`);
        console.log(`SALT_ROUNDS=${secrets.SALT_ROUNDS}`);
        console.log(`APP_SECRET=${secrets.APP_SECRET}`);
        
        console.log('\\n🆔 UNIQUE IDENTIFIERS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        secrets.APP_ID = generateUUID();
        secrets.INSTANCE_ID = generateUUID();
        
        console.log(`APP_ID=${secrets.APP_ID}`);
        console.log(`INSTANCE_ID=${secrets.INSTANCE_ID}`);
    }
    
    return secrets;
}

function updateEnvironmentFile(secrets) {
    console.log('\\n📝 UPDATING ENVIRONMENT FILE...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const envPath = path.join('docker', '.env');
    const envExamplePath = path.join('docker', '.env.example');
    
    try {
        let envContent = '';
        let updated = 0;
        let added = 0;
        
        // Read existing .env file if it exists
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
            console.log(`  📄 Reading existing .env file...`);
        } else {
            console.log(`  📄 Creating new .env file...`);
            envContent = `# Environment Configuration\\n# Generated on ${new Date().toISOString()}\\n\\n`;
        }
        
        // Update or add each secret
        for (const [key, value] of Object.entries(secrets)) {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            
            if (regex.test(envContent)) {
                // Update existing
                envContent = envContent.replace(regex, `${key}=${value}`);
                console.log(`    🔄 Updated: ${key}`);
                updated++;
            } else {
                // Add new
                envContent += `\\n${key}=${value}`;
                console.log(`    ➕ Added: ${key}`);
                added++;
            }
        }
        
        // Write updated content
        fs.writeFileSync(envPath, envContent);
        console.log(`  ✅ Environment file updated successfully`);
        console.log(`    📊 Updated: ${updated} variables`);
        console.log(`    📊 Added: ${added} variables`);
        
        // Update .env.example if it exists
        if (fs.existsSync(envExamplePath)) {
            let exampleContent = fs.readFileSync(envExamplePath, 'utf8');
            
            for (const key of Object.keys(secrets)) {
                const regex = new RegExp(`^${key}=.*$`, 'm');
                const exampleValue = `your-${key.toLowerCase().replace(/_/g, '-')}-here`;
                
                if (!regex.test(exampleContent)) {
                    exampleContent += `\\n${key}=${exampleValue}`;
                }
            }
            
            fs.writeFileSync(envExamplePath, exampleContent);
            console.log(`  ✅ .env.example file updated`);
        }
        
        return true;
        
    } catch (error) {
        console.log(`  ❌ Error updating environment file: ${error.message}`);
        return false;
    }
}

function showSecurityGuidelines() {
    console.log('\\n🛡️  SECURITY GUIDELINES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\\n📋 Important Security Notes:');
    console.log('  • NEVER commit .env files to version control');
    console.log('  • Store secrets in a secure password manager');
    console.log('  • Rotate secrets regularly in production');
    console.log('  • Use different secrets for each environment');
    console.log('  • Ensure .env files have restricted permissions (600)');
    
    console.log('\\n🔄 Secret Rotation Schedule:');
    console.log('  • JWT secrets: Every 90 days');
    console.log('  • API keys: Every 180 days');
    console.log('  • Database passwords: Every 365 days');
    console.log('  • Encryption keys: Every 365 days');
    
    console.log('\\n📂 File Security:');
    console.log('  • .env files should be in .gitignore');
    console.log('  • Use .env.example for documentation');
    console.log('  • Set proper file permissions (chmod 600 .env)');
    
    if (process.platform !== 'win32') {
        console.log('\\n🔧 Setting secure file permissions...');
        try {
            fs.chmodSync(path.join('docker', '.env'), 0o600);
            console.log('  ✅ File permissions set to 600');
        } catch (error) {
            console.log('  ⚠️  Could not set file permissions:', error.message);
        }
    }
}

function generateCustomSecret() {
    const length = customLength || 32;
    const secret = generateSecureSecret(length);
    
    console.log('🔐 CUSTOM SECRET GENERATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`\\nGenerated ${length * 2}-character secret (${length} bytes):`);
    console.log(secret);
    console.log('\\nUsage examples:');
    console.log(`MY_SECRET=${secret}`);
    console.log(`export MY_SECRET="${secret}"`);
    
    return secret;
}

// Main execution
async function main() {
    console.log('🔑 JWT SECRETS AND KEYS GENERATOR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const startTime = Date.now();
    
    try {
        let secrets;
        
        if (customLength && !jwtOnly && !updateEnv) {
            // Custom secret generation mode
            generateCustomSecret();
            return;
        }
        
        // Generate secrets
        secrets = generateAllSecrets();
        
        // Update environment file if requested
        if (updateEnv) {
            const updateSuccess = updateEnvironmentFile(secrets);
            if (!updateSuccess) {
                console.log('\\n⚠️  Environment file update failed, but secrets were generated');
            }
        }
        
        // Show security guidelines
        showSecurityGuidelines();
        
        const endTime = Date.now();
        const duration = Math.round((endTime - startTime) / 1000);
        
        console.log('\\n📊 GENERATION SUMMARY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⏱️  Completed in ${duration} seconds`);
        console.log(`🔑 Generated ${Object.keys(secrets).length} secret(s)`);
        
        if (updateEnv) {
            console.log('✅ Environment file updated');
        } else {
            console.log('\\n💡 To update your .env file automatically, run:');
            console.log('   node scripts/16-generate-secrets.js --update-env');
        }
        
        console.log('\\n📋 Next steps:');
        console.log('  • Copy secrets to your .env file (if not using --update-env)');
        console.log('  • Restart your development environment');
        console.log('  • Test with: .\\scripts\\05-verify-setup.js');
        
    } catch (error) {
        console.log('\\n❌ SECRET GENERATION FAILED:', error.message);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);

export { generateJWTSecret, generateSecureSecret, generateApiKey, generatePassword };
