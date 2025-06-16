import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
    const user = ref({
        full_name: '',
        avatar_url: '',
        role: '',
        email: ''
    })

    const fetchUserProfile = async () => {
        if (typeof window === 'undefined') return // prevent SSR error
        const supabase = useSupabaseClient()
        const { data: authData } = await supabase.auth.getUser()
        const authUser = authData?.user
        if (!authUser) {
            user.value = { full_name: '', avatar_url: '', role: '', email: '' }
            return
        }

        // Fetch user info
        const { data: userInfo, error: userInfoError } = await supabase
            .from('user-info')
            .select('full_name, avatar_url')
            .eq('id', authUser.id)
            .single()

        // Fetch user profile/role
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authUser.id)
            .single()

        if (userInfoError && profileError) {
            console.error('Failed to fetch user data:', { userInfoError, profileError })
            user.value = {
                full_name: '',
                avatar_url: '',
                role: '',
                email: authUser.email ?? ''
            }        } else {
            user.value = {
                full_name: (userInfo as any)?.full_name ?? '',
                avatar_url: (userInfo as any)?.avatar_url ?? '',
                role: (profile as any)?.role ?? 'user',
                email: authUser.email ?? ''
            }
        }
    }

    const isAdmin = () => {
        return user.value.role === 'admin'
    }

    const isUser = () => {
        return user.value.role === 'user'
    }

    const logout = async () => {
        const supabase = useSupabaseClient()
        try {
            await supabase.auth.signOut()
        } catch (e) {
            console.error('Logout error:', e)
        }
        user.value = { full_name: '', avatar_url: '', role: '', email: '' }
    }

    return { user, fetchUserProfile, isAdmin, isUser, logout }
})
