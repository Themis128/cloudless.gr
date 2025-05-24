import { computed, onMounted, reactive, ref } from 'vue';

export interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
  csrfToken: string;
}

export interface FormErrors {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface RateLimitInfo {
  remaining?: number;
  exceeded?: boolean;
  resetTime?: number;
}

/**
 * A composable for managing contact form functionality
 *
 * Features:
 * - Form state management
 * - Field validation
 * - CSRF protection
 * - Rate limiting handling
 * - Error management
 * - Token refresh management
 * - Form auto-save functionality
 *
 * @returns Form state, methods, and submission handling
 */
export function useContactUs() {
  // Form state
  const form = reactive<ContactForm>({
    name: '',
    email: '',
    subject: '',
    message: '',
    csrfToken: '',
  });

  // Form status
  const isSubmitting = ref(false);
  const isSuccess = ref(false);
  const error = ref<string | null>(null);
  const submissionId = ref<number | null>(null);
  const rateLimitInfo = ref<RateLimitInfo | null>(null);
  const isRefreshingToken = ref(false);
  const tokenTimestamp = ref<number | null>(null);
  const isAutoSaving = ref(false);

  // Auto-save timer
  let autoSaveTimeout: NodeJS.Timeout | null = null;

  // Validation
  const errors = reactive<FormErrors>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const isValid = computed(() => {
    return !errors.name && !errors.email && !errors.subject && !errors.message;
  });

  // Validate individual fields
  const validateName = () => {
    errors.name = form.name.trim() === '' ? 'Name is required' : '';
  };

  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.email.trim() === '') {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(form.email)) {
      errors.email = 'Please enter a valid email address';
    } else {
      errors.email = '';
    }
  };

  const validateSubject = () => {
    errors.subject = form.subject.trim() === '' ? 'Subject is required' : '';
  };

  const validateMessage = () => {
    errors.message = form.message.trim() === '' ? 'Message is required' : '';
  };

  // Get CSRF token
  const fetchCsrfToken = async () => {
    isRefreshingToken.value = true;

    try {
      const response = await fetch('/api/csrf-token');
      const data = await response.json();
      if (data.token) {
        form.csrfToken = data.token;
        tokenTimestamp.value = Date.now();
        console.log('CSRF token obtained:', data.token);

        // Store token in localStorage as a backup (not for security, just for convenience)
        if (process.client) {
          localStorage.setItem('backup_csrf_token', data.token);
          localStorage.setItem('token_timestamp', String(tokenTimestamp.value));
        }
      }
    } catch (err) {
      console.error('Failed to fetch CSRF token:', err);
      error.value = 'Failed to initialize form security. Please refresh the page.';

      // Try to retrieve the backup token if available
      if (process.client && !form.csrfToken) {
        const backupToken = localStorage.getItem('backup_csrf_token');
        const storedTimestamp = localStorage.getItem('token_timestamp');

        if (backupToken) {
          form.csrfToken = backupToken;
          tokenTimestamp.value = storedTimestamp ? parseInt(storedTimestamp) : null;
          console.log('Using backup CSRF token');
        }
      }
    } finally {
      isRefreshingToken.value = false;
    }
  };

  // Check if token is close to expiring (75% of its lifetime)
  const checkTokenFreshness = () => {
    if (!tokenTimestamp.value) return false;

    // The token is valid for 4 hours (14400000 ms)
    // Check if it's been more than 3 hours (75% of token lifetime)
    const ageInMs = Date.now() - tokenTimestamp.value;
    const thresholdMs = 10800000; // 3 hours

    return ageInMs < thresholdMs;
  };

  // Form submission
  const submitForm = async () => {
    // Validate all fields first
    validateName();
    validateEmail();
    validateSubject();
    validateMessage();

    if (!isValid.value) {
      console.log('Form validation failed', errors);
      return null;
    }

    // Check if token is getting old and refresh it if needed
    if (!checkTokenFreshness()) {
      console.log('Token is getting stale, refreshing before submission');
      await refreshCsrfToken();
    }

    // Get CSRF token if not already present
    if (!form.csrfToken) {
      console.log('No CSRF token found, fetching a new one');
      await fetchCsrfToken();

      // If still no token, we can't proceed
      if (!form.csrfToken) {
        error.value = 'Unable to secure your form submission. Please try refreshing the page.';
        isSubmitting.value = false;
        return null;
      }
    } else {
      console.log('Using existing CSRF token:', form.csrfToken);
    }

    isSubmitting.value = true;
    error.value = null;

    try {
      console.log('Submitting form data:', { ...form });

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      console.log('Form submission response:', data);

      if (data.status === 'error') {
        // Handle rate limit errors
        if (data.rateLimit?.exceeded) {
          rateLimitInfo.value = {
            exceeded: true,
            resetTime: data.rateLimit.resetTime,
          };
        }

        // If the error mentions CSRF or session, refresh the token automatically
        if (data.message.includes('session') || data.message.includes('CSRF')) {
          console.log('CSRF token issue detected, refreshing automatically');
          await fetchCsrfToken();
        }

        throw new Error(data.message);
      }

      // Handle successful submission
      isSuccess.value = true;

      // Store submission ID if available
      if (data.submissionId) {
        submissionId.value = data.submissionId;
      }

      // Store rate limit info if available
      if (data.rateLimit) {
        rateLimitInfo.value = {
          remaining: data.rateLimit.remaining,
          exceeded: false,
        };
      }

      // After successful submission, get a new CSRF token for any future submissions
      fetchCsrfToken();

      return data;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'An unexpected error occurred';
      return null;
    } finally {
      isSubmitting.value = false;
    }
  };

  // Reset form state
  const resetForm = () => {
    form.name = '';
    form.email = '';
    form.subject = '';
    form.message = '';
    // Don't reset CSRF token as it's still valid

    // Reset errors
    errors.name = '';
    errors.email = '';
    errors.subject = '';
    errors.message = '';

    // Reset form status
    isSuccess.value = false;
    error.value = null;
    submissionId.value = null;
  };

  // Expose a function to refresh the CSRF token
  const refreshCsrfToken = async () => {
    error.value = null;
    await fetchCsrfToken();
    return Boolean(form.csrfToken);
  };

  // Set up automatic token refresh for long sessions
  const setupAutoTokenRefresh = () => {
    if (process.client) {
      // Check the token every 30 minutes
      const intervalId = setInterval(() => {
        if (!checkTokenFreshness()) {
          console.log('Auto-refreshing CSRF token');
          refreshCsrfToken();
        }
      }, 1800000); // 30 minutes

      // Clean up the interval when the component is unmounted
      onMounted(() => {
        return () => clearInterval(intervalId);
      });
    }
  };

  // Initialize CSRF token when the composable is used on the client
  if (process.client) {
    onMounted(() => {
      fetchCsrfToken();
      setupAutoTokenRefresh();
    });
  }

  return {
    form,
    errors,
    isSubmitting,
    isSuccess,
    error,
    submissionId,
    rateLimitInfo,
    isRefreshingToken,
    isValid,
    validateName,
    validateEmail,
    validateSubject,
    validateMessage,
    submitForm,
    resetForm,
    refreshCsrfToken,
    checkTokenFreshness,
  };
}
