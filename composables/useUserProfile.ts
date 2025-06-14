import { ref, onMounted } from 'vue'
import { useSupabase } from '@/composables/useSupabase'

const user_profile = ref<any>(null)

export function useUserProfile() {
    const supabase = useSupabase()

    async function loadProfile() {
        const { data: user } = await supabase.auth.getUser()
        if (!user.user) return

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.user.id)
            .single()

        if (!error) user_profile.value = data
    }

    onMounted(loadProfile)

    return { user_profile, loadProfile }
}
