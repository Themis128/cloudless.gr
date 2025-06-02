/// <reference types="vite/client" />
/// <reference types="vue/macros-global" />

// Vue component declarations for TypeScript
declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

// Vuetify component type augmentations
declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    VApp: (typeof import('vuetify/components'))['VApp'];
    VAppBar: (typeof import('vuetify/components'))['VAppBar'];
    VBtn: (typeof import('vuetify/components'))['VBtn'];
    VCard: (typeof import('vuetify/components'))['VCard'];
    VCardText: (typeof import('vuetify/components'))['VCardText'];
    VCardTitle: (typeof import('vuetify/components'))['VCardTitle'];
    VCol: (typeof import('vuetify/components'))['VCol'];
    VContainer: (typeof import('vuetify/components'))['VContainer'];
    VDialog: (typeof import('vuetify/components'))['VDialog'];
    VDivider: (typeof import('vuetify/components'))['VDivider'];
    VIcon: (typeof import('vuetify/components'))['VIcon'];
    VImg: (typeof import('vuetify/components'))['VImg'];
    VList: (typeof import('vuetify/components'))['VList'];
    VListItem: (typeof import('vuetify/components'))['VListItem'];
    VMain: (typeof import('vuetify/components'))['VMain'];
    VNavigationDrawer: (typeof import('vuetify/components'))['VNavigationDrawer'];
    VRow: (typeof import('vuetify/components'))['VRow'];
    VSheet: (typeof import('vuetify/components'))['VSheet'];
    VTextField: (typeof import('vuetify/components'))['VTextField'];
    VTextarea: (typeof import('vuetify/components'))['VTextarea'];
  }

  export interface ComponentCustomProperties {
    $vuetify: import('vuetify').Framework;
  }
}

// Image and asset declarations
declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

// Environment variables type augmentation
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly NUXT_PUBLIC_SITE_URL: string;
  readonly NUXT_PUBLIC_SUPABASE_URL: string;
  readonly NUXT_PUBLIC_SUPABASE_KEY: string;
  // Add other env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Nuxt specific augmentations
declare module '#app' {
  interface PageMeta {
    title?: string;
    layout?: string;
    middleware?: string | string[];
    auth?: boolean;
  }
}
