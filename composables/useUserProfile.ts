import { ref, onMounted } from 'vue'

const user_profile = ref<any>(null)

export function useUserProfile() {
    const { userProfile } = useSupabaseDB()

    async function loadProfile() {
        try {
            user_profile.value = await userProfile.get()
        } catch (error) {
            console.error('Failed to load user profile:', error)
        }
    }

    onMounted(loadProfile)

    return { user_profile, loadProfile }
}
