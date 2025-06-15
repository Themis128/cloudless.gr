<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8">
        <v-card class="glass-card pa-6" elevation="0">
          <v-card-title class="text-h5 font-weight-bold white--text">
            Welcome to the Info Center
          </v-card-title>

          <v-card-text>
            <p class="intro-text mb-6">
              Access helpful pages about Cloudless GR: FAQs, contact, sitemap, and more.
            </p>

            <v-list nav class="glass-list">
              <v-list-item
                v-for="item in links"
                :key="item.link"
                :to="item.link"
                link
              >
                <template #prepend>
                  <v-icon color="white" class="me-3">{{ item.icon }}</v-icon>
                </template>
                <v-list-item-content>
                  <v-list-item-title class="white--text">{{ item.name }}</v-list-item-title>
                  <v-list-item-subtitle class="text-light">{{ item.description }}</v-list-item-subtitle>
                </v-list-item-content>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const links = [
  { name: 'About Us', link: '/info/about', description: 'Our mission and story.', icon: 'mdi-information-outline' },
  { name: 'FAQ', link: '/info/faq', description: 'Common questions answered.', icon: 'mdi-help-circle-outline' },
  { name: 'Contact', link: '/info/contact', description: 'Get support and reach us.', icon: 'mdi-email-outline' },
  { name: 'Platform Matrix', link: '/info/matrix', description: 'See how it all connects.', icon: 'mdi-chart-box-outline' },
  { name: 'Sitemap', link: '/info/sitemap', description: 'Browse the full site map.', icon: 'mdi-sitemap-outline' },
]
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 12px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
  color: white;
  position: relative;
  z-index: 10; /* Ensures card is above background */
}

.intro-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.v-list-item-title {
  font-weight: 500;
  font-size: 1rem;
}

.v-list-item-subtitle {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6);
}

.v-icon {
  opacity: 0.85;
}

/* Glass effect for the list */
.glass-list {
  position: relative;
  z-index: 5; /* Ensure list is above any background */
}

/* General Page Styling */
body {
  background: #121212; /* Dark background for better contrast */
}
</style>
