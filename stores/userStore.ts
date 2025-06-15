import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useNuxtApp } from '#app'

export const useUserStore = defineStore('user', () => {
    const user = ref({
        full_name: '',
        avatar_url: ''
    })

    const fetchUserProfile = async () => {
        if (typeof window === 'undefined') return // prevent SSR error
        const { $supabase } = useNuxtApp()
        const { data: authData } = await $supabase.auth.getUser()
        const authUser = authData?.user
        if (!authUser) {
            user.value = { full_name: '', avatar_url: '' }
            return
        }
        const { data, error } = await $supabase
            .from('user-info')
            .select('full_name, avatar_url')
            .eq('id', authUser.id)
            .single()
        if (error || !data) {
            console.error('Failed to fetch user-info:', error)
            user.value = {
                full_name: '',
                avatar_url: ''
            }
        } else {
            user.value = {
                full_name: data.full_name ?? '',
                avatar_url: data.avatar_url ?? ''
            }
        }
    }

    const logout = async () => {
        const { $supabase } = useNuxtApp()
        try {
            await $supabase.auth.signOut()
        } catch (e) {
            console.error('Logout error:', e)
        }
        user.value = { full_name: '', avatar_url: '' }
    }

    return { user, fetchUserProfile, logout }
})
