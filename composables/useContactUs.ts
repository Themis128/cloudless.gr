import { computed, readonly, ref } from 'vue';
import { contactFormSchema, type ContactFormData } from '~/types/validation';

export const useContactUs = () => {
  const form = ref<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const errors = ref({
    name: [] as string[],
    email: [] as string[],
    subject: [] as string[],
    message: [] as string[],
  });

  const isSubmitting = ref(false);
  const isSuccess = ref(false);
  const error = ref('');
  const submissionId = ref('');

  const isValid = computed(() => {
    return (
      form.value.name.trim() !== '' &&
      form.value.email.trim() !== '' &&
      form.value.subject.trim() !== '' &&
      form.value.message.trim() !== '' &&
      errors.value.name.length === 0 &&
      errors.value.email.length === 0 &&
      errors.value.subject.length === 0 &&
      errors.value.message.length === 0
    );
  });
  const validateName = () => {
    errors.value.name = [];
    const result = contactFormSchema.shape.name.safeParse(form.value.name);
    if (!result.success) {
      errors.value.name = result.error.errors.map(err => err.message);
    }
  };

  const validateEmail = () => {
    errors.value.email = [];
    const result = contactFormSchema.shape.email.safeParse(form.value.email);
    if (!result.success) {
      errors.value.email = result.error.errors.map(err => err.message);
    }
  };

  const validateSubject = () => {
    errors.value.subject = [];
    const result = contactFormSchema.shape.subject.safeParse(form.value.subject);
    if (!result.success) {
      errors.value.subject = result.error.errors.map(err => err.message);
    }
  };

  const validateMessage = () => {
    errors.value.message = [];
    const result = contactFormSchema.shape.message.safeParse(form.value.message);
    if (!result.success) {
      errors.value.message = result.error.errors.map(err => err.message);
    }
  };
  const submitForm = async () => {
    isSubmitting.value = true;
    error.value = '';

    // Validate all fields
    const result = contactFormSchema.safeParse(form.value);
    if (!result.success) {
      // Update individual field errors
      const fieldErrors = result.error.flatten().fieldErrors;
      for (const [field, messages] of Object.entries(fieldErrors)) {
        errors.value[field as keyof typeof errors.value] = messages || [];
      }
      isSubmitting.value = false;
      return;
    }

    try {
      const { data } = await $fetch('/api/contact', {
        method: 'POST',
        body: form.value,
      });

      if (data) {
        isSuccess.value = true;
        submissionId.value = data.id || 'N/A';
        // Reset form
        form.value = {
          name: '',
          email: '',
          subject: '',
          message: '',
        };
      }
    } catch (err: any) {
      error.value = err.data?.message || 'Failed to send message. Please try again.';
    } finally {
      isSubmitting.value = false;
    }
  };

  return {
    form: readonly(form),
    errors: readonly(errors),
    isSubmitting: readonly(isSubmitting),
    isSuccess: readonly(isSuccess),
    error: readonly(error),
    submissionId: readonly(submissionId),
    isValid,
    validateName,
    validateEmail,
    validateSubject,
    validateMessage,
    submitForm,
  };
};
