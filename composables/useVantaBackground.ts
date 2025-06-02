import { onMounted, readonly, ref } from '#imports';

// Composable to manage Vanta background state
export const useVantaBackground = () => {
  // Initialize with true, but will be updated from storage if available
  const isEnabled = ref(true);

  // Load stored preference on mount
  onMounted(() => {
    if (process.client) {
      const stored = localStorage.getItem('vanta_enabled');
      if (stored !== null) {
        isEnabled.value = stored === 'true';
      }
    }
  });

  const toggleBackground = () => {
    isEnabled.value = !isEnabled.value;
    if (process.client) {
      localStorage.setItem('vanta_enabled', isEnabled.value.toString());
    }
  };

  const enableBackground = () => {
    isEnabled.value = true;
    if (process.client) {
      localStorage.setItem('vanta_enabled', 'true');
    }
  };

  const disableBackground = () => {
    isEnabled.value = false;
    if (process.client) {
      localStorage.setItem('vanta_enabled', 'false');
    }
  };

  return {
    isEnabled: readonly(isEnabled),
    toggleBackground,
    enableBackground,
    disableBackground,
  };
};
