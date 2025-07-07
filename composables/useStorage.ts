import { getSupabaseClient } from '~/composables/useSupabase'
import { ref } from 'vue'

export function useStorage() {
    const supabase = getSupabaseClient()
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

    async function uploadFile(bucket: string, path: string, file: File, upsert = false) {
        loading.value = true
        error.value = null
        const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert })
        loading.value = false
        if (uploadError) {
            error.value = uploadError.message
            return false
        }
        return true
    }

    async function removeFile(bucket: string, path: string) {
        loading.value = true
        error.value = null
        const { error: removeError } = await supabase.storage.from(bucket).remove([path])
        loading.value = false
        if (removeError) {
            error.value = removeError.message
            return false
        }
        return true
    }

    async function getPublicUrl(bucket: string, path: string) {
        try {
            const { data } = supabase.storage.from(bucket).getPublicUrl(path)
            return data.publicUrl
        } catch (err) {
            console.error('[getPublicUrl error]', err)
            error.value = (err as Error).message
            return null
        }
    }

    return { listFiles, uploadFile, removeFile, getPublicUrl, loading, error }
}
