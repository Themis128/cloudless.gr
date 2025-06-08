<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <h1 class="text-h3 mb-4">About Cloudless</h1>
          <p class="text-h6 mb-6">Building the future of cloud-native applications</p>
          
          <v-card class="mb-6">
            <v-card-title>Our Mission</v-card-title>
            <v-card-text>
              <p class="mb-4">
                Cloudless is a modern platform built with Nuxt 3 and Vuetify, designed to provide 
                seamless cloud-native application development and deployment experiences.
              </p>
              <p class="mb-4">
                We leverage cutting-edge technologies including Supabase for backend services,
                Docker for containerization, and advanced authentication systems.
              </p>
            </v-card-text>
          </v-card>

          <v-card>
            <v-card-title>Technology Stack</v-card-title>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-list>
                    <v-list-item>
                      <v-list-item-title>Frontend</v-list-item-title>
                      <v-list-item-subtitle>Nuxt 3, Vue 3, Vuetify, TypeScript</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Backend</v-list-item-title>
                      <v-list-item-subtitle>Supabase, PostgreSQL</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-col>
                <v-col cols="12" md="6">
                  <v-list>
                    <v-list-item>
                      <v-list-item-title>Infrastructure</v-list-item-title>
                      <v-list-item-subtitle>Docker, Nginx, Jenkins</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item>
                      <v-list-item-title>Monitoring</v-list-item-title>
                      <v-list-item-subtitle>Prometheus, Grafana</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'About Cloudless',
  description: 'Learn about our mission and technology stack'
})
</script>
