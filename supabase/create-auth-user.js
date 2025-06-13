import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRole)

async function createUserInAuth() {
    // Create user in Supabase Auth using admin API
    const { data, error } = await supabase.auth.admin.createUser({
        email: 'baltzakis.themis@gmail.com',
        password: 'cloudless2025', // Use the password from your users table
        email_confirm: true
    })

    if (error) {
        console.error('Error creating user in Auth:', error.message)
        return
    }

    console.log('✅ User created in Supabase Auth:', data.user?.id)
    console.log('✅ User can now login with email/password through Supabase Auth')
}

createUserInAuth()
