import { createVuetify } from 'vuetify'
import 'vuetify/styles'
import { defineNuxtPlugin } from 'nuxt/app'

// Import only essential components to reduce loading time
import {
  VApp,
  VMain,
  VContainer,
  VRow,
  VCol,
  VCard,
  VCardTitle,
  VCardText,
  VBtn,
  VTextField,
  VSelect,
  VTextarea,
  VAlert,
  VSnackbar,
  VDialog,
  VToolbar,
  VToolbarTitle,
  VNavigationDrawer,
  VList,
  VListItem,
  VListItemTitle,
  VDivider,
  VSpacer,
  VIcon,
  VProgressLinear,
  VSheet,
  VGrid,
  VFlex,
  VLayout,
} from 'vuetify/components'

// Import only essential directives
import { Ripple, Resize } from 'vuetify/directives'

export default defineNuxtPlugin(nuxtApp => {
  // Prevent duplicate Vuetify initialization
  if (nuxtApp.vueApp._context.provides['vuetify']) {
    return
  }

  const vuetify = createVuetify({
    components: {
      VApp,
      VMain,
      VContainer,
      VRow,
      VCol,
      VCard,
      VCardTitle,
      VCardText,
      VBtn,
      VTextField,
      VSelect,
      VTextarea,
      VAlert,
      VSnackbar,
      VDialog,
      VToolbar,
      VToolbarTitle,
      VNavigationDrawer,
      VList,
      VListItem,
      VListItemTitle,
      VDivider,
      VSpacer,
      VIcon,
      VProgressLinear,
      VSheet,
      VGrid,
      VFlex,
      VLayout,
    },
    directives: {
      Ripple,
      Resize,
    },
    icons: {
      defaultSet: 'mdi',
    },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          colors: {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#f093fb',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196f3',
            success: '#4caf50',
            surface: '#ffffff',
            background: '#f5f5f5',
          },
        },
        dark: {
          colors: {
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#f093fb',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196f3',
            success: '#4caf50',
            surface: '#1e1e1e',
            background: '#121212',
          },
        },
      },
    },
    defaults: {
      VBtn: {
        variant: 'elevated',
        color: 'primary',
        rounded: 'lg',
        class: 'text-none',
      },
      VCard: {
        variant: 'elevated',
        rounded: 'lg',
      },
      VTextField: {
        variant: 'outlined',
        rounded: 'lg',
      },
      VSelect: {
        variant: 'outlined',
        rounded: 'lg',
      },
      VTextarea: {
        variant: 'outlined',
        rounded: 'lg',
      },
      VAlert: {
        rounded: 'lg',
      },
      VSnackbar: {
        rounded: 'lg',
      },
      VDialog: {
        rounded: 'lg',
      },
    },
    display: {
      mobileBreakpoint: 'sm',
      thresholds: {
        xs: 0,
        sm: 340,
        md: 540,
        lg: 800,
        xl: 1280,
      },
    },
  })

  nuxtApp.vueApp.use(vuetify)
})
