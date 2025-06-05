// server/api/minio/ping.ts
export default defineEventHandler(async () => {
  try {
    const config = useRuntimeConfig();

    // Dynamic import to avoid client-side issues
    const { Client } = await import('minio');    const minioClient = new Client({
      endPoint: config.minio.endpoint as string,
      port: Number(config.minio.port),
      useSSL: Boolean(config.minio.useSSL),
      accessKey: config.minio.accessKey as string,
      secretKey: config.minio.secretKey as string,
    });

    // Simple ping by trying to list buckets
    await minioClient.listBuckets();

    return {
      success: true,
      status: 'connected',
      endpoint: `${config.minio.useSSL ? 'https' : 'http'}://${config.minio.endpoint}:${config.minio.port}`,
      timestamp: new Date().toISOString(),
    };
  } catch (_error: any) {
    throw createError({
      statusCode: 503,
      statusMessage: 'MinIO service unavailable',
      data: {
        success: false,
        status: 'disconnected',
        error: _error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
});
