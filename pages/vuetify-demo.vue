<template>
  <div class="vuetify-demo-page">
    <v-container>
      <v-row>
        <v-col cols="12">
          <v-card class="mb-6">
            <v-card-title class="text-h3 font-weight-bold primary-text">
              Vuetify in Nuxt 3
            </v-card-title>
            <v-card-text>
              <p class="text-body-1">
                Vuetify is a Vue UI Library with beautifully handcrafted Material Components. This
                page demonstrates how to use Vuetify in your Nuxt 3 application.
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <v-card class="mb-6">
            <v-card-title class="text-h4">Key Features</v-card-title>
            <v-list>
              <v-list-item v-for="(feature, index) in features" :key="index">
                <v-list-item-title class="font-weight-medium">
                  <v-icon :icon="feature.icon" color="primary" class="me-2"></v-icon>
                  {{ feature.title }}
                </v-list-item-title>
                <v-list-item-subtitle>{{ feature.description }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>
        </v-col>
      </v-row>

      <v-row>
        <v-col cols="12">
          <!-- The Vuetify demo component we created earlier -->
          <Demo-VuetifyDemo />
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'vuetify',
  title: 'Vuetify Demo',
  description: 'Explore Vuetify components in a Nuxt 3 application',
});

// Features list
const features = [
  {
    title: 'Speed Up UI Development',
    description:
      'No need to build components from scratch — use ready-made components like VCard, VBtn, VDialog, etc.',
    icon: 'mdi-rocket-launch',
  },
  {
    title: 'Consistent Design Language',
    description: 'Uses Material Design standards out of the box for a polished look.',
    icon: 'mdi-palette',
  },
  {
    title: 'Responsive & Mobile-Ready',
    description:
      'Built-in support for breakpoints and flexible layout system for all screen sizes.',
    icon: 'mdi-responsive',
  },
  {
    title: 'Maintainable Codebase',
    description: "With reusable components and utility classes, it's easier to scale and maintain.",
    icon: 'mdi-cog-refresh',
  },
  {
    title: 'Customizability',
    description: 'Overwrite or extend any component to match your brand/style with theming system.',
    icon: 'mdi-palette-swatch',
  },
  {
    title: 'Dark Mode Ready',
    description: 'With one config, add dark mode toggle to your entire app.',
    icon: 'mdi-theme-light-dark',
  },
];
</script>

<style>
/* Additional custom styles if needed */
</style>
