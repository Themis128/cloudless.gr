// plugins/vuetify.ts
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    directives,
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary: '#3B82F6',
            'primary-darken-1': '#2563EB',
            secondary: '#10B981',
            'secondary-darken-1': '#059669',
            accent: '#8B5CF6',
            'accent-darken-1': '#7C3AED',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6',
            success: '#10B981',
            background: '#FFFFFF',
            surface: '#FFFFFF',
            'surface-variant': '#F3F4F6',
          },
        },
        dark: {
          colors: {
            primary: '#3B82F6',
            'primary-darken-1': '#2563EB',
            secondary: '#10B981',
            'secondary-darken-1': '#059669',
            accent: '#8B5CF6',
            'accent-darken-1': '#7C3AED',
            error: '#EF4444',
            warning: '#F59E0B',
            info: '#3B82F6',
            success: '#10B981',
            background: '#121212',
            surface: '#1E1E1E',
            'surface-variant': '#2D2D2D',
          },
        },
      },
      variations: {
        colors: ['primary', 'secondary', 'accent'],
        lighten: 4,
        darken: 4,
      },
    },
  });

  nuxtApp.vueApp.use(vuetify);
});
