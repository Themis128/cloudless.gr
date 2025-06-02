<template>
  <v-sheet class="hero-section" color="transparent">
    <v-container>
      <v-row justify="center" align="center">
        <v-col cols="12" md="8" class="text-center py-12">
          <h1 class="text-h2 font-weight-bold mb-4 text-primary">Welcome to Cloudless</h1>
          <v-divider class="mb-6 mx-auto" width="100" color="primary"></v-divider>
          <p class="text-h6 mb-4">
            Cloudless provides cloud solutions, data analytics, and web development with secure
            hosting.
          </p>
          <p class="text-subtitle-1 mb-8">
            We help businesses scale, analyze data, and launch powerful digital products.
          </p>
          <div class="d-flex justify-center">
            <v-btn color="primary" size="large" class="mr-4" to="/contact"> Get Started </v-btn>
            <v-btn color="secondary" size="large" variant="outlined" to="/projects">
              View Projects
            </v-btn>
          </div>
        </v-col>
      </v-row>
    </v-container>
  </v-sheet>
</template>

<script setup>
// No additional logic needed
</script>

<style scoped>
.hero-section {
  min-height: 80vh;
  display: flex;
  align-items: center;
}
</style>
