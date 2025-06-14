<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="pa-6" elevation="4">
          <v-card-title class="text-h5 font-weight-bold">
            Welcome to the Info Center
          </v-card-title>
          <v-card-text>
            <p class="mb-4">
              Here you'll find helpful pages like the FAQ, Sitemap, and other general information about the Cloudless platform.
            </p>

            <v-list>
              <v-list-item
                v-for="item in links"
                :key="item.link"
                :to="item.link"
                link
              >
                <v-list-item-title>{{ item.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ item.description }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
const links = [
  {
    name: 'Frequently Asked Questions (FAQ)',
    link: '/info/faq',
    description: 'Common questions and answers about the platform.',
  },
  {
    name: 'Sitemap',
    link: '/info/sitemap',
    description: 'View the structure and available pages of the site.',
  },
  {
    name: 'Contact Support',
    link: '/contact',
    description: 'Need help? Reach out to our support team.',
  },
]
</script>

<style scoped>
p {
  font-size: 1.1rem;
}
</style>
