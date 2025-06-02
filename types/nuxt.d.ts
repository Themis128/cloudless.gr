// types/nuxt.d.ts
export interface PublicRuntimeConfig {
  auth0: {
    domain: string;
    clientId: string;
    audience: string;
  };
  publicUrl: string;
}

export interface PrivateRuntimeConfig {
  minio: {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
  };
}

declare module 'nuxt/schema' {
  interface RuntimeConfig extends PrivateRuntimeConfig {
    public: PublicRuntimeConfig;
  }
}

export {};
