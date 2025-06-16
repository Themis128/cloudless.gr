// Check database tables and permissions
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const adminSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDatabase() {
    console.log('🔍 Checking database structure...');
    console.log('==================================');
    
    try {
        // Test profiles table
        console.log('\n📋 Testing profiles table...');
        const { data: profilesTest, error: profilesError } = await adminSupabase
            .from('profiles')
            .select('*')
            .limit(1);
        
        if (profilesError) {
            console.log('❌ Profiles table error:', profilesError.message);
        } else {
            console.log('✅ Profiles table accessible');
            console.log('   Sample data count:', profilesTest.length);
        }
        
        // Test user-info table
        console.log('\n👤 Testing user-info table...');
        const { data: userInfoTest, error: userInfoError } = await adminSupabase
            .from('user-info')
            .select('*')
            .limit(1);
        
        if (userInfoError) {
            console.log('❌ User-info table error:', userInfoError.message);
        } else {
            console.log('✅ User-info table accessible');
            console.log('   Sample data count:', userInfoTest.length);
        }
        
        // Try to insert a test record (we'll delete it after)
        console.log('\n🧪 Testing insert permissions...');
        const testId = '00000000-0000-0000-0000-000000000000';
        
        // Test profiles insert
        const { error: profileInsertError } = await adminSupabase
            .from('profiles')
            .insert({
                id: testId,
                role: 'user'
            });
        
        if (profileInsertError) {
            console.log('❌ Cannot insert into profiles:', profileInsertError.message);
        } else {
            console.log('✅ Can insert into profiles');
            // Clean up
            await adminSupabase.from('profiles').delete().eq('id', testId);
        }
        
        // Test user-info insert
        const { error: userInfoInsertError } = await adminSupabase
            .from('user-info')
            .insert({
                id: testId,
                full_name: 'Test User'
            });
        
        if (userInfoInsertError) {
            console.log('❌ Cannot insert into user-info:', userInfoInsertError.message);
        } else {
            console.log('✅ Can insert into user-info');
            // Clean up
            await adminSupabase.from('user-info').delete().eq('id', testId);
        }
        
        // Check our specific user
        console.log('\n👨‍💼 Checking our user...');
        const email = 'baltzakis.themis@gmail.com';
        const { data: users } = await adminSupabase.auth.admin.listUsers();
        const user = users.users.find(u => u.email === email);
        
        if (user) {
            console.log('✅ User ID:', user.id);
            
            // Try manual insert with proper error handling
            console.log('\n🔧 Manually creating profile...');
            const { data: insertData, error: insertError } = await adminSupabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    role: 'user'
                }, {
                    onConflict: 'id'
                })
                .select();
            
            if (insertError) {
                console.log('❌ Profile upsert error:', insertError.message);
                console.log('   Error details:', insertError);
            } else {
                console.log('✅ Profile created/updated:', insertData);
            }
            
            console.log('\n👤 Manually creating user-info...');
            const { data: userInsertData, error: userInsertError } = await adminSupabase
                .from('user-info')
                .upsert({
                    id: user.id,
                    full_name: 'Themistoklis Baltzakis'
                }, {
                    onConflict: 'id'
                })
                .select();
            
            if (userInsertError) {
                console.log('❌ User-info upsert error:', userInsertError.message);
                console.log('   Error details:', userInsertError);
            } else {
                console.log('✅ User-info created/updated:', userInsertData);
            }
        }
        
    } catch (err) {
        console.log('❌ Database check error:', err.message);
    }
}

checkDatabase().catch(console.error);
