<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col cols="12" md="8">
        <v-card class="pa-6" elevation="4">
          <v-card-title class="text-h5 font-weight-bold">Contact Us</v-card-title>
          <v-card-text>
            <p class="mb-4">
              Have questions or need support? Reach out to the Cloudless GR team using the form below or email us at <a href="mailto:support@cloudless.gr">support@cloudless.gr</a>.
            </p>
            <v-form>
              <v-text-field label="Your Name" required class="mb-3" />
              <v-text-field label="Your Email" type="email" required class="mb-3" />
              <v-textarea label="Message" required class="mb-4" />
              <v-btn color="primary" type="submit">Send Message</v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default',
  title: 'Contact - Cloudless GR',
  description: 'Contact the Cloudless GR team for support, questions, or feedback.'
})
</script>

<style scoped>
p {
  font-size: 1.1rem;
}
</style>
