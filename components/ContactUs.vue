<template>
  <div class="contact-flip-card">
    <div :class="['flip-card-inner', { flipped: isFlipped }]">
      <!-- Front Side: Contact Form -->
      <div class="flip-card-front">
        <v-card elevation="4" class="pa-4">
          <v-card-title>Contact Us</v-card-title>
          <v-card-text>
            <v-form ref="form" v-model="formValid" @submit.prevent="handleSubmit">
              <v-text-field
                v-model="name"
                label="Name"
                required
                :rules="[v => !!v || 'Name is required']"
              />
              <v-text-field
                v-model="email"
                label="Email"
                required
                type="email"
                :rules="[v => !!v || 'Email is required']"
              />
              <v-textarea
                v-model="message"
                label="Message"
                required
                :rules="[v => !!v || 'Message is required']"
              />
              <div aria-live="assertive">
                <v-alert v-if="errorMsg" type="error" class="mt-2">{{ errorMsg }}</v-alert>
                <v-alert v-if="successMsg" type="success" class="mt-2">{{ successMsg }}</v-alert>
              </div>
              <v-btn
                type="submit"
                color="primary"
                :disabled="submitting || !formValid"
                :loading="submitting"
              >
                Send Message
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </div>
      <!-- Back Side: Thank You / Socials -->
      <div class="flip-card-back">
        <v-card elevation="4" class="pa-4 text-center">
          <v-card-title>Thank You!</v-card-title>
          <v-card-text>
            <div>We'll get back to you soon.</div>
            <div class="mt-4">
              <span v-for="item in socialWithIcons" :key="item.name" class="mx-2">
                <a
                  :href="item.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  :aria-label="item.aria || item.name"
                >
                  <FontAwesomeIcon :icon="item.iconObj" :style="{ color: item.color || '#333', fontSize: '1.5rem' }" />
                </a>
              </span>
            </div>
            <v-btn
              aria-label="Go back to contact form"
              color="primary"
              size="small"
              variant="text"
              @click="isFlipped = false"
            >Back</v-btn>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { faTwitter, faGithub, faLinkedin } from '@fortawesome/free-brands-svg-icons'
import { useContactInfo } from '@/composables/useContactInfo'
import { useSupabase } from '@/composables/useSupabase'

const name = ref('')
const email = ref('')
const message = ref('')
const errorMsg = ref('')
const successMsg = ref('')
const submitting = ref(false)
const isFlipped = ref(false)
const form = ref()
const formValid = ref(true)

const contact = useContactInfo()
const iconMap = { faTwitter, faGithub, faLinkedin }
const socialWithIcons = computed(() => contact.social.map(item => ({
  ...item,
  iconObj: iconMap[item.icon as keyof typeof iconMap]
})))

const supabase = useSupabase()

async function handleSubmit() {
  errorMsg.value = ''
  successMsg.value = ''
  submitting.value = true
  // Validate form
  const valid = await form.value?.validate?.()
  if (!valid) {
    submitting.value = false
    return
  }
  if (!name.value || !email.value || !message.value) {
    errorMsg.value = 'Please fill out all fields.'
    submitting.value = false
    return
  }
  // Insert into Supabase
  const { error } = await supabase.from('contact_messages').insert({
    name: name.value,
    email: email.value,
    message: message.value,
    created_at: new Date().toISOString()
  })
  if (error) {
    errorMsg.value = 'Failed to send message. Please try again.'
    submitting.value = false
    return
  }
  successMsg.value = 'Message sent!'
  name.value = ''
  email.value = ''
  message.value = ''
  submitting.value = false
  setTimeout(() => {
    isFlipped.value = true
    successMsg.value = ''
  }, 1000)
}
</script>

<style scoped>
.contact-flip-card {
  perspective: 1000px;
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
}
.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.8s ease;
  transform-style: preserve-3d;
}
.flipped .flip-card-inner {
  transform: rotateY(180deg);
}
.flip-card-front,
.flip-card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 10px;
  overflow: hidden;
}
.flip-card-front {
  z-index: 2;
}
.flip-card-back {
  transform: rotateY(180deg);
}
.vanta-sky {
  color: #5ca6ca;
  text-shadow:
    1px 1px 2px #334d80,
    2px 2px 4px #000a,
    0 4px 12px #000a,
    0 1px 0 #fff8,
    0 0 16px #5ca6ca88;
  letter-spacing: 1px;
  font-weight: 900;
  font-size: 1.3rem;
}
.about-social {
  margin-bottom: 1.5rem;
}
.fa-social {
  width: 24px;
  height: 24px;
  vertical-align: middle;
}
</style>
