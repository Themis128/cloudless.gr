import { ref } from 'vue'

export function useContactForm() {
    const name = ref('')
    const email = ref('')
    const message = ref('')
    const errorMsg = ref('')
    const successMsg = ref('')
    const submitting = ref(false)
    const isFlipped = ref(false)
    const form = ref()
    const formValid = ref(true)

    function reset() {
        name.value = ''
        email.value = ''
        message.value = ''
        errorMsg.value = ''
        successMsg.value = ''
        submitting.value = false
        isFlipped.value = false
    }

    return {
        name,
        email,
        message,
        errorMsg,
        successMsg,
        submitting,
        isFlipped,
        form,
        formValid,
        reset,
    }
}
