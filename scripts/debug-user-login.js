// Simple user login test
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const adminSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUserLogin() {
    const email = 'baltzakis.themis@gmail.com';
    const password = 'TH!123789th!';
    const fullName = 'Themistoklis Baltzakis';
    
    console.log('🔍 Testing user login for:', email);
    console.log('=====================================');
    
    // Step 1: Check if user exists in auth
    console.log('\n1️⃣ Checking if user exists in auth...');
    try {
        const { data: users, error } = await adminSupabase.auth.admin.listUsers();
        if (error) {
            console.log('❌ Error listing users:', error.message);
            return;
        }
        
        const user = users.users.find(u => u.email === email);
        if (!user) {
            console.log('❌ User not found in auth.users');
            console.log('🔧 Creating user...');
            
            const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
                email: email,
                password: password,
                email_confirm: true
            });
            
            if (createError) {
                console.log('❌ Failed to create user:', createError.message);
                return;
            }
            
            console.log('✅ User created successfully');
            
            // Create profile
            const { error: profileError } = await adminSupabase
                .from('profiles')
                .insert({
                    id: newUser.user.id,
                    role: 'user'
                });
            
            if (profileError) {
                console.log('⚠️ Profile creation warning:', profileError.message);
            } else {
                console.log('✅ Profile created');
            }
            
            // Create user-info
            const { error: userInfoError } = await adminSupabase
                .from('user-info')
                .insert({
                    id: newUser.user.id,
                    full_name: fullName
                });
            
            if (userInfoError) {
                console.log('⚠️ User info creation warning:', userInfoError.message);
            } else {
                console.log('✅ User info created');
            }
            
        } else {
            console.log('✅ User found in auth.users');
            console.log('   ID:', user.id);
            console.log('   Email confirmed:', user.email_confirmed_at ? 'Yes' : 'No');
            console.log('   Last sign in:', user.last_sign_in_at || 'Never');
            
            // Check if email is confirmed
            if (!user.email_confirmed_at) {
                console.log('🔧 Confirming email...');
                const { error: confirmError } = await adminSupabase.auth.admin.updateUserById(
                    user.id,
                    { email_confirm: true }
                );
                
                if (confirmError) {
                    console.log('❌ Failed to confirm email:', confirmError.message);
                } else {
                    console.log('✅ Email confirmed');
                }
            }
            
            // Check profile
            const { data: profile, error: profileError } = await adminSupabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (profileError) {
                console.log('⚠️ No profile found, creating...');
                const { error: createProfileError } = await adminSupabase
                    .from('profiles')
                    .insert({
                        id: user.id,
                        role: 'user'
                    });
                
                if (createProfileError) {
                    console.log('❌ Failed to create profile:', createProfileError.message);
                } else {
                    console.log('✅ Profile created');
                }
            } else {
                console.log('✅ Profile found, role:', profile.role);
            }
            
            // Check user-info
            const { data: userInfo, error: userInfoError } = await adminSupabase
                .from('user-info')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (userInfoError) {
                console.log('⚠️ No user info found, creating...');
                const { error: createUserInfoError } = await adminSupabase
                    .from('user-info')
                    .insert({
                        id: user.id,
                        full_name: fullName
                    });
                
                if (createUserInfoError) {
                    console.log('❌ Failed to create user info:', createUserInfoError.message);
                } else {
                    console.log('✅ User info created');
                }
            } else {
                console.log('✅ User info found:', userInfo.full_name);
            }
        }
    } catch (err) {
        console.log('❌ Error in user check:', err.message);
        return;
    }
    
    // Step 2: Test login
    console.log('\n2️⃣ Testing login...');
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            console.log('❌ Login failed:', error.message);
            
            // Common login issues and fixes
            if (error.message.includes('Invalid login credentials')) {
                console.log('🔧 Trying to reset password...');
                
                // Get user ID first
                const { data: users } = await adminSupabase.auth.admin.listUsers();
                const user = users.users.find(u => u.email === email);
                
                if (user) {
                    const { error: resetError } = await adminSupabase.auth.admin.updateUserById(
                        user.id,
                        { password: password }
                    );
                    
                    if (resetError) {
                        console.log('❌ Password reset failed:', resetError.message);
                    } else {
                        console.log('✅ Password reset successfully');
                        
                        // Try login again
                        const { error: retryError } = await supabase.auth.signInWithPassword({
                            email: email,
                            password: password
                        });
                        
                        if (retryError) {
                            console.log('❌ Login still failed after password reset:', retryError.message);
                        } else {
                            console.log('✅ Login successful after password reset!');
                            await supabase.auth.signOut();
                        }
                    }
                }
            }
        } else {
            console.log('✅ Login successful!');
            console.log('   User ID:', data.user.id);
            console.log('   Email:', data.user.email);
            
            // Sign out
            await supabase.auth.signOut();
            console.log('✅ Signed out successfully');
        }
    } catch (err) {
        console.log('❌ Error during login test:', err.message);
    }
    
    console.log('\n🎯 User troubleshooting completed!');
}

testUserLogin().catch(console.error);
