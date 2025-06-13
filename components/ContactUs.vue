<template>
  <div class="contactus-flip-container" :class="{ flipped: isFlipped }">
    <div class="contactus-flipper">
      <!-- Front Side -->
      <v-card class="contactus-card mx-auto contactus-front" max-width="340" elevation="6">
        <v-card-title class="vanta-sky text-center">Contact Us</v-card-title>
        <v-card-text>
          <v-form @submit.prevent="handleSubmit">
            <v-text-field v-model="name" label="Your Name" required density="compact" hide-details class="mb-2" />
            <v-text-field v-model="email" label="Email" type="email" required density="compact" hide-details class="mb-2" />
            <v-textarea v-model="message" label="Message" rows="3" auto-grow required density="compact" hide-details class="mb-2" />
            <v-btn color="primary" size="small" block class="mt-2" type="submit" :loading="submitting" :disabled="submitting">Send Message</v-btn>
            <v-alert v-if="errorMsg" type="error" class="mt-2">{{ errorMsg }}</v-alert>
          </v-form>
        </v-card-text>
      </v-card>
      <!-- Back Side -->
      <v-card class="contactus-card mx-auto contactus-back" max-width="340" elevation="6">
        <v-card-title class="vanta-sky text-center">Thank You!</v-card-title>
        <v-card-text class="text-center">
          <div class="mb-2">Your message has been sent.<br>We’ll get back to you soon.</div>
          <div class="about-social mb-2">
            <v-btn
              v-for="item in socialWithIcons"
              :key="item.name"
              icon
              :href="item.url"
              target="_blank"
              :aria-label="item.aria"
              class="mx-1"
              size="small"
              variant="text"
            >
              <FontAwesomeIcon :icon="item.iconObj" class="fa-social" :style="`color:${item.color}`" />
            </v-btn>
          </div>
          <v-btn color="primary" size="small" variant="text" @click="isFlipped = false">Back</v-btn>
        </v-card-text>
      </v-card>
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
const isFlipped = ref(false)
const submitting = ref(false)
const errorMsg = ref('')

const contact = useContactInfo()
const iconMap = { faTwitter, faGithub, faLinkedin }
const socialWithIcons = computed(() => contact.social.map(item => ({
  ...item,
  iconObj: iconMap[item.icon as keyof typeof iconMap]
})))

const supabase = useSupabase()

async function handleSubmit() {
  submitting.value = true
  errorMsg.value = ''
  const { data, error, status } = await supabase
    .from('contact_messages')
    .insert({
      name: name.value,
      email: email.value,
      message: message.value
    });
  console.log('Supabase Insert Debug:', {
    name: name.value,
    email: email.value,
    message: message.value,
    status,
    data,
    error,
  });
  submitting.value = false
  if (error) {
    errorMsg.value = 'Insert failed — check console for full error.';
    // eslint-disable-next-line no-console
    console.error('RAW ERROR:', error);
    return;
  }
  isFlipped.value = true
  name.value = ''
  email.value = ''
  message.value = ''
}
</script>

<style scoped>
.contactus-flip-container {
  perspective: 900px;
  width: 340px;
  margin: 0 auto;
}
.contactus-flipper {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s cubic-bezier(.4,2,.6,1);
  transform-style: preserve-3d;
}
.flipped .contactus-flipper {
  transform: rotateY(180deg);
}
.contactus-card {
  border-radius: 18px;
  padding: 0.5rem 0.5rem 1rem 0.5rem;
  box-shadow: 0 2px 12px 0 rgba(31, 38, 135, 0.10);
  min-height: 320px;
  backface-visibility: hidden;
}
.contactus-front {
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  z-index: 2;
  background: #fff;
}
.contactus-back {
  position: absolute;
  width: 100%;
  top: 0;
  left: 0;
  transform: rotateY(180deg);
  background: #fff;
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
