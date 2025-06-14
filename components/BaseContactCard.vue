<template>
  <div class="contact-flip-card">
    <div :class="['flip-card-inner', { flipped: isFlipped }]">
      <!-- Front Side: Contact Form -->
      <div class="flip-card-front">
        <v-card elevation="4" class="pa-4">
          <v-card-title>{{ title }}</v-card-title>
          <v-card-text>
            <v-form ref="form" @submit.prevent="onSubmitInternal" v-model="formValid">
              <v-text-field ref="nameField" v-model="name" label="Name" required :rules="[v => !!v || 'Name is required']" />
              <v-text-field v-model="email" label="Email" required type="email" :rules="[v => !!v || 'Email is required']" />
              <v-textarea v-model="message" label="Message" required :rules="[v => !!v || 'Message is required']" />
              <div aria-live="assertive">
                <v-alert v-if="errorMsg" type="error" class="mt-2">{{ errorMsg }}</v-alert>
                <v-alert v-if="successMsg" type="success" class="mt-2">{{ successMsg }}</v-alert>
              </div>
              <v-btn type="submit" color="primary" :disabled="submitting || !formValid" :loading="submitting">
                {{ submitText }}
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </div>
      <!-- Back Side: Thank You / Socials -->
      <div class="flip-card-back">
        <v-card elevation="4" class="pa-4 text-center">
          <v-card-title>{{ thankYouTitle }}</v-card-title>
          <v-card-text>
            <div>{{ thankYouText }}</div>
            <div class="mt-4">
              <slot name="socials">
                <span v-for="item in typedSocialLinks" :key="item.name" class="mx-2">
                  <a :href="item.url" target="_blank" rel="noopener noreferrer" :aria-label="item.aria || item.name">
                    <FontAwesomeIcon :icon="item.iconObj" :style="`color:${item.color};font-size:1.5rem;`" />
                  </a>
                </span>
              </slot>
            </div>
            <v-btn aria-label="Go back to contact form" color="primary" size="small" variant="text" @click="isFlipped = false">Back</v-btn>
          </v-card-text>
        </v-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useContactForm } from '@/composables/useContactForm'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import type { PropType } from 'vue'
import { computed, ref, onMounted, nextTick } from 'vue'

interface ContactSocialLink {
  name: string;
  url: string;
  iconObj?: any;
  color?: string;
  aria?: string;
}

const typedSocialLinks = computed<ContactSocialLink[]>(() => props.socialLinks as ContactSocialLink[])

const props = defineProps({
  title: { type: String, default: 'Contact Us' },
  thankYouTitle: { type: String, default: 'Thank You!' },
  thankYouText: { type: String, default: "We'll get back to you soon." },
  submitText: { type: String, default: 'Send Message' },
  socialLinks: { type: Array as PropType<ContactSocialLink[]>, default: () => [] },
  onSubmit: { type: Function as PropType<(payload: { name: string; email: string; message: string }) => Promise<void>>, required: true },
})

const {
  name,
  email,
  message,
  errorMsg,
  successMsg,
  submitting,
  isFlipped,
  form,
  formValid,
  reset,
} = useContactForm()

const nameField = ref()

onMounted(() => {
  nextTick(() => {
    nameField.value?.focus?.()
  })
})

async function onSubmitInternal() {
  errorMsg.value = ''
  successMsg.value = ''
  submitting.value = true
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
  try {
    await props.onSubmit({ name: name.value, email: email.value, message: message.value })
    successMsg.value = 'Message sent!'
    name.value = ''
    email.value = ''
    message.value = ''
    setTimeout(() => {
      isFlipped.value = true
      successMsg.value = ''
    }, 1000)
  } catch (e: any) {
    errorMsg.value = e?.message || 'Failed to send message. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.contact-flip-card {
  perspective: 1200px;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
}
.flip-card-inner {
  transition: transform 0.7s cubic-bezier(.4,2,.6,1);
  transform-style: preserve-3d;
  position: relative;
}
.flipped {
  transform: rotateY(180deg);
}
.flip-card-front, .flip-card-back {
  backface-visibility: hidden;
  position: absolute;
  width: 100%;
  left: 0;
  top: 0;
  transform-style: preserve-3d;
}
.flip-card-front {
  z-index: 2;
}
.flip-card-back {
  transform: rotateY(180deg);
  z-index: 3;
}
</style>
