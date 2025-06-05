// server/api/minio/delete.ts
import { createError, defineEventHandler, readBody } from 'h3';
import { Client as MinioClient } from 'minio';

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const body = await readBody(event);
    const { fileName, bucket = 'default-bucket' } = body;
    if (!fileName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing fileName',
      });
    }    // Initialize MinIO client with runtime config
    const minio = new MinioClient({
      endPoint: config.minio.endpoint as string,
      port: Number(config.minio.port),
      useSSL: Boolean(config.minio.useSSL),
      accessKey: config.minio.accessKey as string,
      secretKey: config.minio.secretKey as string,
    });

    // Check if bucket exists
    const bucketExists = await minio.bucketExists(bucket);
    if (!bucketExists) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bucket not found',
      });
    }

    // Delete file from MinIO
    await minio.removeObject(bucket, fileName);

    return {
      success: true,
      message: `${fileName} deleted successfully from ${bucket}`,
      fileName,
      bucket,
    };
  } catch (error) {
    console.error('MinIO delete error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete file from MinIO',
    });
  }
});
