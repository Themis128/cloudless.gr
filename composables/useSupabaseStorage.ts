// composables/useSupabaseStorage.ts
import { computed, onMounted, readonly, ref } from '#imports';
import type { FileOptions } from '@supabase/storage-js';

export type FileType = 'image' | 'video' | 'document' | 'audio' | 'other';
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed' | 'cancelled';

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  rate?: number; // bytes per second
  timeRemaining?: number; // seconds
  lastProgressAt?: number;
}

export interface UploadOptions {
  bucket?: string;
  path?: string;
  maxSizeMB?: number;
  allowedTypes?: FileType[] | string[];
  cacheControl?: string;
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (response: StorageResponse) => void;
  onError?: (error: Error) => void;
  retries?: number;
  chunkSize?: number; // for large file uploads
  priority?: number; // for queue management
  metadata?: Record<string, string>;
}

export interface StorageFile {
  id: string;
  name: string;
  size: number;
  type: FileType;
  url?: string;
  metadata: {
    lastModified: Date;
    etag: string;
    mimetype: string;
    customMetadata?: Record<string, string>;
    hash?: string;
    path?: string;
    bucket?: string;
  };
}

export interface StorageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  path?: string;
  bucket?: string;
  metadata?: Record<string, string>;
}

export interface QueuedUpload {
  id: string;
  file: File;
  options: UploadOptions;
  status: UploadStatus;
  progress: UploadProgress;
  attempts: number;
  createdAt: Date;
  lastAttemptAt?: Date;
  error?: Error;
}

export class StorageValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'StorageValidationError';
  }
}

export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks for large files
const MAX_RETRIES = 3;
const DEFAULT_CACHE_CONTROL = '3600';

// File type patterns
const FILE_TYPE_PATTERNS: Record<FileType, string[]> = {
  image: ['image/'],
  video: ['video/'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument',
  ],
  audio: ['audio/'],
  other: ['*'],
};

export const useSupabaseStorage = () => {
  const client = useSupabaseClient();
  const uploadQueue = ref<QueuedUpload[]>([]);
  const activeUploads = ref<QueuedUpload[]>([]);
  const error = ref<string | null>(null);
  const storageQuota = ref<number | null>(null);
  const usedStorage = ref<number>(0);

  // Computed properties
  const isUploading = computed(() => activeUploads.value.length > 0);
  const queuedCount = computed(() => uploadQueue.value.length);
  const totalProgress = computed(() => {
    const uploads = [...activeUploads.value, ...uploadQueue.value];
    if (uploads.length === 0) return 0;
    const total = uploads.reduce((sum, upload) => sum + upload.progress.percent, 0);
    return total / uploads.length;
  });
  const availableStorage = computed(() =>
    storageQuota.value ? storageQuota.value - usedStorage.value : null
  );

  // Core utility functions
  const getFileType = (file: File): FileType => {
    const mimeType = file.type.toLowerCase();
    for (const [type, patterns] of Object.entries(FILE_TYPE_PATTERNS)) {
      if (patterns.some(pattern => pattern === '*' || mimeType.startsWith(pattern))) {
        return type as FileType;
      }
    }
    return 'other';
  };

  const validateFile = async (file: File, options: UploadOptions): Promise<void> => {
    // Storage quota validation
    if (availableStorage.value !== null && file.size > availableStorage.value) {
      throw new StorageQuotaError('Storage quota exceeded');
    }

    // Size validation
    if (options.maxSizeMB) {
      const maxSizeBytes = options.maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        throw new StorageValidationError(
          `File size exceeds maximum limit of ${options.maxSizeMB}MB`,
          'SIZE_EXCEEDED',
          { size: file.size, maxSize: maxSizeBytes }
        );
      }
    }

    // Type validation
    if (options.allowedTypes?.length) {
      const fileType = getFileType(file);
      const isAllowed =
        options.allowedTypes.includes(fileType) ||
        options.allowedTypes.some(type => file.type.startsWith(type));

      if (!isAllowed) {
        throw new StorageValidationError(`File type ${file.type} is not allowed`, 'INVALID_TYPE', {
          type: file.type,
          allowedTypes: options.allowedTypes,
        });
      }
    }

    // File integrity check
    try {
      const buffer = await file.slice(0, Math.min(file.size, 8192)).arrayBuffer();
      if (!buffer || buffer.byteLength === 0) {
        throw new StorageValidationError('File appears to be corrupted or empty', 'FILE_CORRUPTED');
      }
    } catch (err) {
      throw new StorageValidationError('Failed to validate file integrity', 'VALIDATION_FAILED', {
        cause: err,
      });
    }
  };

  // Queue management
  const processUploadQueue = async () => {
    if (activeUploads.value.length >= 3) return; // Max concurrent uploads

    const nextUpload = uploadQueue.value.find(u => u.status === 'pending');
    if (!nextUpload) return;

    // Move to active uploads
    uploadQueue.value = uploadQueue.value.filter(u => u.id !== nextUpload.id);
    activeUploads.value.push(nextUpload);

    try {
      await uploadWithRetry(nextUpload);
    } finally {
      // Remove from active uploads
      activeUploads.value = activeUploads.value.filter(u => u.id !== nextUpload.id);
      // Process next in queue
      processUploadQueue();
    }
  };

  const uploadWithRetry = async (queuedUpload: QueuedUpload): Promise<StorageResponse> => {
    const { file, options } = queuedUpload;
    const maxRetries = options.retries ?? MAX_RETRIES;
    const bucket = options.bucket || 'default';
    const path = options.path ? `${options.path}/${file.name}` : file.name;

    while (queuedUpload.attempts < maxRetries) {
      try {
        queuedUpload.lastAttemptAt = new Date();

        // For large files, use chunked upload
        if (file.size > CHUNK_SIZE) {
          return await uploadLargeFile(queuedUpload, bucket, path);
        }

        // Track progress
        const updateProgress = (bytesUploaded: number, totalBytes: number) => {
          const now = Date.now();
          const lastProgressAt = queuedUpload.progress.lastProgressAt || now;
          const timeDiff = now - lastProgressAt;
          const byteDiff = bytesUploaded - (queuedUpload.progress.loaded || 0);

          const progressData: UploadProgress = {
            loaded: bytesUploaded,
            total: totalBytes,
            percent: (bytesUploaded / totalBytes) * 100,
            rate: timeDiff > 0 ? (byteDiff / timeDiff) * 1000 : undefined,
            timeRemaining:
              timeDiff > 0 && byteDiff > 0
                ? ((totalBytes - bytesUploaded) / byteDiff) * (timeDiff / 1000)
                : undefined,
            lastProgressAt: now,
          };

          queuedUpload.progress = progressData;
          options.onProgress?.(progressData);
        };

        // Prepare upload options
        const uploadOptions: FileOptions = {
          upsert: true,
          cacheControl: options.cacheControl || DEFAULT_CACHE_CONTROL,
          contentType: file.type,
        };

        // Upload with progress tracking
        const { data, error: uploadError } = await client.storage
          .from(bucket)
          .upload(path, file, uploadOptions);

        if (uploadError) throw uploadError;

        queuedUpload.status = 'completed';
        updateProgress(file.size, file.size); // Final progress update

        const response = {
          success: true,
          data,
          path,
          bucket,
          metadata: options.metadata,
        };

        options.onComplete?.(response);
        return response;
      } catch (err) {
        queuedUpload.attempts++;
        queuedUpload.status = 'failed';
        queuedUpload.error = err instanceof Error ? err : new Error(String(err));

        if (
          queuedUpload.attempts === maxRetries ||
          err instanceof StorageValidationError ||
          err instanceof StorageQuotaError
        ) {
          options.onError?.(queuedUpload.error);
          throw queuedUpload.error;
        }

        // Wait before retrying with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, queuedUpload.attempts), 32000);
        await new Promise(resolve => setTimeout(resolve, delay));
        queuedUpload.status = 'pending';
      }
    }
    throw new Error('Upload failed after maximum retries');
  };

  const uploadLargeFile = async (
    queuedUpload: QueuedUpload,
    bucket: string,
    path: string
  ): Promise<StorageResponse> => {
    const { file, options } = queuedUpload;
    const chunkSize = options.chunkSize || CHUNK_SIZE;
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadedChunkPaths: string[] = [];
    let lastProgressUpdate = Date.now();

    try {
      // Track overall progress
      const updateProgress = (uploadedBytes: number) => {
        const now = Date.now();
        const timeDiff = now - lastProgressUpdate;
        const byteDiff = uploadedBytes - queuedUpload.progress.loaded;

        const progressData: UploadProgress = {
          loaded: uploadedBytes,
          total: file.size,
          percent: (uploadedBytes / file.size) * 100,
          rate: timeDiff > 0 ? (byteDiff / timeDiff) * 1000 : undefined,
          timeRemaining:
            timeDiff > 0 && byteDiff > 0
              ? ((file.size - uploadedBytes) / byteDiff) * (timeDiff / 1000)
              : undefined,
          lastProgressAt: now,
        };

        queuedUpload.progress = progressData;
        options.onProgress?.(progressData);
        lastProgressUpdate = now;
      };

      // Upload chunks in sequence to maintain order
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        const chunkPath = `${path}_chunk_${i}`;

        const { error: uploadError } = await client.storage.from(bucket).upload(chunkPath, chunk, {
          upsert: true,
          contentType: 'application/octet-stream',
        });

        if (uploadError) {
          throw new Error(`Failed to upload chunk ${i}: ${uploadError.message}`);
        }

        uploadedChunkPaths.push(chunkPath);
        updateProgress(Math.min((i + 1) * chunkSize, file.size));
      }

      // All chunks uploaded, now merge them
      const { data, error: mergeError } = await client.storage.from(bucket).upload(path, file, {
        upsert: true,
        contentType: file.type,
        metadata: {
          ...options.metadata,
          originalSize: file.size,
          chunks: totalChunks,
        },
      });

      if (mergeError) {
        throw new Error(`Failed to merge chunks: ${mergeError.message}`);
      }

      // Update final progress
      updateProgress(file.size);

      // Cleanup chunks in parallel
      await Promise.all(
        uploadedChunkPaths.map(async chunkPath => {
          try {
            await client.storage.from(bucket).remove([chunkPath]);
          } catch (err) {
            console.warn(`Failed to cleanup chunk ${chunkPath}:`, err);
          }
        })
      );

      return {
        success: true,
        data,
        path,
        bucket,
        metadata: options.metadata,
      };
    } catch (err) {
      // Attempt to cleanup any uploaded chunks on failure
      try {
        await Promise.all(
          uploadedChunkPaths.map(chunkPath => client.storage.from(bucket).remove([chunkPath]))
        );
      } catch (cleanupErr) {
        console.error('Failed to cleanup chunks after error:', cleanupErr);
      }

      throw err;
    }
  };

  const uploadFile = async (
    file: File | File[],
    options: UploadOptions = {}
  ): Promise<StorageResponse | StorageResponse[]> => {
    try {
      error.value = null;
      const files = Array.isArray(file) ? file : [file];

      // Validate all files first
      await Promise.all(files.map(f => validateFile(f, options)));

      // Create queued uploads
      const uploads = files.map(f => ({
        id: crypto.randomUUID(),
        file: f,
        options: { ...options, priority: options.priority || 1 },
        status: 'pending' as UploadStatus,
        progress: { loaded: 0, total: f.size, percent: 0 },
        attempts: 0,
        createdAt: new Date(),
      }));

      // Add to queue, sorted by priority
      uploadQueue.value = [...uploadQueue.value, ...uploads].sort(
        (a, b) => (b.options.priority || 0) - (a.options.priority || 0)
      );

      // Start processing queue
      processUploadQueue();

      // For single file upload, return single response
      if (!Array.isArray(file)) {
        const upload = uploads[0];
        return await new Promise<StorageResponse>((resolve, reject) => {
          upload.options.onComplete = resolve;
          upload.options.onError = reject;
        });
      }

      // For multiple files, wait for all to complete
      const responses = await Promise.all(
        uploads.map(
          upload =>
            new Promise<StorageResponse>((resolve, reject) => {
              upload.options.onComplete = resolve;
              upload.options.onError = reject;
            })
        )
      );

      return responses;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Upload failed';
      throw err;
    }
  };

  const downloadFile = async (
    path: string,
    bucket = 'default',
    retries = 3
  ): Promise<StorageResponse<Blob>> => {
    let attempt = 0;

    while (attempt < retries) {
      try {
        error.value = null;

        const { data, error: downloadError } = await client.storage.from(bucket).download(path);

        if (downloadError) throw downloadError;

        if (!data) {
          throw new Error('No data received from download');
        }

        return {
          success: true,
          data,
          path,
          bucket,
        };
      } catch (err) {
        attempt++;
        if (err instanceof Error || attempt === retries) {
          error.value = err instanceof Error ? err.message : 'Download failed';
          throw err;
        }
        // Wait before retrying with exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error('Download failed after maximum retries');
  };

  const listFiles = async (
    bucket = 'default',
    path = '',
    options?: {
      limit?: number;
      offset?: number;
      sortBy?: { column: string; order: 'asc' | 'desc' };
    }
  ): Promise<StorageResponse<StorageFile[]>> => {
    try {
      error.value = null;

      const { data, error: listError } = await client.storage.from(bucket).list(path, {
        limit: options?.limit,
        offset: options?.offset,
        sortBy: options?.sortBy,
      });

      if (listError) throw listError;

      if (!data) {
        return {
          success: true,
          data: [],
          path,
          bucket,
        };
      }

      // Transform to StorageFile format
      const files: StorageFile[] = data.map(file => ({
        id: `${bucket}/${path}/${file.name}`,
        name: file.name,
        size: file.metadata?.size || 0,
        type: getFileType({ type: file.metadata?.mimetype || '' } as File),
        url: getPublicUrl(`${path}/${file.name}`, bucket),
        metadata: {
          lastModified: new Date(file.metadata?.lastModified || Date.now()),
          etag: file.metadata?.etag || '',
          mimetype: file.metadata?.mimetype || '',
          customMetadata: file.metadata?.customMetadata,
          hash: file.metadata?.hash,
          path: `${path}/${file.name}`,
          bucket,
        },
      }));

      return {
        success: true,
        data: files,
        path,
        bucket,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'List failed';
      throw err;
    }
  };

  const deleteFile = async (
    path: string | string[],
    bucket = 'default'
  ): Promise<StorageResponse<{ message: string }>> => {
    try {
      error.value = null;
      const paths = Array.isArray(path) ? path : [path];

      const { error: deleteError } = await client.storage.from(bucket).remove(paths);

      if (deleteError) throw deleteError;

      return {
        success: true,
        data: {
          message:
            paths.length === 1
              ? `${paths[0]} deleted successfully`
              : `${paths.length} files deleted successfully`,
        },
        path: Array.isArray(path) ? undefined : path,
        bucket,
      };
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Delete failed';
      throw err;
    }
  };

  const getPublicUrl = (path: string, bucket = 'default'): string => {
    const { data } = client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const cancelUpload = (uploadId: string): boolean => {
    const queuedIndex = uploadQueue.value.findIndex(u => u.id === uploadId);
    if (queuedIndex > -1) {
      uploadQueue.value.splice(queuedIndex, 1);
      return true;
    }

    const activeUpload = activeUploads.value.find(u => u.id === uploadId);
    if (activeUpload) {
      activeUpload.status = 'cancelled';
      return true;
    }

    return false;
  };

  const getUploadStatus = (uploadId: string) => {
    const upload = [...uploadQueue.value, ...activeUploads.value].find(u => u.id === uploadId);
    return upload
      ? {
          status: upload.status,
          progress: upload.progress,
          attempts: upload.attempts,
        }
      : null;
  };

  const clearQueue = () => {
    uploadQueue.value = [];
    error.value = null;
  };

  const checkStorageQuota = async () => {
    try {
      const { data, error: quotaError } = await client
        .from('storage_quota')
        .select('quota_bytes, used_bytes')
        .single();

      if (quotaError) throw quotaError;

      if (data) {
        storageQuota.value = data.quota_bytes;
        usedStorage.value = data.used_bytes;
      }
    } catch (err) {
      console.error('Failed to fetch storage quota:', err);
    }
  };

  // Initialize
  onMounted(() => {
    checkStorageQuota();
  });

  return {
    // State
    isUploading: readonly(isUploading),
    error: readonly(error),
    uploadQueue: readonly(uploadQueue),
    activeUploads: readonly(activeUploads),
    storageQuota: readonly(storageQuota),
    usedStorage: readonly(usedStorage),

    // Computed
    queuedCount,
    totalProgress,
    availableStorage,

    // Core Methods
    uploadFile,
    downloadFile,
    listFiles,
    deleteFile,
    getPublicUrl,

    // Queue Management
    cancelUpload,
    getUploadStatus,
    clearQueue,

    // Utility Methods
    validateFile,
    getFileType,
    checkStorageQuota,
  };
};
