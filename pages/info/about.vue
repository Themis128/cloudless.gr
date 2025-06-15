<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" sm="10" md="8">
        <v-card class="glass-card pa-6" elevation="3">
          <v-card-title class="text-h5 font-weight-bold white--text">
            About Cloudless
          </v-card-title>

          <v-card-text class="text-body-1">
            <p>
              <strong>Cloudless</strong> is a modular and developer-centric LLM agent platform crafted using
              modern technologies like <strong>Nuxt 3</strong>, <strong>Supabase</strong>, and <strong>Vuetify 3</strong>.
            </p>

            <p>
              Our mission is to empower developers with tools that are:
            </p>

            <v-list dense>
              <v-list-item>
                <v-list-item-icon><v-icon>mdi-check-circle</v-icon></v-list-item-icon>
                <v-list-item-title>Modern</v-list-item-title>
              </v-list-item>

              <v-list-item>
                <v-list-item-icon><v-icon>mdi-check-circle</v-icon></v-list-item-icon>
                <v-list-item-title>Accessible</v-list-item-title>
              </v-list-item>

              <v-list-item>
                <v-list-item-icon><v-icon>mdi-check-circle</v-icon></v-list-item-icon>
                <v-list-item-title>Scalable</v-list-item-title>
              </v-list-item>
            </v-list>

            <p>
              Cloudless is designed with community collaboration in mind. It’s an open-source initiative that encourages contributions from developers worldwide, aiming to provide a solid, extensible foundation for rapidly building and deploying <strong>LLM-driven applications</strong>.
            </p>

            <p>
              Whether you're a beginner exploring AI or a seasoned engineer building cutting-edge tools, Cloudless is here to accelerate your journey from concept to production.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
</script>

<style scoped>
.glass-card {
  background: rgba(255, 255, 255, 0.08); /* Semi-transparent background */
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(16px); /* Glass blur effect */
  -webkit-backdrop-filter: blur(16px); /* For Safari support */
  border-radius: 12px;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.2);
  color: white;
  position: relative;
  z-index: 10; /* Ensures the card appears above other elements */
}

.text-body-1 {
  color: rgba(255, 255, 255, 0.85); /* Text color for better contrast */
}

.white--text {
  color: white; /* Ensure the title text is white */
}

.v-list-item-title {
  font-weight: 500;
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.9); /* Slightly lighter text for the items */
}

.v-list-item-subtitle {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.6); /* Subtle text color for descriptions */
}

.v-icon {
  opacity: 0.85;
}

.intro-text {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Optional: add a background image to make the content more engaging */
body {
  background: url('/path-to-your-background-image.jpg') no-repeat center center fixed;
  background-size: cover;
}
</style>
