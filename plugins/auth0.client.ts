import { createAuth0, type Auth0Plugin } from '@auth0/auth0-vue';
import type { NuxtApp } from 'nuxt/app';

type Auth0PluginReturn = {
  provide: {
    auth0: Auth0Plugin | null;
  };
};

interface _Auth0Config {
  domain?: string;
  clientId?: string;
  audience?: string;
}

export default defineNuxtPlugin((_nuxtApp: NuxtApp): Auth0PluginReturn => {
  // Get Auth0 configuration from runtime config
  const { auth0: auth0Config = {} as _Auth0Config } = useRuntimeConfig().public;

  // Log initialization in development
  if (process.dev) {
    console.log('🔐 Auth0 Plugin: Initializing...');
    console.log('📍 Runtime Config:', {
      domain: auth0Config.domain || 'Not set',
      clientId: auth0Config.clientId ? '****' : 'Not set',
      audience: auth0Config.audience || 'Not set',
    });
  }

  // Check if Auth0 is properly configured
  const isAuth0Configured = Boolean(auth0Config.domain) && Boolean(auth0Config.clientId);

  if (!isAuth0Configured) {
    // In development, provide helpful warnings
    if (process.dev) {
      console.warn('⚠️  Auth0 configuration is missing or incomplete.');
      console.warn('📋 Required environment variables:');
      console.warn('   - NUXT_AUTH0_DOMAIN');
      console.warn('   - NUXT_AUTH0_CLIENT_ID');
      console.warn('   - NUXT_AUTH0_AUDIENCE (optional)');
      console.warn('🔄 The app will run without authentication.');
    }
    // Return empty plugin when not configured
    return {
      provide: {
        auth0: null,
      },
    };
  }

  try {
    // Create Auth0 client with proper error handling for optional fields
    const auth0 = createAuth0({
      domain: auth0Config.domain || '',
      clientId: auth0Config.clientId || '',
      authorizationParams: {
        redirect_uri: process.client ? window.location.origin + '/auth/callback' : '',
        ...(auth0Config.audience ? { audience: auth0Config.audience } : {}),
      },
    });

    if (process.dev) {
      console.log('✅ Auth0 Plugin: Successfully initialized');
    }

    // Provide Auth0 client to the app
    return {
      provide: {
        auth0,
      },
    };
  } catch (error) {
    console.error('❌ Auth0 Plugin: Failed to initialize', error);
    return {
      provide: {
        auth0: null,
      },
    };
  }
});
