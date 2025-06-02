// server/api/minio/download.ts
import { createError, defineEventHandler, getQuery } from 'h3';
import { Client as MinioClient } from 'minio';

export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig();
    const query = getQuery(event);
    const { fileName, bucket = 'default-bucket' } = query;
    if (!fileName) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing fileName parameter',
      });
    }

    // Initialize MinIO client with runtime config
    const minio = new MinioClient({
      endPoint: config.minio.endpoint,
      port: Number(config.minio.port),
      useSSL: Boolean(config.minio.useSSL),
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });

    // Check if bucket exists
    const bucketExists = await minio.bucketExists(bucket as string);
    if (!bucketExists) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Bucket not found',
      });
    }

    // Get file from MinIO
    const stream = await minio.getObject(bucket as string, fileName as string);

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Return file as base64
    return {
      success: true,
      fileName,
      bucket,
      fileContent: buffer.toString('base64'),
      contentType: 'application/octet-stream', // You might want to determine this based on file extension
    };
  } catch (error) {
    console.error('MinIO download error:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to download file from MinIO',
    });
  }
});
