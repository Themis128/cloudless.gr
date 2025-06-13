import { defineEventHandler } from 'h3'
import { useSupabase } from '~/composables/useSupabase'

export default defineEventHandler(async () => {
    // Use service_role for privileged access
    const supabase = useSupabase(true)

    // Fetch admins from the admins table (lowercase)
    const { data: admins, error: adminError } = await supabase
        .from('admins')
        .select('*')
    console.log('API admins:', admins, 'Error:', adminError)

    // Fetch users
    const { data: users, error: userError } = await supabase
        .from('users')
        .select('*')
    console.log('API users:', users, 'Error:', userError)

    if (adminError || userError) {
        return {
            error: adminError?.message || userError?.message,
            admins: [],
            users: [],
        }
    }

    return {
        admins,
        users,
    }
})
