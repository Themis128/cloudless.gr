<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <h1 class="text-h3 mb-4">Contact Us</h1>
          <p class="text-h6 mb-6">Get in touch with our team</p>
          
          <v-row>
            <v-col cols="12" md="6">
              <v-card>
                <v-card-title>Contact Information</v-card-title>
                <v-card-text>
                  <v-list>
                    <v-list-item prepend-icon="mdi-email">
                      <v-list-item-title>Email</v-list-item-title>
                      <v-list-item-subtitle>admin@cloudless.gr</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item prepend-icon="mdi-web">
                      <v-list-item-title>Website</v-list-item-title>
                      <v-list-item-subtitle>cloudless.gr</v-list-item-subtitle>
                    </v-list-item>
                    <v-list-item prepend-icon="mdi-clock">
                      <v-list-item-title>Support Hours</v-list-item-title>
                      <v-list-item-subtitle>24/7 Online Support</v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>
            
            <v-col cols="12" md="6">
              <v-card>
                <v-card-title>Send Message</v-card-title>
                <v-card-text>
                  <v-form>
                    <v-text-field
                      label="Name"
                      variant="outlined"
                      class="mb-4"
                    />
                    <v-text-field
                      label="Email"
                      type="email"
                      variant="outlined"
                      class="mb-4"
                    />
                    <v-textarea
                      label="Message"
                      variant="outlined"
                      rows="4"
                      class="mb-4"
                    />
                    <v-btn color="primary" size="large" block>
                      Send Message
                    </v-btn>
                  </v-form>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'Contact Us',
  description: 'Get in touch with our team'
})
</script>
