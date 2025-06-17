import { defineEventHandler } from 'h3'
import { serverSupabaseClient } from '#supabase/server'

export default defineEventHandler(async (event) => {
    try {
        // Use server-side Supabase client
        const supabase = await serverSupabaseClient(event)

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
        
        if (adminError ?? userError) {
            return {
                error: adminError?.message ?? userError?.message,
                admins: [],
                users: [],
            }
        }

        return {
            admins: admins ?? [],
            users: users ?? [],
        }
    } catch (error) {
        console.error('Server error:', error)
        return {
            error: 'Internal server error',
            admins: [],
            users: [],
        }
    }
})
