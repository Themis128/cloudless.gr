<template>
  <div class="test-container">
    <h1>Contact Form Composable Test</h1>

    <div class="test-section">
      <h2>1. Form Validation Test</h2>
      <button @click="testValidation" class="test-button">Test Validation</button>
      <div v-if="testResults.validation" class="result">
        <h3>Result:</h3>
        <pre>{{ testResults.validation }}</pre>
      </div>
    </div>

    <div class="test-section">
      <h2>2. CSRF Token Test</h2>
      <button @click="testCsrfToken" class="test-button">Test CSRF Token</button>
      <div v-if="testResults.csrf" class="result">
        <h3>Result:</h3>
        <pre>{{ testResults.csrf }}</pre>
      </div>
    </div>

    <div class="test-section">
      <h2>2.5. CSRF Token Refresh Test</h2>
      <div class="current-token-display">
        <p>
          <strong>Current Token:</strong>
          {{
            contactForm.form.csrfToken
              ? contactForm.form.csrfToken.substring(0, 10) + '...'
              : 'No token'
          }}
          <span v-if="contactForm.isRefreshingToken" class="refreshing-indicator">
            (refreshing...)</span
          >
        </p>
      </div>
      <button
        @click="testTokenRefresh"
        class="test-button"
        :disabled="contactForm.isRefreshingToken"
      >
        {{ contactForm.isRefreshingToken ? 'Refreshing...' : 'Test Token Refresh' }}
      </button>
      <div v-if="testResults.tokenRefresh" class="result token-refresh-result">
        <h3>Result:</h3>
        <pre>{{ testResults.tokenRefresh }}</pre>
      </div>
    </div>

    <div class="test-section">
      <h2>2.6. Token Age Test (Auto-refresh)</h2>
      <button @click="testOldToken" class="test-button">Test Token Age Detection</button>
      <div v-if="testResults.tokenAge" class="result">
        <h3>Result:</h3>
        <pre>{{ testResults.tokenAge }}</pre>
      </div>
    </div>

    <div class="test-section">
      <h2>3. Form Submission Test</h2>
      <form @submit.prevent="testSubmission" class="test-form">
        <div class="form-group">
          <label for="name">Name</label>
          <input id="name" v-model="contactForm.form.name" @blur="contactForm.validateName" />
          <p v-if="contactForm.errors.name" class="error">{{ contactForm.errors.name }}</p>
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            v-model="contactForm.form.email"
            @blur="contactForm.validateEmail"
          />
          <p v-if="contactForm.errors.email" class="error">{{ contactForm.errors.email }}</p>
        </div>

        <div class="form-group">
          <label for="subject">Subject</label>
          <input
            id="subject"
            v-model="contactForm.form.subject"
            @blur="contactForm.validateSubject"
          />
          <p v-if="contactForm.errors.subject" class="error">{{ contactForm.errors.subject }}</p>
        </div>

        <div class="form-group">
          <label for="message">Message</label>
          <textarea
            id="message"
            v-model="contactForm.form.message"
            @blur="contactForm.validateMessage"
            rows="4"
          ></textarea>
          <p v-if="contactForm.errors.message" class="error">{{ contactForm.errors.message }}</p>
        </div>

        <button type="submit" class="submit-button" :disabled="contactForm.isSubmitting">
          {{ contactForm.isSubmitting ? 'Submitting...' : 'Submit Test Form' }}
        </button>
      </form>

      <div v-if="contactForm.isSuccess" class="success-message">
        <h3>Form Submitted Successfully!</h3>
        <p v-if="contactForm.submissionId">Submission ID: {{ contactForm.submissionId }}</p>
        <p v-if="contactForm.rateLimitInfo?.remaining">
          Remaining Submissions: {{ contactForm.rateLimitInfo.remaining }}
        </p>
      </div>

      <div v-if="contactForm.error" class="error-message">
        <h3>Error:</h3>
        <p>{{ contactForm.error }}</p>
        <p v-if="contactForm.rateLimitInfo?.exceeded">
          Rate limit exceeded. Please try again later.
        </p>
      </div>
    </div>

    <div class="test-section">
      <h2>4. Rate Limiting Test</h2>
      <button @click="testRateLimit" class="test-button" :disabled="isRateLimitTesting">
        {{ isRateLimitTesting ? 'Testing...' : 'Test Rate Limiting (Multiple Submissions)' }}
      </button>
      <div v-if="testResults.rateLimit" class="result">
        <h3>Result:</h3>
        <pre>{{ testResults.rateLimit }}</pre>
      </div>
    </div>

    <div class="test-section">
      <h2>Console Output</h2>
      <p>Check your browser's developer console for detailed test outputs.</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useContactUs } from '~/composables/useContactUs';

const contactForm = useContactUs();
const isRateLimitTesting = ref(false);

// Track test results
const testResults = reactive({
  validation: null,
  csrf: null,
  submission: null,
  rateLimit: null,
  tokenRefresh: null,
  tokenAge: null,
});

onMounted(() => {
  console.log('Contact Form Test Page Loaded');
  console.log('Contact Form Composable:', contactForm);
});

// Test validation
const testValidation = () => {
  console.log('Testing form validation...');

  // Clear form first
  contactForm.resetForm();

  // Test empty validations
  contactForm.validateName();
  contactForm.validateEmail();
  contactForm.validateSubject();
  contactForm.validateMessage();

  const emptyValidationResults = {
    name: contactForm.errors.name,
    email: contactForm.errors.email,
    subject: contactForm.errors.subject,
    message: contactForm.errors.message,
  };

  console.log('Empty validation results:', emptyValidationResults);

  // Test with invalid data
  contactForm.form.name = 'John';
  contactForm.form.email = 'invalid-email';
  contactForm.form.subject = 'Test';
  contactForm.form.message = 'Hello';

  contactForm.validateName();
  contactForm.validateEmail();
  contactForm.validateSubject();
  contactForm.validateMessage();

  const invalidValidationResults = {
    name: contactForm.errors.name, // Should be empty (valid)
    email: contactForm.errors.email, // Should show error
    subject: contactForm.errors.subject, // Should be empty (valid)
    message: contactForm.errors.message, // Should be empty (valid)
  };

  console.log('Invalid data validation results:', invalidValidationResults);

  // Set valid data
  contactForm.form.email = 'john@example.com';
  contactForm.validateEmail();

  const finalValidationState = {
    isValid: contactForm.isValid,
    errors: { ...contactForm.errors },
  };

  console.log('Final validation state:', finalValidationState);

  // Update test results
  testResults.validation = {
    emptyValidationResults,
    invalidValidationResults,
    finalValidationState,
  };
};

// Test CSRF token
const testCsrfToken = async () => {
  console.log('Testing CSRF token...');

  // Check if token exists
  const currentToken = contactForm.form.csrfToken;
  console.log('Current CSRF token:', currentToken);

  // Make a direct call to the CSRF token API
  try {
    const response = await fetch('/api/csrf-token');
    const data = await response.json();
    console.log('CSRF API response:', data);

    testResults.csrf = {
      initialToken: currentToken,
      apiResponseToken: data.token,
      tokenMatch: currentToken === data.token,
    };
  } catch (error) {
    console.error('CSRF token API error:', error);
    testResults.csrf = {
      error: error.message,
    };
  }
};

// Test token refresh
const testTokenRefresh = async () => {
  console.log('Testing CSRF token refresh...');

  // Store the current token
  const oldToken = contactForm.form.csrfToken;

  // Trigger a token refresh
  await contactForm.refreshCsrfToken();

  // Check the new token
  const newToken = contactForm.form.csrfToken;

  console.log('Old CSRF token:', oldToken);
  console.log('New CSRF token:', newToken);

  // Update test results
  testResults.tokenRefresh = {
    oldToken,
    newToken,
    tokenChanged: oldToken !== newToken,
  };
};

// Test token age
const testOldToken = () => {
  console.log('Testing token age detection and auto-refresh...');

  // Get the current token state
  const currentToken = contactForm.form.csrfToken;
  const currentFreshness = contactForm.checkTokenFreshness();

  // Store the current timestamp
  const now = Date.now();

  // Set the token timestamp to 3.5 hours ago to simulate an old token
  const timestamp = now - 3.5 * 60 * 60 * 1000;
  localStorage.setItem('token_timestamp', timestamp.toString());

  testResults.tokenAge = `Current token: ${currentToken ? currentToken.substring(0, 10) + '...' : 'No token'}\n`;
  testResults.tokenAge += `Current token freshness: ${currentFreshness ? 'Fresh' : 'Stale'}\n\n`;
  testResults.tokenAge += `Token timestamp modified to 3.5 hours ago (${new Date(timestamp).toLocaleTimeString()}).\n`;

  // Wait a moment and then check the token freshness again
  setTimeout(() => {
    const newFreshness = contactForm.checkTokenFreshness();
    testResults.tokenAge += `\nToken freshness after timestamp change: ${newFreshness ? 'Fresh' : 'Stale'}\n`;

    if (!newFreshness) {
      testResults.tokenAge +=
        'Token is now stale! This should trigger a refresh before the next submission.\n\n';
      testResults.tokenAge +=
        'Try submitting the form to see if it auto-refreshes the token first.';
    } else {
      testResults.tokenAge +=
        'Token is still considered fresh. This is unexpected - please check the implementation.';
    }
  }, 500);
};

// Test form submission
const testSubmission = async () => {
  console.log('Testing form submission...');

  // Fill form with test data if empty
  if (!contactForm.form.name) {
    contactForm.form.name = 'Test User';
    contactForm.form.email = 'test@example.com';
    contactForm.form.subject = 'Composable Test';
    contactForm.form.message = 'This is a test submission from the test page';
  }

  console.log('Submitting form with data:', { ...contactForm.form });

  const result = await contactForm.submitForm();
  console.log('Submission result:', result);

  testResults.submission = {
    submissionSuccess: contactForm.isSuccess,
    submissionError: contactForm.error,
    submissionId: contactForm.submissionId,
    rateLimitInfo: contactForm.rateLimitInfo,
  };
};

// Test rate limiting by making multiple submissions
const testRateLimit = async () => {
  console.log('Testing rate limiting...');
  isRateLimitTesting.value = true;

  const results = [];
  const maxAttempts = 6; // Try to exceed the rate limit

  // Keep track of when we hit the rate limit
  let rateLimitHit = false;

  for (let i = 0; i < maxAttempts; i++) {
    if (rateLimitHit) break;

    console.log(`Submission attempt ${i + 1}/${maxAttempts}...`);

    // Reset form between submissions
    contactForm.resetForm();

    // Set test data
    contactForm.form.name = `Test User ${i + 1}`;
    contactForm.form.email = `test${i + 1}@example.com`;
    contactForm.form.subject = `Rate Limit Test ${i + 1}`;
    contactForm.form.message = `This is test submission #${i + 1} for rate limit testing`;

    // Submit form
    const result = await contactForm.submitForm();

    // Record result
    results.push({
      attempt: i + 1,
      success: contactForm.isSuccess,
      error: contactForm.error,
      rateLimitInfo: contactForm.rateLimitInfo,
    });

    // Check if we hit the rate limit
    if (contactForm.rateLimitInfo?.exceeded) {
      console.log('Rate limit hit at attempt', i + 1);
      rateLimitHit = true;
    }

    // Wait briefly between submissions
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('Rate limit test results:', results);

  testResults.rateLimit = {
    rateLimitHit,
    attempts: results.length,
    results,
  };

  isRateLimitTesting.value = false;
};
</script>

<style scoped>
.test-container {
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  background-color: #f8fafc;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

h1 {
  font-size: 2rem;
  color: #2d3748;
  margin-bottom: 2rem;
  text-align: center;
}

.test-section {
  margin-bottom: 2.5rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid #e2e8f0;
}

h2 {
  font-size: 1.5rem;
  color: #4a5568;
  margin-bottom: 1rem;
}

.test-button {
  background-color: #4299e1;
  color: white;
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  margin-bottom: 1rem;
}

.test-button:hover {
  background-color: #3182ce;
}

.test-button:disabled {
  background-color: #a0aec0;
  cursor: not-allowed;
}

.result {
  background-color: #f7fafc;
  padding: 1rem;
  border-radius: 4px;
  border-left: 4px solid #4299e1;
  margin-top: 1rem;
  overflow-x: auto;
}

pre {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.9rem;
}

.test-form {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 500;
  color: #4a5568;
}

input,
textarea {
  padding: 0.6rem;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 2px rgba(66, 153, 225, 0.2);
}

.error {
  color: #e53e3e;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

.submit-button {
  background-color: #48bb78;
  color: white;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  margin-top: 0.5rem;
}

.submit-button:hover {
  background-color: #38a169;
}

.submit-button:disabled {
  background-color: #9ae6b4;
  cursor: not-allowed;
}

.success-message {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #f0fff4;
  border-radius: 4px;
  border-left: 4px solid #48bb78;
  color: #276749;
}

.error-message {
  margin-top: 1.5rem;
  padding: 1rem;
  background-color: #fff5f5;
  border-radius: 4px;
  border-left: 4px solid #e53e3e;
  color: #c53030;
}

.current-token-display {
  background-color: #f3f4f6;
  padding: 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 0.75rem;
  font-family: monospace;
  font-size: 0.875rem;
}

.token-refresh-result {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: #f0fdf4;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.refreshing-indicator {
  color: #3182ce;
  font-style: italic;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.6;
  }
}
</style>
