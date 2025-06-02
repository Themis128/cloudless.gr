<template>
  <v-container class="services py-12">
    <v-row>
      <v-col cols="12" class="text-center mb-8">
        <h2 class="text-h3 font-weight-bold mb-3">Our Services</h2>
        <p class="text-subtitle-1">Discover what we can do for you.</p>
      </v-col>
    </v-row>

    <v-row>
      <v-col v-for="(service, index) in services" :key="index" cols="12" md="4" class="mb-6">
        <v-card height="100%" class="service-card">
          <v-card-item>
            <v-avatar
              :color="service.color"
              :icon="service.icon"
              size="x-large"
              class="mb-4"
            ></v-avatar>
            <v-card-title>{{ service.title }}</v-card-title>
          </v-card-item>

          <v-card-text>
            <p>{{ service.description }}</p>
          </v-card-text>

          <v-card-actions>
            <v-btn :to="service.link" color="primary" variant="text"> Learn More </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
// Service offerings data
const services = [
  {
    title: 'Web Development',
    description:
      'Custom web applications and websites built with modern frameworks like Vue.js, Nuxt, and Node.js.',
    icon: 'mdi-code-tags',
    color: 'primary',
    link: '/services/web-development',
  },
  {
    title: 'Cloud Solutions',
    description:
      'Secure, scalable cloud infrastructure and migration services for businesses of all sizes.',
    icon: 'mdi-cloud',
    color: 'info',
    link: '/services/cloud-solutions',
  },
  {
    title: 'Data Analytics',
    description:
      'Transform raw data into actionable insights with our advanced analytics solutions.',
    icon: 'mdi-chart-bar',
    color: 'success',
    link: '/services/data-analytics',
  },
];
</script>

<style scoped>
.service-card {
  transition: transform 0.3s;
}

.service-card:hover {
  transform: translateY(-5px);
}
</style>
