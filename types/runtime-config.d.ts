declare module 'nitro/types' {
  interface NitroRuntimeConfig {
    minio: {
      endpoint: string;
      port: string;
      useSSL: string;
      accessKey: string;
      secretKey: string;
    };
  }
}

declare module '@nuxt/types' {
  interface PublicRuntimeConfig {
    auth0: {
      domain: string;
      clientId: string;
      audience: string;
    };
    publicUrl: string;
  }
}

export {};
