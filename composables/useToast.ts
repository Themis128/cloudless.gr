import { ref } from '#imports';

interface SnackbarAction {
  text: string;
  color?: string;
  onClick: () => void;
}

interface SnackbarState {
  show: boolean;
  text: string;
  color: 'success' | 'error' | 'warning' | 'info';
  timeout: number;
  location?: 'top' | 'bottom' | 'start' | 'end' | 'center-start' | 'center-end';
  action?: SnackbarAction;
  multi?: boolean;
}

// Create a reactive snackbar state with default values
const snackbar = ref<SnackbarState>({
  show: false,
  text: '',
  color: 'info',
  timeout: 5000,
  location: 'top',
  multi: false,
});

// Queue for multiple notifications
const queue = ref<Omit<SnackbarState, 'show'>[]>([]);

export function useToast() {
  // Process the next item in the queue
  const processQueue = () => {
    if (queue.value.length > 0) {
      const next = queue.value.shift();
      if (next) {
        snackbar.value = { ...next, show: true };
      }
    }
  };

  // Watch for snackbar being hidden to process queue
  watch(
    () => snackbar.value.show,
    (newValue: boolean) => {
      if (!newValue && queue.value.length > 0) {
        // Wait a bit before showing next notification
        setTimeout(processQueue, 300);
      }
    }
  );

  const showSnackbar = (
    text: string,
    options: Partial<Omit<SnackbarState, 'show' | 'text'>> = {}
  ) => {
    const snackbarOptions = {
      text,
      color: options.color || 'info',
      timeout: options.timeout || 5000,
      location: options.location || 'top',
      action: options.action,
      multi: options.multi || false,
    };

    if (snackbar.value.show && !snackbar.value.multi) {
      // Add to queue if snackbar is showing
      queue.value.push(snackbarOptions);
    } else {
      // Show immediately
      snackbar.value = { ...snackbarOptions, show: true };
    }
  };

  const hideSnackbar = () => {
    snackbar.value.show = false;
  };

  // Helper functions for common use cases
  const success = (
    message: string,
    options?: Partial<Omit<SnackbarState, 'show' | 'text' | 'color'>>
  ) => showSnackbar(message, { ...options, color: 'success' });

  const error = (
    message: string,
    options?: Partial<Omit<SnackbarState, 'show' | 'text' | 'color'>>
  ) => showSnackbar(message, { ...options, color: 'error' });

  const warning = (
    message: string,
    options?: Partial<Omit<SnackbarState, 'show' | 'text' | 'color'>>
  ) => showSnackbar(message, { ...options, color: 'warning' });

  const info = (
    message: string,
    options?: Partial<Omit<SnackbarState, 'show' | 'text' | 'color'>>
  ) => showSnackbar(message, { ...options, color: 'info' });

  return {
    snackbar,
    showSnackbar,
    hideSnackbar,
    success,
    error,
    warning,
    info,
  };
}
