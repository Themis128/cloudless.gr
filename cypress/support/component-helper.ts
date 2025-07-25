// cypress/support/component-helper.ts
// Helper functions for component testing with Cypress

/**
 * This helper manages mounting Vue components with Nuxt-specific features
 * It automatically registers global components and plugins
 */

import { mount } from 'cypress/vue';
import { createPinia } from 'pinia';

interface MountOptions {
  props?: Record<string, any>;
  slots?: Record<string, string | (() => string)>;
  global?: {
    plugins?: any[];
    components?: Record<string, any>;
    mocks?: Record<string, any>;
    stubs?: Record<string, boolean>;
  };
}

// Create a Pinia store
const pinia = createPinia();

/**
 * Mount a Nuxt component with appropriate global plugins and components
 */
export function mountNuxtComponent(component: any, options: MountOptions = {}) {
  // Set up default global options
  options.global = options.global || {};
  options.global.plugins = options.global.plugins || [];
  options.global.components = options.global.components || {};
  
  // Add Pinia as a plugin
  options.global.plugins.push(pinia);
  
  // Add any mock composables or other Nuxt-specific features
  const mockNuxtComposables = {
    // Mock the useNuxtApp composable
    useNuxtApp: () => ({
      provide: () => {},
      vueApp: {
        component: () => {}
      }
    }),
    // Mock the navigateTo function
    navigateTo: cy.stub().as('navigateTo'),
    // Mock the useRoute composable
    useRoute: () => ({
      path: '/contact',
      params: {}
    })
  };
  
  options.global.mocks = { ...mockNuxtComposables, ...options.global.mocks };
  
  // Mount the component with all the options
  return mount(component, options);
}
