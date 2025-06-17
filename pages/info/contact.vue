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
import { ref } from 'vue'
import { useContactForm } from '@/composables/useContactForm'
import { useSupabase } from '@/composables/useSupabase'

definePageMeta({
  layout: 'default',
  title: 'Contact - Cloudless GR',
  description: 'Contact the Cloudless GR team for support, questions, or feedback.'
})

const {
  name,
  email,
  message,
  errorMsg,
  submitting,
  form,
  formValid,
  reset
} = useContactForm()

const showSuccess = ref(false)
const supabase = useSupabase()

async function onSubmit() {
  submitting.value = true
  errorMsg.value = ''
  try {
    const { error } = await supabase.from('contact_messages').insert([
      {
        name: name.value,
        email: email.value,
        message: message.value
      }
    ])
    if (error) {
      errorMsg.value = 'Failed to send message. Please try again.'
    } else {
      showSuccess.value = true
      reset()
    }
  } catch (e) {
    console.error('Error submitting contact form:', e)
    errorMsg.value = 'Unexpected error. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
p {
  font-size: 1.1rem;
}
</style>
