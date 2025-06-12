<template>
  <v-container class="py-10">
    <v-card>
      <v-card-title>Contact Us</v-card-title>
      <v-card-text>
        <v-form>
          <v-text-field label="Your Name" required />
          <v-text-field label="Email" type="email" required />
          <v-textarea label="Message" rows="4" required />
          <v-btn color="primary" class="mt-4">Send Message</v-btn>
        </v-form>
      </v-card-text>
    </v-card>
  </v-container>
</template>
