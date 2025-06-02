import { ref } from 'vue';

interface ToastOptions {
  title?: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface Toast extends ToastOptions {
  id: number;
}

const toasts = ref<Toast[]>([]);
let toastCounter = 0;

export function useToast() {
  const toast = (options: ToastOptions) => {
    const id = toastCounter++;
    const newToast: Toast = {
      id,
      title: options.title || '',
      description: options.description || '',
      type: options.type || 'info',
      duration: options.duration || 5000,
    };

    toasts.value.push(newToast);

    setTimeout(() => {
      removeToast(id);
    }, newToast.duration);

    return id;
  };

  const removeToast = (id: number) => {
    const index = toasts.value.findIndex((t: { id: number }) => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  };

  return {
    toast,
    toasts,
    removeToast,
  };
}
