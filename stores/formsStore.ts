import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useFormsStore = defineStore('forms', () => {
  // Login form state
  const login = ref({
    email: '',
    password: '',
    loading: false,
    error: null as string | null,
  });

  // Register form state
  const register = ref({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
    loading: false,
    error: null as string | null,
    success: '',
  });

  // Reset password form state
  const reset = ref({
    email: '',
    loading: false,
    error: null as string | null,
    success: false,
  });

  // Utility actions
  function resetLogin() {
    login.value = { email: '', password: '', loading: false, error: null };
  }
  function resetRegister() {
    register.value = { name: '', email: '', password: '', confirmPassword: '', agreeTerms: false, loading: false, error: null, success: '' };
  }
  function resetReset() {
    reset.value = { email: '', loading: false, error: null, success: false };
  }

  return {
    login,
    register,
    reset,
    resetLogin,
    resetRegister,
    resetReset,
  };
});
