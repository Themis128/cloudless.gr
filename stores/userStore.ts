import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useNuxtApp } from '#app'

export const useUserStore = defineStore('user', () => {
    const user = ref({
        first_name: '',
        last_name: '',
        avatar_url: '',
        email: ''
    })

    const fetchUserProfile = async () => {
        if (!process.client) return // prevent SSR error
        const { $supabase } = useNuxtApp()
        const { data: authData, error: authError } = await $supabase.auth.getUser()
        const authUser = authData?.user
        if (!authUser) {
            user.value = { first_name: '', last_name: '', avatar_url: '', email: '' }
            return
        }
        const { data, error } = await $supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url, email')
            .eq('id', authUser.id)
            .single()
        if (error || !data) {
            console.error('Failed to fetch profile:', error)
            user.value = {
                first_name: '',
                last_name: '',
                avatar_url: '',
                email: authUser.email || ''
            }
        } else {
            user.value = {
                first_name: data.first_name || '',
                last_name: data.last_name || '',
                avatar_url: data.avatar_url || '',
                email: data.email || authUser.email || ''
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
        user.value = { first_name: '', last_name: '', avatar_url: '', email: '' }
    }

    return { user, fetchUserProfile, logout }
})
