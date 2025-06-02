import { useFetch } from '#imports';

export function useBuilder() {
  const builderConfig = ref(null);
  const loading = ref(false);
  const error = ref(null);

  const fetchBuilderConfig = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await useFetch(`/api/builder/${id}`);
      builderConfig.value = data.value;
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  };

  const saveBuilderConfig = async (payload: any) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await useFetch('/api/builder', {
        method: 'POST',
        body: payload,
      });
      builderConfig.value = data.value;
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  };

  const updateBuilderConfig = async (id: string, payload: any) => {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await useFetch(`/api/builder/${id}`, {
        method: 'PUT',
        body: payload,
      });
      builderConfig.value = data.value;
    } catch (e) {
      error.value = e;
    } finally {
      loading.value = false;
    }
  };

  return {
    builderConfig,
    fetchBuilderConfig,
    saveBuilderConfig,
    updateBuilderConfig,
    loading,
    error,
  };
}
