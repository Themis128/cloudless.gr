<template>
  <v-sheet class="mx-auto max-width-md" color="transparent">
    <v-container>
      <v-row justify="center">
        <v-col cols="12" sm="10" md="8">
          <v-card class="pa-4" variant="flat">
            <v-card-text class="text-body-1 text-center">
              <p>
                Cloudless is a modern technology company specializing in cloud computing, data
                analytics, and full-stack web development. We help businesses scale efficiently,
                gain actionable insights, and launch high-performance web platforms with secure,
                scalable hosting.
              </p>
            </v-card-text>

            <v-divider class="my-4"></v-divider>

            <v-card-text class="text-center">
              <v-icon icon="mdi-cloud-outline" size="large" color="primary" class="mb-2"></v-icon>
              <p class="text-subtitle-1 font-weight-medium">
                Building tomorrow's cloud solutions today.
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </v-sheet>
</template>

<script setup>
// No props needed now – static content only
</script>

<style scoped>
.max-width-md {
  max-width: 800px;
}
</style>
