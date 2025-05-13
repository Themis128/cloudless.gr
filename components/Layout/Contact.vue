<template>
  <div class="contact-page">
    <div class="contact-card">
      <h1>Contact Us</h1>
      <p class="mb-6">Get in touch with us using the form below.</p>
      
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="form-group">
          <label for="name">Name</label>
          <input 
            id="name"
            v-model="form.name"
            type="text"
            class="form-input"
            :class="{ 'error': errors.name }"
            placeholder="Your name"
            required
          />
          <span v-if="errors.name" class="error-message">{{ errors.name }}</span>
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input 
            id="email"
            v-model="form.email"
            type="email"
            class="form-input"
            :class="{ 'error': errors.email }"
            placeholder="your@email.com"
            required
          />
          <span v-if="errors.email" class="error-message">{{ errors.email }}</span>
        </div>

        <div class="form-group">
          <label for="message">Message</label>
          <textarea 
            id="message"
            v-model="form.message"
            class="form-input"
            :class="{ 'error': errors.message }"
            rows="4"
            placeholder="Your message"
            required
          ></textarea>
          <span v-if="errors.message" class="error-message">{{ errors.message }}</span>
        </div>

        <button 
          type="submit"
          class="submit-button"
          :disabled="isSubmitting"
        >
          {{ isSubmitting ? 'Sending...' : 'Send Message' }}
        </button>
      </form>

      <div v-if="submitStatus" :class="['submit-status', submitStatus.type]">
        {{ submitStatus.message }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';

const form = reactive({
  name: '',
  email: '',
  message: ''
});

const errors = reactive({
  name: '',
  email: '',
  message: ''
});

const isSubmitting = ref(false);
const submitStatus = ref(null);

const validateForm = () => {
  let isValid = true;
  errors.name = '';
  errors.email = '';
  errors.message = '';

  if (!form.name.trim()) {
    errors.name = 'Name is required';
    isValid = false;
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required';
    isValid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Please enter a valid email';
    isValid = false;
  }

  if (!form.message.trim()) {
    errors.message = 'Message is required';
    isValid = false;
  }

  return isValid;
};

const handleSubmit = async () => {
  if (!validateForm()) return;

  isSubmitting.value = true;
  submitStatus.value = null;

  try {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    submitStatus.value = {
      type: 'success',
      message: 'Thank you! Your message has been sent successfully.'
    };
    
    // Reset form
    form.name = '';
    form.email = '';
    form.message = '';
    
  } catch (error) {
    submitStatus.value = {
      type: 'error',
      message: 'Sorry, there was an error sending your message. Please try again.'
    };
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
.contact {
  padding: 2rem;
  text-align: center;
}
</style>
