import { createAuth0, type Auth0Plugin } from '@auth0/auth0-vue';
import type { PublicRuntimeConfig } from '~/types/nuxt';

type Auth0PluginReturn = {
  provide: {
    auth0: Auth0Plugin | null;
  };
};

export default defineNuxtPlugin((): Auth0PluginReturn => {
  const config = useRuntimeConfig();

  // Provide a fallback empty object for type safety
  const auth0Config = (config.public.auth0 ?? {}) as Partial<PublicRuntimeConfig['auth0']>;

  if (process.dev) {
    console.log('🔐 Auth0 Plugin: Initializing...');
    console.log('📍 Runtime Config:', {
      domain: auth0Config.domain || 'Not set',
      clientId: auth0Config.clientId ? '****' : 'Not set',
      audience: auth0Config.audience || 'Not set',
    });
  }

  // Check if Auth0 is properly configured
  const isAuth0Configured = !!auth0Config.domain && !!auth0Config.clientId;

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
    // Create Auth0 client
    const auth0 = createAuth0({
      domain: auth0Config.domain!,
      clientId: auth0Config.clientId!,
      authorizationParams: {
        redirect_uri: window.location.origin,
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
