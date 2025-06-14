import { useSupabase } from '~/composables/useSupabase'
import { ref } from 'vue'

export function useStorage() {
    const supabase = useSupabase()
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function listFiles(bucket: string, path: string) {
        loading.value = true
        error.value = null
        const { data, error: fetchError } = await supabase.storage.from(bucket).list(path)
        loading.value = false
        if (fetchError) {
            error.value = fetchError.message
            return []
        }
        return data || []
    }

    async function uploadFile(bucket: string, path: string, file: File) {
        loading.value = true
        error.value = null
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file)
        loading.value = false
        if (uploadError) {
            error.value = uploadError.message
            return false
        }
        return true
    }

    async function getPublicUrl(bucket: string, path: string) {
        return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
    }

    return { listFiles, uploadFile, getPublicUrl, loading, error }
}
