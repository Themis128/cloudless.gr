// Verify user setup
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const adminSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyUserSetup() {
    const email = 'baltzakis.themis@gmail.com';
    const fullName = 'Themistoklis Baltzakis';
    
    console.log('🔍 Verifying user setup for:', email);
    console.log('======================================');
    
    try {
        // Get user from auth
        const { data: users, error } = await adminSupabase.auth.admin.listUsers();
        if (error) {
            console.log('❌ Error getting users:', error.message);
            return;
        }
        
        const user = users.users.find(u => u.email === email);
        if (!user) {
            console.log('❌ User not found');
            return;
        }
        
        console.log('✅ User found:', user.id);
        
        // Check profiles table
        console.log('\n📋 Checking profiles table...');
        const { data: profile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (profileError) {
            console.log('❌ Profile not found, creating...');
            const { error: createError } = await adminSupabase
                .from('profiles')
                .insert({
                    id: user.id,
                    role: 'user'
                });
            
            if (createError) {
                console.log('❌ Failed to create profile:', createError.message);
            } else {
                console.log('✅ Profile created successfully');
            }
        } else {
            console.log('✅ Profile found, role:', profile.role);
        }
        
        // Check user-info table
        console.log('\n👤 Checking user-info table...');
        const { data: userInfo, error: userInfoError } = await adminSupabase
            .from('user-info')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (userInfoError) {
            console.log('❌ User info not found, creating...');
            const { error: createError } = await adminSupabase
                .from('user-info')
                .insert({
                    id: user.id,
                    full_name: fullName,
                    avatar_url: null
                });
            
            if (createError) {
                console.log('❌ Failed to create user info:', createError.message);
            } else {
                console.log('✅ User info created successfully');
            }
        } else {
            console.log('✅ User info found:', userInfo.full_name);
        }
        
        // Final verification
        console.log('\n🎯 Final verification...');
        const { data: finalProfile } = await adminSupabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        const { data: finalUserInfo } = await adminSupabase
            .from('user-info')
            .select('full_name')
            .eq('id', user.id)
            .single();
        
        console.log('✅ Setup complete!');
        console.log('   Email:', user.email);
        console.log('   Role:', finalProfile?.role || 'Unknown');
        console.log('   Full Name:', finalUserInfo?.full_name || 'Unknown');
        console.log('   Ready to login: ✅');
        
    } catch (err) {
        console.log('❌ Error:', err.message);
    }
}

verifyUserSetup().catch(console.error);
