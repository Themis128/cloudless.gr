<template>
  <v-container class="py-12">
    <v-row justify="center">
      <v-col
        cols="12"
        md="5"
        lg="4"
        xl="3"
      >
        <v-card class="pa-4 glassmorph contact-card-sm" elevation="4">
          <v-card-title class="text-h5 font-weight-bold">Contact Us</v-card-title>
          <v-card-text>

            <v-form ref="form" v-model="formValid" @submit.prevent="onSubmit">
              <v-text-field
                v-model="name"
                label="Your Name"
                required
                class="mb-3"
              />
              <v-text-field
                v-model="email"
                label="Your Email"
                type="email"
                required
                class="mb-3"
              />
              <v-textarea
                v-model="message"
                label="Message"
                required
                class="mb-4"
              />
              <v-btn color="primary" type="submit" :loading="submitting">Send Message</v-btn>
              <v-btn
                text
                type="button"
                class="ml-2"
                @click="reset"
              >Reset</v-btn>
              <div v-if="errorMsg" class="text-error mt-2">{{ errorMsg }}</div>
            </v-form>
            <v-dialog v-model="showSuccess" max-width="400">
              <v-card>
                <v-card-title class="text-success font-weight-bold">Message Sent!</v-card-title>
                <v-card-text>
                  Thank you for contacting us! We will get back to you soon.
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn color="primary" @click="showSuccess = false">OK</v-btn>
                </v-card-actions>
              </v-card>
            </v-dialog>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useContactForm } from '@/composables/useContactForm';
import { useSupabase } from '@/composables/useSupabase';
import { ref } from 'vue';

definePageMeta({
  layout: 'default',
  title: 'Contact - Cloudless GR',
  description: 'Contact the Cloudless GR team for support, questions, or feedback.',
});

const { name, email, message, errorMsg, submitting, form, formValid, reset } = useContactForm();

const showSuccess = ref(false);
const supabase = useSupabase();


async function onSubmit() {
  submitting.value = true;
  errorMsg.value = '';
  try {
    const { error } = await supabase
      .from('contact_messages')
      .insert([
        {
          name: name.value,
          email: email.value,
          message: message.value,
        },
      ] as any);
    if (error) {
      errorMsg.value = 'Failed to send message. Please try again.';
    } else {
      showSuccess.value = true;
      reset();
    }
  } catch (e) {
    console.error('Error submitting contact form:', e);
    errorMsg.value = 'Unexpected error. Please try again.';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
p {
  font-size: 1.1rem;
}
</style>

<style scoped>
.contact-card-sm {
  max-width: 380px;
  margin: 0 auto;
}
</style>
