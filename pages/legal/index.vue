
<template>
  <v-container class="legal-page" fluid>
    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="pa-8 elevation-8 rounded-xl legal-index-card">
          <div class="legal-content text-center">
            <h1 class="text-h3 font-weight-bold primary--text mb-8">Legal Information</h1>
            <v-row class="justify-center" dense>
              <v-col
                cols="12"
                sm="6"
                md="6"
                lg="6"
                xl="6"
                class="mb-4"
              >
                <v-card class="pa-4 legal-link-card" variant="outlined">
                  <v-icon color="primary" size="36" class="mb-2">mdi-shield-account</v-icon>
                  <NuxtLink to="/legal/privacy" class="text-primary text-h6 font-weight-medium">Privacy Policy</NuxtLink>
                  <div class="text-caption mt-2">How we collect, use, and protect your data.</div>
                </v-card>
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="6"
                lg="6"
                xl="6"
                class="mb-4"
              >
                <v-card class="pa-4 legal-link-card" variant="outlined">
                  <v-icon color="primary" size="36" class="mb-2">mdi-cookie</v-icon>
                  <NuxtLink to="/legal/cookies" class="text-primary text-h6 font-weight-medium">Cookie Policy</NuxtLink>
                  <div class="text-caption mt-2">Details about cookies and your preferences.</div>
                </v-card>
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="6"
                lg="6"
                xl="6"
                class="mb-4"
              >
                <v-card class="pa-4 legal-link-card" variant="outlined">
                  <v-icon color="primary" size="36" class="mb-2">mdi-lock-alert</v-icon>
                  <NuxtLink to="/legal/security" class="text-primary text-h6 font-weight-medium">Security Policy</NuxtLink>
                  <div class="text-caption mt-2">Our commitment to keeping your data safe.</div>
                </v-card>
              </v-col>
              <v-col
                cols="12"
                sm="6"
                md="6"
                lg="6"
                xl="6"
                class="mb-4"
              >
                <v-card class="pa-4 legal-link-card" variant="outlined">
                  <v-icon color="primary" size="36" class="mb-2">mdi-file-document-edit</v-icon>
                  <NuxtLink to="/legal/terms" class="text-primary text-h6 font-weight-medium">Terms of Service</NuxtLink>
                  <div class="text-caption mt-2">Rules and conditions for using Cloudless.</div>
                </v-card>
              </v-col>
            </v-row>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'auth',
})
</script>

<style scoped>
.legal-page {
  max-width: 1200px;
  margin: 0 auto;
}
.legal-content {
  line-height: 1.7;
}
.legal-index-card {
  background: rgba(255,255,255,0.85);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
  border-radius: 24px;
}
.legal-link-card {
  transition: box-shadow 0.2s, border-color 0.2s;
  cursor: pointer;
}
.legal-link-card:hover {
  box-shadow: 0 4px 24px 0 rgba(31, 38, 135, 0.12);
  border-color: rgb(var(--v-theme-primary));
}
.text-primary {
  color: rgb(var(--v-theme-primary));
}
</style>
