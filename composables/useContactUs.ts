import { computed, readonly, ref } from '#imports';
import type { ContactFormData } from '~/types/contact';

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
  const isRefreshingToken = ref(false);

  // Mock rate limit info for compatibility
  const rateLimitInfo = ref({
    remaining: 10,
    exceeded: false,
    resetTime: null,
  });

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
    if (!form.value.name.trim()) {
      errors.value.name.push('Name is required');
    }
  };

  const validateEmail = () => {
    errors.value.email = [];
    if (!form.value.email.trim()) {
      errors.value.email.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
      errors.value.email.push('Please enter a valid email address');
    }
  };

  const validateSubject = () => {
    errors.value.subject = [];
    if (!form.value.subject.trim()) {
      errors.value.subject.push('Subject is required');
    }
  };

  const validateMessage = () => {
    errors.value.message = [];
    if (!form.value.message.trim()) {
      errors.value.message.push('Message is required');
    } else if (form.value.message.trim().length < 10) {
      errors.value.message.push('Message must be at least 10 characters long');
    }
  };

  const submitForm = async () => {
    isSubmitting.value = true;
    error.value = '';

    // Validate all fields
    validateName();
    validateEmail();
    validateSubject();
    validateMessage();

    if (!isValid.value) {
      isSubmitting.value = false;
      return;
    }

    try {
      const response = (await $fetch('/api/contact-submissions', {
        method: 'POST',
        body: form.value,
      })) as any;

      if (response) {
        isSuccess.value = true;
        submissionId.value = response.id || 'N/A';
        // Reset form
        resetForm();
      }
    } catch (err: any) {
      error.value = err.data?.message || 'Failed to send message. Please try again.';
    } finally {
      isSubmitting.value = false;
    }
  };

  const resetForm = () => {
    form.value = {
      name: '',
      email: '',
      subject: '',
      message: '',
    };
    errors.value = {
      name: [],
      email: [],
      subject: [],
      message: [],
    };
    isSuccess.value = false;
    error.value = '';
  };

  const refreshCsrfToken = async () => {
    isRefreshingToken.value = true;
    // Mock CSRF token refresh
    await new Promise((resolve) => setTimeout(resolve, 1000));
    isRefreshingToken.value = false;
  };

  return {
    form,
    errors: readonly(errors),
    isSubmitting: readonly(isSubmitting),
    isSuccess: readonly(isSuccess),
    error: readonly(error),
    submissionId: readonly(submissionId),
    rateLimitInfo: readonly(rateLimitInfo),
    isRefreshingToken: readonly(isRefreshingToken),
    isValid,
    validateName,
    validateEmail,
    validateSubject,
    validateMessage,
    submitForm,
    resetForm,
    refreshCsrfToken,
  };
};
