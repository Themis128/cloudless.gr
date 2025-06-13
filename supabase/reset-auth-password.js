import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function resetPassword() {
    // Step 1: Get the user by email
    const { data: users, error: findError } = await supabase.auth.admin.listUsers()
    if (findError) {
        console.error('Error listing users:', findError.message)
        return
    }
    const user = users.users.find(u => u.email === 'baltzakis.themis@gmail.com')
    if (!user) {
        console.error('User not found')
        return
    }

    // Step 2: Update the password by user ID
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
        password: 'cloudless2025'
    })
    if (error) {
        console.error('Error resetting password:', error.message)
    } else {
        console.log('✅ Password reset successfully')
    }
}

resetPassword()
