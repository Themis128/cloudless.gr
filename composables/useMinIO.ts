// composables/useMinIO.ts

interface MinIOUploadOptions {
  bucket?: string;
  onProgress?: (progress: number) => void;
}

interface MinIOFile {
  name: string;
  size: number;
  lastModified: Date;
  etag: string;
}

interface MinIOResponse {
  success: boolean;
  message?: string;
  fileName?: string;
  bucket?: string;
  fileContent?: string;
  objects?: MinIOFile[];
  count?: number;
}

interface MinIOHealthStatus {
  success: boolean;
  status: 'connected' | 'disconnected';
  endpoint?: string;
  timestamp: string;
  error?: string;
}

export const useMinIO = () => {
  const isUploading = ref(false);
  const uploadProgress = ref(0);
  const error = ref<string | null>(null);
  const isHealthy = ref<boolean | null>(null);
  const lastHealthCheck = ref<Date | null>(null);

  const checkHealth = async (): Promise<MinIOHealthStatus> => {
    try {
      const response = await $fetch<MinIOHealthStatus>('/api/minio/ping');
      isHealthy.value = response.success;
      lastHealthCheck.value = new Date();
      return response;
    } catch (error: any) {
      isHealthy.value = false;
      lastHealthCheck.value = new Date();

      // Handle error response from server
      if (error.data) {
        return error.data as MinIOHealthStatus;
      }

      return {
        success: false,
        status: 'disconnected',
        error: error.message || 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  };

  // Auto-check health on composable initialization
  const initHealthCheck = async () => {
    if (process.client && !lastHealthCheck.value) {
      await checkHealth();
    }
  };

  // Initialize health check
  if (process.client) {
    initHealthCheck();
  }

  const uploadFile = async (
    file: File,
    options: MinIOUploadOptions = {}
  ): Promise<MinIOResponse> => {
    try {
      isUploading.value = true;
      error.value = null;
      uploadProgress.value = 0;

      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onprogress = (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            uploadProgress.value = progress;
            options.onProgress?.(progress);
          }
        };

        reader.onload = async () => {
          try {
            const base64 = (reader.result as string).split(',')[1];

            const response = await $fetch<MinIOResponse>('/api/minio/upload', {
              method: 'POST',
              body: {
                fileName: file.name,
                fileContent: base64,
                bucket: options.bucket || 'default-bucket',
              },
            });

            uploadProgress.value = 100;
            resolve(response);
          } catch (err: any) {
            error.value = err.message || 'Upload failed';
            reject(err);
          } finally {
            isUploading.value = false;
          }
        };

        reader.onerror = () => {
          error.value = 'Failed to read file';
          isUploading.value = false;
          reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
      });
    } catch (err: any) {
      error.value = err.message || 'Upload failed';
      isUploading.value = false;
      throw err;
    }
  };

  const downloadFile = async (
    fileName: string,
    bucket = 'default-bucket'
  ): Promise<MinIOResponse> => {
    try {
      error.value = null;

      const response = await $fetch<MinIOResponse>('/api/minio/download', {
        method: 'GET',
        query: { fileName, bucket },
      });

      return response;
    } catch (err: any) {
      error.value = err.message || 'Download failed';
      throw err;
    }
  };

  const listFiles = async (bucket = 'default-bucket', prefix = ''): Promise<MinIOResponse> => {
    try {
      error.value = null;

      const response = await $fetch<MinIOResponse>('/api/minio/list', {
        method: 'GET',
        query: { bucket, prefix },
      });

      return response;
    } catch (err: any) {
      error.value = err.message || 'List failed';
      throw err;
    }
  };

  const deleteFile = async (
    fileName: string,
    bucket = 'default-bucket'
  ): Promise<MinIOResponse> => {
    try {
      error.value = null;

      const response = await $fetch<MinIOResponse>('/api/minio/delete', {
        method: 'DELETE',
        body: { fileName, bucket },
      });

      return response;
    } catch (err: any) {
      error.value = err.message || 'Delete failed';
      throw err;
    }
  };

  const downloadAsBlob = (base64Content: string, fileName: string) => {
    try {
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray]);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      error.value = err.message || 'Download failed';
      throw err;
    }
  };

  return {
    // State
    isUploading: readonly(isUploading),
    uploadProgress: readonly(uploadProgress),
    error: readonly(error),
    isHealthy: readonly(isHealthy),
    lastHealthCheck: readonly(lastHealthCheck),

    // Methods
    uploadFile,
    downloadFile,
    listFiles,
    deleteFile,
    downloadAsBlob,
    checkHealth,
  };
};
