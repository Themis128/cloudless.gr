/**
 * Advanced Secrets Management Utility
 * Handles loading secrets from multiple sources with fallback hierarchy
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export interface SecretsConfig {
  source: 'docker-secrets' | 'env-file' | 'vault' | 'azure-keyvault';
  priority: number;
  enabled: boolean;
}

export class SecretsManager {
  private static instance: SecretsManager;
  private secrets: Map<string, string> = new Map();
  private sources: SecretsConfig[] = [];

  private constructor() {
    this.initializeSources();
    this.loadSecrets();
  }

  static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  private initializeSources() {
    const sourcesEnv = process.env.SECRETS_SOURCE || 'docker-secrets,env-file';
    const enabledSources = sourcesEnv.split(',').map((s) => s.trim());

    this.sources = [
      {
        source: 'docker-secrets' as const,
        priority: 1,
        enabled: enabledSources.includes('docker-secrets'),
      },
      {
        source: 'env-file' as const,
        priority: 2,
        enabled: enabledSources.includes('env-file'),
      },
      {
        source: 'vault' as const,
        priority: 3,
        enabled: enabledSources.includes('vault'),
      },
      {
        source: 'azure-keyvault' as const,
        priority: 4,
        enabled: enabledSources.includes('azure-keyvault'),
      },
    ]
      .filter((source) => source.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  private loadSecrets() {
    for (const source of this.sources) {
      try {
        switch (source.source) {
          case 'docker-secrets':
            this.loadDockerSecrets();
            break;
          case 'env-file':
            this.loadEnvFileSecrets();
            break;
          case 'vault':
            this.loadVaultSecrets();
            break;
          case 'azure-keyvault':
            this.loadAzureKeyVaultSecrets();
            break;
        }
      } catch (error) {
        console.warn(`Failed to load secrets from ${source.source}:`, error);
      }
    }
  }

  private loadDockerSecrets() {
    const secretsDir = process.env.DOCKER_SECRETS_DIR || '/run/secrets';

    if (!existsSync(secretsDir)) {
      return;
    }

    // Common Docker secret file names
    const secretFiles = [
      'postgres_user',
      'postgres_password',
      'redis_password',
      'minio_root_user',
      'minio_root_password',
      'jwt_secret',
      'session_secret',
      'secret_key',
      'supabase_anon_key',
      'supabase_service_key',
      'smtp_password',
      'sentry_dsn',
      'datadog_api_key',
    ];

    for (const secretFile of secretFiles) {
      const secretPath = join(secretsDir, secretFile);
      if (existsSync(secretPath)) {
        try {
          const secret = readFileSync(secretPath, 'utf8').trim();
          const envVarName = secretFile.toUpperCase();
          this.secrets.set(envVarName, secret);

          // Also set in process.env for immediate access
          if (!process.env[envVarName]) {
            process.env[envVarName] = secret;
          }
        } catch (error) {
          console.warn(`Failed to read Docker secret ${secretFile}:`, error);
        }
      }
    }
  }

  private loadEnvFileSecrets() {
    // This is handled by dotenv, but we can add additional logic here
    // for expanded environment variables using dotenv-expand

    const secretEnvVars = [
      'POSTGRES_PASSWORD',
      'REDIS_PASSWORD',
      'MINIO_ROOT_PASSWORD',
      'JWT_SECRET',
      'SESSION_SECRET',
      'NUXT_SECRET_KEY',
      'NUXT_SUPABASE_ANON_KEY',
      'NUXT_SUPABASE_SERVICE_KEY',
      'SMTP_PASSWORD',
      'SENTRY_DSN',
      'DATADOG_API_KEY',
    ];

    for (const envVar of secretEnvVars) {
      const value = process.env[envVar];
      if (value && !this.secrets.has(envVar)) {
        this.secrets.set(envVar, value);
      }
    }
  }

  private async loadVaultSecrets() {
    // HashiCorp Vault integration
    const vaultAddr = process.env.VAULT_ADDR;
    const vaultToken = process.env.VAULT_TOKEN;
    const secretPath = process.env.VAULT_SECRET_PATH || 'secret/cloudless/dev';

    if (!vaultAddr || !vaultToken) {
      return;
    }

    try {
      // This would require vault client library in a real implementation
      console.log('Vault secrets loading is configured but not implemented in this demo');
      // const vault = new VaultClient({ endpoint: vaultAddr, token: vaultToken });
      // const secrets = await vault.read(secretPath);
      // for (const [key, value] of Object.entries(secrets.data)) {
      //   this.secrets.set(key.toUpperCase(), value as string);
      // }
    } catch (error) {
      console.warn('Failed to load Vault secrets:', error);
    }
  }

  private async loadAzureKeyVaultSecrets() {
    // Azure Key Vault integration
    const keyVaultUrl = process.env.AZURE_KEYVAULT_URL;

    if (!keyVaultUrl) {
      return;
    }

    try {
      // This would require Azure SDK in a real implementation
      console.log('Azure Key Vault secrets loading is configured but not implemented in this demo');
      // const credential = new DefaultAzureCredential();
      // const client = new SecretClient(keyVaultUrl, credential);
      // const secretNames = ['postgres-password', 'jwt-secret', 'session-secret'];
      // for (const secretName of secretNames) {
      //   const secret = await client.getSecret(secretName);
      //   this.secrets.set(secretName.replace('-', '_').toUpperCase(), secret.value!);
      // }
    } catch (error) {
      console.warn('Failed to load Azure Key Vault secrets:', error);
    }
  }

  getSecret(key: string): string | undefined {
    return this.secrets.get(key) || process.env[key];
  }

  getAllSecrets(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of this.secrets) {
      result[key] = value;
    }
    return result;
  }

  hasSecret(key: string): boolean {
    return this.secrets.has(key) || !!process.env[key];
  }

  getSecretsInfo(): { source: string; count: number }[] {
    return this.sources.map((source) => ({
      source: source.source,
      count: Array.from(this.secrets.keys()).length,
    }));
  }
}

// Export singleton instance
export const secretsManager = SecretsManager.getInstance();

// Helper function for easy access
export function getSecret(key: string, defaultValue?: string): string {
  return secretsManager.getSecret(key) || defaultValue || '';
}

// Type-safe secret getters for common secrets
export const secrets = {
  database: {
    url: () => getSecret('NUXT_DATABASE_URL'),
    user: () => getSecret('POSTGRES_USER'),
    password: () => getSecret('POSTGRES_PASSWORD'),
    host: () => getSecret('POSTGRES_HOST', 'localhost'),
    port: () => parseInt(getSecret('POSTGRES_PORT', '5432')),
    name: () => getSecret('POSTGRES_DB', 'cloudless'),
  },
  redis: {
    url: () => getSecret('NUXT_REDIS_URL'),
    host: () => getSecret('REDIS_HOST', 'localhost'),
    port: () => parseInt(getSecret('REDIS_PORT', '6379')),
    password: () => getSecret('REDIS_PASSWORD'),
  },
  app: {
    secretKey: () => getSecret('NUXT_SECRET_KEY'),
    jwtSecret: () => getSecret('JWT_SECRET'),
    sessionSecret: () => getSecret('SESSION_SECRET'),
  },
  external: {
    supabaseUrl: () => getSecret('NUXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: () => getSecret('NUXT_SUPABASE_ANON_KEY'),
    supabaseServiceKey: () => getSecret('NUXT_SUPABASE_SERVICE_KEY'),
    sentryDsn: () => getSecret('SENTRY_DSN'),
    datadogApiKey: () => getSecret('DATADOG_API_KEY'),
  },
};
