// server/api/minio/list.ts
import { createError, defineEventHandler, getQuery } from 'h3';
import { Client as MinioClient } from 'minio';

export default defineEventHandler(async (event) => {
  try {
    if (!event) throw new Error('Event is required');
    const config = useRuntimeConfig();
    const query = getQuery(event);
    const { bucket = 'default-bucket', prefix = '' } = query;    // Initialize MinIO client with runtime config
    const minio = new MinioClient({
      endPoint: config.minio.endpoint as string,
      port: Number(config.minio.port),
      useSSL: Boolean(config.minio.useSSL),
      accessKey: config.minio.accessKey as string,
      secretKey: config.minio.secretKey as string,
    });

    // Check if bucket exists
    const bucketExists = await minio.bucketExists(bucket as string);
    if (!bucketExists) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bucket not found',
      });
    }

    // List objects in bucket
    const objects: any[] = [];
    const stream = minio.listObjects(bucket as string, prefix as string, true);

    for await (const obj of stream) {
      objects.push({
        name: obj.name,
        size: obj.size,
        lastModified: obj.lastModified,
        etag: obj.etag,
      });
    }

    return {
      success: true,
      bucket,
      objects,
      count: objects.length,
    };
  } catch (error) {
    console.error('MinIO list error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list files from MinIO',
    });
  }
});
