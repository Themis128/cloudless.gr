// plugins/vuetify.ts
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    components,
    directives,

    // Mobile-optimized display configuration
    display: {
      mobileBreakpoint: 'sm',
      thresholds: {
        xs: 0,
        sm: 600,
        md: 960,
        lg: 1264,
        xl: 1904,
      },
    },

    // Mobile-optimized theme
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          dark: false,
          colors: {
            // Material Design 3 color system
            primary: '#1976D2',
            'primary-darken-1': '#1565C0',
            secondary: '#424242',
            'secondary-darken-1': '#1F1F1F',
            accent: '#82B1FF',
            error: '#D32F2F',
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FF9800',

            // Surface colors for mobile
            surface: '#FFFFFF',
            'surface-bright': '#FFFFFF',
            'surface-variant': '#F5F5F5',
            'on-surface': '#1C1B1F',
            'on-surface-variant': '#49454F',

            // Background colors
            background: '#FAFAFA',
            'on-background': '#1C1B1F',

            // Outline colors
            outline: '#79747E',
            'outline-variant': '#CAC4D0',
          },
        },
        dark: {
          dark: true,
          colors: {
            // Dark theme optimized for mobile OLED displays
            primary: '#2196F3',
            'primary-darken-1': '#1976D2',
            secondary: '#BB86FC',
            'secondary-darken-1': '#985EFF',
            accent: '#82B1FF',
            error: '#F44336',
            info: '#03DAC6',
            success: '#4CAF50',
            warning: '#FF9800',

            // Dark surface colors
            surface: '#121212',
            'surface-bright': '#1F1F1F',
            'surface-variant': '#2C2C2C',
            'on-surface': '#E6E1E5',
            'on-surface-variant': '#CAC4D0',

            // Dark background colors
            background: '#000000',
            'on-background': '#E6E1E5',

            // Dark outline colors
            outline: '#938F99',
            'outline-variant': '#49454F',
          },
        },
      },
      variations: {
        colors: ['primary', 'secondary', 'accent'],
        lighten: 2,
        darken: 2,
      },
    },

    // Mobile-optimized defaults
    defaults: {
      global: {
        ripple: true,
        eager: true,
      },
      VBtn: {
        style: [
          {
            textTransform: 'none',
            letterSpacing: '0.0178571429em',
            minHeight: '44px',
          },
        ],
        rounded: 'lg',
        elevation: 1,
      },
      VCard: {
        rounded: 'lg',
        elevation: 2,
      },
      VTextField: {
        variant: 'outlined',
        density: 'comfortable',
        hideDetails: 'auto',
      },
      VSelect: {
        variant: 'outlined',
        density: 'comfortable',
        hideDetails: 'auto',
      },
      VTextarea: {
        variant: 'outlined',
        density: 'comfortable',
        hideDetails: 'auto',
      },
      VNavigationDrawer: {
        elevation: 2,
        width: 280,
      },
      VAppBar: {
        elevation: 1,
        height: 56,
      },
      VContainer: {
        fluid: true,
      },
      VDataTable: {
        density: 'comfortable',
        hover: true,
      },
      VDialog: {
        maxWidth: '600px',
        persistent: false,
        scrollable: true,
      },
      VBottomSheet: {
        inset: true,
      },
      VSpeedDial: {
        location: 'bottom end',
        transition: 'slide-y-reverse-transition',
      },
    },

    // Mobile-optimized icons
    icons: {
      defaultSet: 'mdi',
    },
  });

  nuxtApp.vueApp.use(vuetify);
});
