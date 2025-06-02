// server/api/minio/upload.ts
import { createError, defineEventHandler, readBody } from 'h3';
import { Client as MinioClient } from 'minio';

export default defineEventHandler(async (_event) => {
  try {
    const config = useRuntimeConfig();
    const body = await readBody(_event);
    const { fileName, fileContent, bucket = 'default-bucket' } = body;

    if (!fileName || !fileContent) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing fileName or fileContent',
      });
    } // Initialize MinIO client with runtime config
    const minio = new MinioClient({
      endPoint: config.minio.endpoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });

    // Ensure the bucket exists
    const bucketExists = await minio.bucketExists(bucket);
    if (!bucketExists) {
      await minio.makeBucket(bucket);
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(fileContent, 'base64');

    // Upload file to MinIO
    await minio.putObject(bucket, fileName, buffer);

    return {
      success: true,
      message: `${fileName} uploaded successfully to ${bucket}`,
      fileName,
      bucket,
    };
  } catch (error) {
    console.error('MinIO upload error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upload file to MinIO',
    });
  }
});
