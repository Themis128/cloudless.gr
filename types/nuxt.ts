export interface PublicRuntimeConfig {
  auth0: {
    domain: string;
    clientId: string;
    audience?: string;
  };
  supabaseUrl: string;
  supabaseAnonKey: string;
}
