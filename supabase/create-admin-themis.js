import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// Use environment variables for security
const supabaseUrl = process.env.SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, serviceRole)

async function createAdminUser() {
    // Step 1: Find user in auth.users
    const { data: users, error: findError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', 'baltzakis.themis@gmail.com')
        .limit(1)

    if (findError) {
        console.error('Error finding user:', findError.message)
        return
    }

    if (!users || users.length === 0) {
        console.error('No user found with this email. Please register the user first.')
        return
    }

    const user = users[0]

    // Step 2: Insert into admins table if not already present
    const { data: existingAdmins, error: adminFindError } = await supabase
        .from('admins')
        .select('id')
        .eq('id', user.id)
        .limit(1)

    if (adminFindError) {
        console.error('Error checking admins table:', adminFindError.message)
        return
    }

    if (existingAdmins && existingAdmins.length > 0) {
        console.log('User is already an admin.')
        return
    }

    const { error: insertError } = await supabase.from('admins').insert({
        id: user.id, // foreign key to auth.users
        email: user.email,
        password: 'TH!123789th!', // store password as required by schema (not secure for production)
    })

    if (insertError) {
        console.error('❌ Error inserting into admins table:', insertError.message)
        return
    }

    console.log('✅ Admin inserted successfully')
}

createAdminUser()
