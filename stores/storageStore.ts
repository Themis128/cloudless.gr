import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useSupabase } from '~/composables/useSupabase'

export const useStorageStore = defineStore('storage', () => {
    const files = ref<any[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)
    const supabase = useSupabase()

    async function fetchFiles(userId: string) {
        loading.value = true
        error.value = null
        const { data, error: fetchError } = await supabase.storage.from('users').list(userId + '/')
        if (fetchError) {
            error.value = fetchError.message
        } else {
            files.value = data?.map(f => ({ ...f, url: null })) || []
        }
        loading.value = false
    }

    async function uploadFile(userId: string, file: File) {
        loading.value = true
        error.value = null
        const { error: uploadError } = await supabase.storage.from('users').upload(userId + '/' + file.name, file)
        if (uploadError) {
            error.value = uploadError.message
        } else {
            await fetchFiles(userId)
        }
        loading.value = false
    }

    return { files, loading, error, fetchFiles, uploadFile }
})
