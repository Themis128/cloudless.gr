import { createAuth0 } from '@auth0/auth0-vue';
import type { PublicRuntimeConfig } from '~/types/nuxt';

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();

  // Type-safe access to auth0 config
  const auth0Config = config.public.auth0 as PublicRuntimeConfig['auth0'];

  // Check if Auth0 is properly configured
  const isAuth0Configured = auth0Config.domain && auth0Config.clientId;

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

    // Provide auth0 availability status
    nuxtApp.provide('auth0Available', false);
    return;
  }

  try {
    const auth0 = createAuth0({
      domain: auth0Config.domain,
      clientId: auth0Config.clientId,
      authorizationParams: {
        redirect_uri: `${config.public.publicUrl}/auth/callback`,
        audience: auth0Config.audience || undefined,
      },
    });

    nuxtApp.vueApp.use(auth0);
    nuxtApp.provide('auth0Available', true);

    if (process.dev) {
      console.log('✅ Auth0 initialized successfully');
    }
  } catch (error) {
    console.error('❌ Failed to initialize Auth0:', error);
    nuxtApp.provide('auth0Available', false);
  }
});
