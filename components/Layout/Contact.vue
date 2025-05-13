<template>
  <div class="contact-page">
    <div class="contact-card">
      <h1>Contact Us</h1>
      <p class="mb-6">Get in touch with us using the form below.</p>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="form-group">
          <label for="name">Name</label>
          <input id="name" v-model="form.name" type="text" class="form-input" :class="{ 'error': errors.name }"
            placeholder="Your name" required />
          <span v-if="errors.name" class="error-message">{{ errors.name }}</span>
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" v-model="form.email" type="email" class="form-input" :class="{ 'error': errors.email }"
            placeholder="your@email.com" required />
          <span v-if="errors.email" class="error-message">{{ errors.email }}</span>
        </div>

        <div class="form-group">
          <label for="message">Message</label>
          <textarea id="message" v-model="form.message" class="form-input" :class="{ 'error': errors.message }" rows="4"
            placeholder="Your message" required></textarea>
          <span v-if="errors.message" class="error-message">{{ errors.message }}</span>
          <div v-if="suggestionLoading" class="copilot-suggestion">Loading suggestion...</div>
          <div v-else-if="suggestion" class="copilot-suggestion">
            💡 LLM has a suggestion for your message.
            <button type="button" class="diff-merge-btn" @click="showDiffModal = true">Diff & Merge</button>
          </div>
        </div>

        <button type="submit" class="submit-button" :disabled="isSubmitting">
          {{ isSubmitting ? 'Sending...' : 'Send Message' }}
        </button>
      </form>

      <div v-if="submitStatus" :class="['submit-status', submitStatus.type]">
        {{ submitStatus.message }}
      </div>
    </div>
  </div>

  <!-- Add a stub for the diff/merge modal -->
  <div v-if="showDiffModal" class="modal-overlay">
    <div class="modal-content">
      <h3>Diff & Merge</h3>
      <p>Current message:</p>
      <pre class="diff-block">{{ form.message }}</pre>
      <p>LLM suggestion:</p>
      <pre class="diff-block">{{ suggestion }}</pre>
      <div class="modal-actions">
        <button @click="mergeSuggestion">Merge</button>
        <button @click="showDiffModal = false">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';

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
const suggestion = ref('');
const suggestionLoading = ref(false);
const showDiffModal = ref(false);

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

watch(() => form.message, async (newMessage) => {
  if (!newMessage || newMessage.length < 5) {
    suggestion.value = '';
    return;
  }
  suggestionLoading.value = true;
  try {
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: `Continue this message: ${newMessage}` }),
    });
    if (res.ok) {
      const data = await res.json();
      suggestion.value = data.response || data.result || '';
    } else {
      suggestion.value = '';
    }
  } catch {
    suggestion.value = '';
  } finally {
    suggestionLoading.value = false;
  }
});

function mergeSuggestion() {
  form.message += suggestion.value;
  suggestion.value = '';
  showDiffModal.value = false;
}
</script>

<style scoped>
.contact {
  padding: 2rem;
  text-align: center;
}

.copilot-suggestion {
  margin-top: 0.5rem;
  background: #f6f8fa;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.95rem;
  color: #222;
  cursor: pointer;
  transition: background 0.2s;
}

.copilot-suggestion:hover {
  background: #e0e7ef;
}

.diff-merge-btn {
  margin-left: 0.5rem;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 0.3rem;
  padding: 0.2rem 0.7rem;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s;
}

.diff-merge-btn:hover {
  background: #1e40af;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #fff;
  border-radius: 1rem;
  padding: 2rem;
  min-width: 320px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.15);
}

.diff-block {
  background: #f6f8fa;
  border-radius: 0.4rem;
  padding: 0.5rem 1rem;
  font-family: 'Fira Mono', 'Consolas', monospace;
  font-size: 0.98rem;
  margin-bottom: 1rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.modal-actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
}
</style>
