<template>
  <v-app>
    <v-main>
      <v-container fluid class="fill-height">
        <v-row justify="center" align="center">
          <v-col cols="12" sm="8" md="6" lg="4">
            <v-card class="elevation-12">
              <v-card-title class="text-center text-h4 primary--text">
                Cloudless.gr
              </v-card-title>
              <v-card-text class="text-center">
                <p class="text-body-1">
                  Welcome to your Vuetify 3 + Nuxt 3 application!
                </p>
                <v-btn
                  color="primary"
                  size="large"
                  class="mt-4"
                  @click="testVuetify"
                >
                  Test Vuetify
                </v-btn>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
const testVuetify = () => {
  console.log('Vuetify is working!')
  alert('Vuetify 3 is successfully configured!')
}
</script>

<style scoped>
.v-card {
  border-radius: 16px;
}
</style>
