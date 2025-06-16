// Setup database tables programmatically
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const adminSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDatabase() {
    console.log('🚀 Setting up database tables...');
    console.log('================================');
    
    try {
        // Create profiles table
        console.log('\n📋 Creating profiles table...');
        const { error: profilesError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS public.profiles (
                    id UUID REFERENCES auth.users(id) PRIMARY KEY,
                    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `
        });
        
        if (profilesError) {
            console.log('❌ Error creating profiles table:', profilesError.message);
        } else {
            console.log('✅ Profiles table created/verified');
        }
        
        // Create user-info table
        console.log('\n👤 Creating user-info table...');
        const { error: userInfoError } = await adminSupabase.rpc('exec_sql', {
            sql: `
                CREATE TABLE IF NOT EXISTS public."user-info" (
                    id UUID REFERENCES auth.users(id) PRIMARY KEY,
                    full_name TEXT,
                    avatar_url TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
            `
        });
        
        if (userInfoError) {
            console.log('❌ Error creating user-info table:', userInfoError.message);
        } else {
            console.log('✅ User-info table created/verified');
        }
        
        // Alternative approach: Create tables using direct SQL if rpc doesn't work
        console.log('\n🔧 Testing table creation with direct approach...');
        
        // Try to create profile for our user directly
        const email = 'baltzakis.themis@gmail.com';
        const { data: users } = await adminSupabase.auth.admin.listUsers();
        const user = users.users.find(u => u.email === email);
        
        if (user) {
            console.log('✅ Found user:', user.id);
            
            // Try to create records without RLS interference
            console.log('\n🔓 Creating user records...');
            
            // Use service role key to bypass RLS
            const { error: profileError } = await adminSupabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    role: 'user'
                }, {
                    onConflict: 'id'
                });
            
            const { error: userInfoError } = await adminSupabase
                .from('user-info')
                .upsert({
                    id: user.id,
                    full_name: 'Themistoklis Baltzakis'
                }, {
                    onConflict: 'id'
                });
            
            if (profileError) {
                console.log('⚠️ Profile creation info:', profileError.message);
            } else {
                console.log('✅ Profile record created');
            }
            
            if (userInfoError) {
                console.log('⚠️ User info creation info:', userInfoError.message);
            } else {
                console.log('✅ User info record created');
            }
        }
        
    } catch (err) {
        console.log('❌ Database setup error:', err.message);
    }
    
    // Final verification
    console.log('\n🔍 Final verification...');
    try {
        const { data: profilesData, error: profilesTestError } = await adminSupabase
            .from('profiles')
            .select('*')
            .limit(1);
        
        const { data: userInfoData, error: userInfoTestError } = await adminSupabase
            .from('user-info')
            .select('*')
            .limit(1);
        
        if (profilesTestError) {
            console.log('❌ Profiles table still not accessible:', profilesTestError.message);
        } else {
            console.log('✅ Profiles table working, records:', profilesData.length);
        }
        
        if (userInfoTestError) {
            console.log('❌ User-info table still not accessible:', userInfoTestError.message);
        } else {
            console.log('✅ User-info table working, records:', userInfoData.length);
        }
        
    } catch (err) {
        console.log('❌ Verification error:', err.message);
    }
}

// Also create a simple manual approach
async function manualSetup() {
    console.log('\n🔧 Manual user setup approach...');
    console.log('=================================');
    
    const email = 'baltzakis.themis@gmail.com';
    
    try {
        // Get the user
        const { data: users } = await adminSupabase.auth.admin.listUsers();
        const user = users.users.find(u => u.email === email);
        
        if (!user) {
            console.log('❌ User not found');
            return;
        }
        
        console.log('✅ User found:', user.id);
        
        // For now, let's just confirm the user can log in
        console.log('👤 User is ready to log in with:');
        console.log('   Email: baltzakis.themis@gmail.com');
        console.log('   Password: TH!123789th!');
        console.log('   Name: Themistoklis Baltzakis');
        console.log('   Role: user (default)');
        
        console.log('\n💡 Note: The user account exists and can log in.');
        console.log('   The profile and user-info tables may need to be created');
        console.log('   manually in the Supabase dashboard or using the SQL script.');
        
    } catch (err) {
        console.log('❌ Manual setup error:', err.message);
    }
}

// Run both approaches
async function main() {
    await setupDatabase();
    await manualSetup();
    
    console.log('\n🎯 Database setup completed!');
    console.log('\n📝 Next steps:');
    console.log('1. If tables are still missing, run the setup-database.sql script in Supabase SQL editor');
    console.log('2. Try logging in at /auth with the credentials');
    console.log('3. Check if user profile is created automatically');
}

main().catch(console.error);
